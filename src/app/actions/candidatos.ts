"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAcessoTotal } from "@/lib/auth";
import { logAudit } from "@/lib/audit";

const PROXIMA_ETAPA: Record<string, string> = {
  entrevista_online: "entrevista_presencial",
  entrevista_presencial: "redacao_escrita",
  redacao_escrita: "em_treinamento",
};

const ETAPA_TO_TIPO: Record<string, string> = {
  entrevista_online: "entrevista_online",
  entrevista_presencial: "entrevista_presencial",
  redacao_escrita: "redacao_escrita",
  em_treinamento: "treinamento",
};

export async function registrarEtapa(candidatoId: string, formData: FormData) {
  const perfil = await requireAcessoTotal();
  const supabase = await createClient();

  const { data: cand } = await supabase.from("candidatos").select("*").eq("id", candidatoId).single();
  if (!cand) throw new Error("Candidato não encontrado");
  const tipoEtapa = ETAPA_TO_TIPO[cand.status as string];
  if (!tipoEtapa) throw new Error("Candidato não está em etapa ativa");

  const resultado = String(formData.get("resultado") || "");
  const isTreinamento = tipoEtapa === "treinamento";

  // Upload da redação, se houver
  let arquivo_url: string | null = null;
  const arquivo = formData.get("arquivo") as File | null;
  if (arquivo && arquivo.size > 0) {
    const admin = createAdminClient();
    const ext = (arquivo.name.split(".").pop() || "bin").toLowerCase();
    if (!["jpg", "jpeg", "png", "pdf"].includes(ext)) throw new Error("Arquivo deve ser JPG, PNG ou PDF");
    const path = `${candidatoId}/${Date.now()}.${ext}`;
    const { error: upErr } = await admin.storage.from("redacoes").upload(path, arquivo, { contentType: arquivo.type });
    if (upErr) throw new Error(upErr.message);
    arquivo_url = path;
  }

  const { error } = await supabase.from("candidato_etapas").insert({
    candidato_id: candidatoId,
    tipo_etapa: tipoEtapa,
    data: String(formData.get("data") || "") || null,
    horario: String(formData.get("horario") || "") || null,
    duracao_minutos: formData.get("duracao") ? parseInt(String(formData.get("duracao")), 10) : null,
    entrevistador_id: isTreinamento ? null : perfil.id,
    entrevistador_nome: isTreinamento ? null : String(formData.get("entrevistador") || perfil.nome),
    observacoes: String(formData.get("observacoes") || "") || null,
    resultado: resultado || null,
    arquivo_url,
    criado_por: perfil.id,
  });
  if (error) throw new Error(error.message);

  // Avanço de etapa
  if (resultado === "passou" && PROXIMA_ETAPA[cand.status as string]) {
    const prox = PROXIMA_ETAPA[cand.status as string];
    await supabase.from("candidatos").update({
      status: prox,
      etapa_atual: ETAPA_TO_TIPO[prox],
      etapa_atual_desde: new Date().toISOString(),
    }).eq("id", candidatoId);
    await logAudit({ usuario_id: perfil.id, usuario_nome: perfil.nome, acao: "mudou_etapa", entidade_tipo: "candidato", entidade_id: candidatoId, dados_antes: { etapa: cand.status }, dados_depois: { etapa: prox } });
  }

  await logAudit({ usuario_id: perfil.id, usuario_nome: perfil.nome, acao: `registrou_${tipoEtapa}`, entidade_tipo: "candidato", entidade_id: candidatoId, dados_depois: { resultado } });
  revalidatePath(`/candidatos/${candidatoId}`);
  revalidatePath("/candidatos");
}

export async function rejeitarCandidato(candidatoId: string, formData: FormData) {
  const perfil = await requireAcessoTotal();
  const motivo = String(formData.get("motivo") || "").trim() || null;
  const supabase = await createClient();
  const { error } = await supabase.from("candidatos").update({
    status: "rejeitado",
    rejeicao_motivo: motivo,
    rejeitado_em: new Date().toISOString(),
  }).eq("id", candidatoId);
  if (error) throw new Error(error.message);
  await logAudit({ usuario_id: perfil.id, usuario_nome: perfil.nome, acao: "rejeitou_candidato", entidade_tipo: "candidato", entidade_id: candidatoId, dados_depois: { motivo } });
  revalidatePath("/candidatos");
  redirect("/candidatos");
}

export async function efetivarCandidato(candidatoId: string, formData: FormData) {
  const perfil = await requireAcessoTotal();
  const supabase = await createClient();

  const { data: cand } = await supabase.from("candidatos").select("*").eq("id", candidatoId).single();
  if (!cand || cand.status !== "em_treinamento") throw new Error("Candidato não está em treinamento");

  // Confere se há treinamento aprovado
  const { data: etapas } = await supabase.from("candidato_etapas")
    .select("resultado").eq("candidato_id", candidatoId).eq("tipo_etapa", "treinamento");
  const aprovado = (etapas || []).some((e) => e.resultado === "aprovado");
  if (!aprovado) throw new Error("Treinamento ainda não foi aprovado");

  const indicadoPor = String(formData.get("indicado_por") || "") || null;

  const equipeRow: Record<string, unknown> = {
    nome: cand.nome,
    cpf: cand.cpf,
    telefone: cand.telefone || "",
    cargo: String(formData.get("cargo") || ""),
    salario: parseFloat(String(formData.get("salario") || "0")),
    data_entrada: String(formData.get("data_entrada") || ""),
    status: "em_experiencia",
    indicado_por_equipe_id: indicadoPor,
    origem: "processo_seletivo",
    candidato_origem_id: candidatoId,
    observacoes_iniciais: String(formData.get("observacoes") || "") || null,
  };

  const { data: membro, error } = await supabase.from("equipe").insert(equipeRow).select("id").single();
  if (error) throw new Error(error.message);

  // Dados bancários opcionais
  const banco = String(formData.get("banco") || "").trim();
  if (banco) {
    await supabase.from("dados_bancarios").insert({
      equipe_id: membro.id,
      banco,
      agencia: String(formData.get("agencia") || "") || null,
      conta: String(formData.get("conta") || "") || null,
      tipo_conta: String(formData.get("tipo_conta") || "") || null,
      nome_titular: String(formData.get("nome_titular") || "") || null,
      cpf_titular: String(formData.get("cpf_titular") || "") || null,
    });
  }

  // Bônus automático por indicação
  if (indicadoPor) {
    const admin = createAdminClient();
    const { data: cfg } = await admin.from("configuracoes").select("valor").eq("chave", "valor_bonus_indicacao").single();
    const valor = cfg?.valor ? parseFloat(cfg.valor) : null;
    await supabase.from("bonus_indicacao").insert({
      indicador_equipe_id: indicadoPor,
      indicado_equipe_id: membro.id,
      candidato_origem_id: candidatoId,
      valor,
      status: "pendente",
    });
  }

  await supabase.from("candidatos").update({ status: "efetivado", efetivado_em: new Date().toISOString() }).eq("id", candidatoId);
  await logAudit({ usuario_id: perfil.id, usuario_nome: perfil.nome, acao: "efetivou_candidato", entidade_tipo: "candidato", entidade_id: candidatoId, dados_depois: { equipe_id: membro.id, indicado_por: indicadoPor } });
  revalidatePath("/candidatos");
  revalidatePath("/equipe");
  redirect(`/equipe/${membro.id}`);
}
