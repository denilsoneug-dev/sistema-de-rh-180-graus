"use server";

import { randomBytes, createHash } from "crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAcessoTotal } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { limparCpf } from "@/lib/cpf";
import { statusRecrutamentoValido } from "@/lib/rh";

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export async function atualizarStatusRecrutamento(fichaId: string, formData: FormData) {
  const perfil = await requireAcessoTotal();
  const status = String(formData.get("status_recrutamento") || "");
  if (!statusRecrutamentoValido(status)) throw new Error("Status de recrutamento inválido");

  const supabase = await createClient();
  const { data: anterior } = await supabase.from("fichas")
    .select("status_recrutamento").eq("id", fichaId).single();
  const { error } = await supabase.from("fichas")
    .update({ status_recrutamento: status }).eq("id", fichaId);
  if (error) throw new Error(error.message);

  await logAudit({
    usuario_id: perfil.id,
    usuario_nome: perfil.nome,
    acao: "alterou_status_recrutamento",
    entidade_tipo: "ficha",
    entidade_id: fichaId,
    dados_antes: { status_recrutamento: anterior?.status_recrutamento || null },
    dados_depois: { status_recrutamento: status },
  });
  revalidatePath("/fichas");
  revalidatePath(`/fichas/${fichaId}`);
}

async function diasExpiracao(): Promise<number> {
  const admin = createAdminClient();
  const { data } = await admin.from("configuracoes").select("valor").eq("chave", "dias_expiracao_link").single();
  return parseInt(data?.valor || "14", 10);
}

export async function criarFichaPendente(formData: FormData) {
  const perfil = await requireAcessoTotal();
  const nome = String(formData.get("nome") || "").trim();
  if (!nome) throw new Error("Nome obrigatório");

  const supabase = await createClient();
  const token = randomBytes(32).toString("hex");
  const dias = await diasExpiracao();
  const expira = new Date(Date.now() + dias * 86400000).toISOString();

  const { data, error } = await supabase
    .from("fichas")
    .insert({
      nome_inicial: nome,
      token_atual_hash: hashToken(token),
      token_atual: token,
      status: "pendente",
      link_expira_em: expira,
      link_enviado_em: new Date().toISOString(),
      criado_por: perfil.id,
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);

  await logAudit({ usuario_id: perfil.id, usuario_nome: perfil.nome, acao: "gerou_link", entidade_tipo: "ficha", entidade_id: data.id });
  revalidatePath("/fichas");
  redirect(`/fichas/${data.id}?token=${token}`);
}

export async function regerarLink(fichaId: string) {
  const perfil = await requireAcessoTotal();
  const supabase = await createClient();
  const token = randomBytes(32).toString("hex");
  const dias = await diasExpiracao();
  const expira = new Date(Date.now() + dias * 86400000).toISOString();

  const { error } = await supabase
    .from("fichas")
    .update({
      token_atual_hash: hashToken(token),
      token_atual: token,
      status: "pendente",
      link_expira_em: expira,
      link_enviado_em: new Date().toISOString(),
    })
    .eq("id", fichaId)
    .in("status", ["pendente", "expirada"]);
  if (error) throw new Error(error.message);

  await logAudit({ usuario_id: perfil.id, usuario_nome: perfil.nome, acao: "reenviou_link", entidade_tipo: "ficha", entidade_id: fichaId });
  revalidatePath(`/fichas/${fichaId}`);
  redirect(`/fichas/${fichaId}?token=${token}`);
}

export async function arquivarFicha(fichaId: string) {
  const perfil = await requireAcessoTotal();
  const supabase = await createClient();
  const { error } = await supabase.from("fichas").update({ status: "arquivada" }).eq("id", fichaId);
  if (error) throw new Error(error.message);
  await logAudit({ usuario_id: perfil.id, usuario_nome: perfil.nome, acao: "arquivou_ficha", entidade_tipo: "ficha", entidade_id: fichaId });
  revalidatePath("/fichas");
  redirect("/fichas?tab=arquivada");
}

export async function rejeitarFicha(fichaId: string, formData: FormData) {
  const perfil = await requireAcessoTotal();
  const motivo = String(formData.get("motivo") || "").trim() || null;
  const supabase = await createClient();
  const { error } = await supabase
    .from("fichas")
    .update({ status: "rejeitada", rejeicao_motivo: motivo, rejeitado_em: new Date().toISOString() })
    .eq("id", fichaId);
  if (error) throw new Error(error.message);
  await logAudit({ usuario_id: perfil.id, usuario_nome: perfil.nome, acao: "rejeitou_ficha", entidade_tipo: "ficha", entidade_id: fichaId, dados_depois: { motivo } });
  revalidatePath("/fichas");
  redirect("/fichas?tab=rejeitada");
}

export async function selecionarParaProcesso(fichaId: string, formData: FormData) {
  const perfil = await requireAcessoTotal();
  const indicadoPor = String(formData.get("indicado_por") || "") || null;
  const supabase = await createClient();

  const { data: ficha } = await supabase.from("fichas").select("*, ficha_respostas(*)").eq("id", fichaId).single();
  if (!ficha || ficha.status !== "recebida") throw new Error("Ficha não está em recebidas");
  const r = Array.isArray(ficha.ficha_respostas) ? ficha.ficha_respostas[0] : ficha.ficha_respostas;
  if (!r) throw new Error("Ficha sem respostas");

  const { data: cand, error } = await supabase
    .from("candidatos")
    .insert({
      ficha_id: fichaId,
      nome: r.nome_completo,
      cpf: limparCpf(r.cpf),
      telefone: r.whatsapp,
      vaga_pretendida: r.vaga_pretendida,
      status: "entrevista_online",
      etapa_atual: "entrevista_online",
      etapa_atual_desde: new Date().toISOString(),
      indicado_por_equipe_id: indicadoPor,
      curriculo_url: ficha.curriculo_url,
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);

  await supabase.from("fichas").update({ status: "selecionada" }).eq("id", fichaId);
  await logAudit({ usuario_id: perfil.id, usuario_nome: perfil.nome, acao: "selecionou_para_processo", entidade_tipo: "ficha", entidade_id: fichaId, dados_depois: { candidato_id: cand.id } });
  revalidatePath("/fichas");
  revalidatePath("/candidatos");
  redirect(`/candidatos/${cand.id}`);
}

export async function editarRespostasFicha(fichaId: string, formData: FormData) {
  const perfil = await requireAcessoTotal();
  const supabase = await createClient();
  const campos = ["vaga_pretendida", "nome_completo", "endereco", "whatsapp", "email", "instagram", "estado_civil", "tamanho_camisa"];
  const upd: Record<string, unknown> = {};
  for (const c of campos) {
    const v = formData.get(c);
    if (v !== null) upd[c] = String(v);
  }
  const idade = formData.get("idade");
  if (idade) upd.idade = parseInt(String(idade), 10);
  const cpf = formData.get("cpf");
  if (cpf) upd.cpf = limparCpf(String(cpf));

  const { error } = await supabase.from("ficha_respostas").update(upd).eq("ficha_id", fichaId);
  if (error) throw new Error(error.message);
  await logAudit({ usuario_id: perfil.id, usuario_nome: perfil.nome, acao: "editou_ficha", entidade_tipo: "ficha", entidade_id: fichaId, dados_depois: upd });
  revalidatePath(`/fichas/${fichaId}`);
}
