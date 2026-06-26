"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAcessoTotal } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { validarRedacaoArquivo } from "@/lib/curriculo";

const PROXIMA_ETAPA: Record<string, string> = {
  entrevista_online: "entrevista_presencial",
  entrevista_presencial: "redacao_escrita",
  redacao_escrita: "em_treinamento",
};

const ORDEM_ETAPAS = [
  "entrevista_online",
  "entrevista_presencial",
  "redacao_escrita",
  "em_treinamento",
] as const;

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
    const erroArquivo = validarRedacaoArquivo(arquivo);
    if (erroArquivo) throw new Error(erroArquivo);
    const admin = createAdminClient();
    const ext = (arquivo.name.split(".").pop() || "bin").toLowerCase();
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
    const sugerida = PROXIMA_ETAPA[cand.status as string];
    const escolhida = String(formData.get("proxima_etapa") || sugerida);
    const atualIdx = ORDEM_ETAPAS.indexOf(cand.status as (typeof ORDEM_ETAPAS)[number]);
    const proxIdx = ORDEM_ETAPAS.indexOf(escolhida as (typeof ORDEM_ETAPAS)[number]);
    const prox = atualIdx >= 0 && proxIdx > atualIdx ? escolhida : sugerida;
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

// Volta o candidato para a etapa anterior (correção de erro). Mantém todo o
// histórico de etapas; apenas ajusta o status/etapa atual e registra no audit.
const ORDEM_VOLTAR = [
  "entrevista_online",
  "entrevista_presencial",
  "redacao_escrita",
  "em_treinamento",
] as const;

export async function voltarEtapa(candidatoId: string, formData: FormData) {
  const perfil = await requireAcessoTotal();
  const supabase = await createClient();

  const { data: cand } = await supabase.from("candidatos").select("status").eq("id", candidatoId).single();
  if (!cand) throw new Error("Candidato não encontrado");
  const idx = ORDEM_VOLTAR.indexOf(cand.status as (typeof ORDEM_VOLTAR)[number]);
  if (idx <= 0) throw new Error("O candidato já está na primeira etapa do processo.");

  const destinoEscolhido = String(formData.get("etapa_destino") || "");
  const anterior = ORDEM_VOLTAR[idx - 1];
  const destinoIdx = ORDEM_VOLTAR.indexOf(destinoEscolhido as (typeof ORDEM_VOLTAR)[number]);
  // Só permite voltar para uma etapa ANTERIOR à atual; default = imediatamente anterior.
  const destino = destinoIdx >= 0 && destinoIdx < idx ? destinoEscolhido : anterior;

  const { error } = await supabase.from("candidatos").update({
    status: destino,
    etapa_atual: ETAPA_TO_TIPO[destino],
    etapa_atual_desde: new Date().toISOString(),
  }).eq("id", candidatoId);
  if (error) throw new Error(error.message);

  await logAudit({
    usuario_id: perfil.id,
    usuario_nome: perfil.nome,
    acao: "voltou_etapa",
    entidade_tipo: "candidato",
    entidade_id: candidatoId,
    dados_antes: { etapa: cand.status },
    dados_depois: { etapa: destino },
  });
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

// Encerra o treinamento sem aprovar. Conceitualmente "saiu da operação em treinamento".
// Sem status dedicado no banco ainda: reusa `rejeitado` com motivo prefixado e
// auditoria própria ("encerrou_treinamento"). Ideal futuro: status próprio (ver relatório).
export async function encerrarTreinamento(candidatoId: string, formData: FormData) {
  const perfil = await requireAcessoTotal();
  const motivoBase = String(formData.get("motivo") || "").trim();
  const motivo = motivoBase
    ? `Treinamento não aprovado: ${motivoBase}`
    : "Treinamento não aprovado";
  const supabase = await createClient();

  const { data: cand } = await supabase.from("candidatos").select("status").eq("id", candidatoId).single();
  if (!cand || cand.status !== "em_treinamento") throw new Error("Pessoa não está em treinamento");

  const { error } = await supabase.from("candidatos").update({
    status: "treinamento_encerrado",
    rejeicao_motivo: motivo,
    rejeitado_em: new Date().toISOString(),
  }).eq("id", candidatoId);
  if (error) throw new Error(error.message);
  await logAudit({ usuario_id: perfil.id, usuario_nome: perfil.nome, acao: "encerrou_treinamento", entidade_tipo: "candidato", entidade_id: candidatoId, dados_depois: { motivo } });
  revalidatePath("/candidatos");
  revalidatePath("/equipe");
  redirect("/equipe?tab=em_treinamento");
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

  const indicadoPor = String(formData.get("indicado_por") || "") || cand.indicado_por_equipe_id || null;

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

  const { data: existente, error: buscaError } = await supabase
    .from("equipe")
    .select("id")
    .or(`candidato_origem_id.eq.${candidatoId},cpf.eq.${cand.cpf}`)
    .limit(1)
    .maybeSingle();
  if (buscaError) throw new Error(buscaError.message);

  let membro = existente;
  if (membro) {
    const { error } = await supabase.from("equipe").update(equipeRow).eq("id", membro.id);
    if (error) throw new Error(error.message);
  } else {
    const { data: criado, error } = await supabase.from("equipe").insert(equipeRow).select("id").single();
    if (error?.code === "23505") {
      const { data: concorrente, error: concorrenteError } = await supabase
        .from("equipe")
        .select("id")
        .or(`candidato_origem_id.eq.${candidatoId},cpf.eq.${cand.cpf}`)
        .limit(1)
        .maybeSingle();
      if (concorrenteError || !concorrente) throw new Error(error.message);
      membro = concorrente;
      const { error: updateError } = await supabase.from("equipe").update(equipeRow).eq("id", membro.id);
      if (updateError) throw new Error(updateError.message);
    } else if (error || !criado) {
      throw new Error(error?.message || "Não foi possível efetivar o candidato");
    } else {
      membro = criado;
    }
  }

  // Dados bancários opcionais
  const banco = String(formData.get("banco") || "").trim();
  if (banco) {
    const { error: bancoError } = await supabase.from("dados_bancarios").upsert({
      equipe_id: membro.id,
      banco,
      agencia: String(formData.get("agencia") || "") || null,
      conta: String(formData.get("conta") || "") || null,
      tipo_conta: String(formData.get("tipo_conta") || "") || null,
      nome_titular: String(formData.get("nome_titular") || "") || null,
      cpf_titular: String(formData.get("cpf_titular") || "") || null,
    }, { onConflict: "equipe_id" });
    if (bancoError) throw new Error(bancoError.message);
  }

  // Bônus automático por indicação
  if (indicadoPor) {
    const { data: bonusExistente, error: bonusBuscaError } = await supabase.from("bonus_indicacao")
      .select("id").eq("candidato_origem_id", candidatoId).limit(1).maybeSingle();
    if (bonusBuscaError) throw new Error(bonusBuscaError.message);
    if (!bonusExistente) {
      const admin = createAdminClient();
      const { data: cfg } = await admin.from("configuracoes").select("valor").eq("chave", "valor_bonus_indicacao").single();
      const valor = cfg?.valor ? parseFloat(cfg.valor) : null;
      const { error: bonusError } = await supabase.from("bonus_indicacao").insert({
        indicador_equipe_id: indicadoPor,
        indicado_equipe_id: membro.id,
        candidato_origem_id: candidatoId,
        valor,
        status: "pendente",
      });
      if (bonusError) throw new Error(bonusError.message);
    }
  }

  await supabase.from("candidatos").update({ status: "efetivado", efetivado_em: new Date().toISOString() }).eq("id", candidatoId);
  await logAudit({ usuario_id: perfil.id, usuario_nome: perfil.nome, acao: "efetivou_candidato", entidade_tipo: "candidato", entidade_id: candidatoId, dados_depois: { equipe_id: membro.id, indicado_por: indicadoPor } });
  revalidatePath("/candidatos");
  revalidatePath(`/candidatos/${candidatoId}`);
  revalidatePath("/equipe");
  redirect(`/equipe/${membro.id}`);
}
