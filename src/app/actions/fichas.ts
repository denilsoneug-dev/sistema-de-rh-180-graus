"use server";

import { randomBytes, createHash } from "crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAcessoTotal } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { limparCpf } from "@/lib/cpf";
import { statusFichaAnaliseValido } from "@/lib/rh";

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export async function atualizarStatusRecrutamento(fichaId: string, formData: FormData) {
  const perfil = await requireAcessoTotal();
  const status = String(formData.get("status_recrutamento") || "");
  // Só permite status da fase de análise (nova_ficha / em_analise / banco_de_talentos).
  if (!statusFichaAnaliseValido(status)) throw new Error("Status de recrutamento inválido");

  const supabase = await createClient();
  // Não permite alterar status manual depois que a ficha saiu da análise (já convertida etc.).
  const { data: anterior } = await supabase.from("fichas")
    .select("status, status_recrutamento").eq("id", fichaId).single();
  if (anterior && anterior.status !== "recebida") {
    throw new Error("A ficha não está mais em análise — status não pode ser alterado.");
  }
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
  if (!ficha || !["recebida", "selecionada"].includes(ficha.status)) {
    throw new Error("Ficha não pode ser selecionada para o processo");
  }
  const r = Array.isArray(ficha.ficha_respostas) ? ficha.ficha_respostas[0] : ficha.ficha_respostas;
  if (!r) throw new Error("Ficha sem respostas");

  const cpf = limparCpf(r.cpf || ficha.cpf || "");
  const { data: candidatoPorFicha, error: candidatoPorFichaError } = await supabase
    .from("candidatos")
    .select("id, ficha_id")
    .eq("ficha_id", fichaId)
    .limit(1)
    .maybeSingle();
  if (candidatoPorFichaError) throw new Error(candidatoPorFichaError.message);

  let candidatoExistente = candidatoPorFicha;
  if (!candidatoExistente && cpf) {
    const { data: candidatoPorCpf, error: candidatoPorCpfError } = await supabase
      .from("candidatos")
      .select("id, ficha_id")
      .eq("cpf", cpf)
      .limit(1)
      .maybeSingle();
    if (candidatoPorCpfError) throw new Error(candidatoPorCpfError.message);
    candidatoExistente = candidatoPorCpf;
  }

  if (candidatoExistente) {
    if (!candidatoExistente.ficha_id) {
      const { error: candidatoError } = await supabase
        .from("candidatos")
        .update({ ficha_id: fichaId })
        .eq("id", candidatoExistente.id);
      if (candidatoError) throw new Error(candidatoError.message);
    }

    const { error: fichaError } = await supabase
      .from("fichas")
      .update({ status: "selecionada" })
      .eq("id", fichaId);
    if (fichaError) throw new Error(fichaError.message);

    await logAudit({
      usuario_id: perfil.id,
      usuario_nome: perfil.nome,
      acao: "selecionou_para_processo_idempotente",
      entidade_tipo: "ficha",
      entidade_id: fichaId,
      dados_depois: { candidato_id: candidatoExistente.id },
    });
    revalidatePath("/fichas");
    revalidatePath(`/fichas/${fichaId}`);
    revalidatePath("/candidatos");
    revalidatePath(`/candidatos/${candidatoExistente.id}`);
    redirect(`/candidatos/${candidatoExistente.id}?origem=ficha-ja-convertida`);
  }

  const agora = new Date().toISOString();
  const { data: cand, error } = await supabase
    .from("candidatos")
    .insert({
      ficha_id: fichaId,
      nome: r.nome_completo,
      cpf,
      telefone: r.whatsapp,
      vaga_pretendida: r.vaga_pretendida,
      status: "entrevista_online",
      etapa_atual: "entrevista_online",
      etapa_atual_desde: agora,
      indicado_por_equipe_id: indicadoPor,
      curriculo_url: ficha.curriculo_url,
    })
    .select("id")
    .single();
  if (error?.code === "23505") {
    const { data: concorrente } = await supabase
      .from("candidatos")
      .select("id")
      .eq("ficha_id", fichaId)
      .limit(1)
      .maybeSingle();
    if (concorrente) {
      await supabase.from("fichas").update({ status: "selecionada" }).eq("id", fichaId);
      revalidatePath("/fichas");
      revalidatePath(`/fichas/${fichaId}`);
      revalidatePath("/candidatos");
      redirect(`/candidatos/${concorrente.id}?origem=ficha-ja-convertida`);
    }
  }
  if (error || !cand) throw new Error(error?.message || "Não foi possível criar o candidato");

  const textoIndicacao = r.tem_conhecido_grupo && r.conhecido_nome
    ? `Indicação informada na ficha: ${r.conhecido_nome}${r.conhecido_relacao ? ` (${r.conhecido_relacao})` : ""}.`
    : null;
  const { error: etapaError } = await supabase.from("candidato_etapas").insert({
    candidato_id: cand.id,
    tipo_etapa: "entrevista_online",
    data: null,
    horario: null,
    duracao_minutos: null,
    entrevistador_id: null,
    entrevistador_nome: null,
    observacoes: textoIndicacao || "Candidato criado automaticamente a partir da ficha selecionada.",
    resultado: null,
    arquivo_url: null,
    criado_por: perfil.id,
  });
  if (etapaError) throw new Error(etapaError.message);

  const { error: fichaError } = await supabase
    .from("fichas")
    .update({ status: "selecionada" })
    .eq("id", fichaId);
  if (fichaError) throw new Error(fichaError.message);

  await logAudit({ usuario_id: perfil.id, usuario_nome: perfil.nome, acao: "selecionou_para_processo", entidade_tipo: "ficha", entidade_id: fichaId, dados_depois: { candidato_id: cand.id, etapa_inicial: "entrevista_online", indicado_por: indicadoPor } });
  revalidatePath("/fichas");
  revalidatePath(`/fichas/${fichaId}`);
  revalidatePath("/candidatos");
  revalidatePath(`/candidatos/${cand.id}`);
  redirect(`/candidatos/${cand.id}?origem=candidato-criado`);
}

// Edição completa das respostas da ficha (somente acesso_total).
// Cobre dados pessoais, moradia, disponibilidade/renda, recursos/requisitos,
// formação e as respostas abertas (respostas_sobre_voce_json).
const CAMPOS_TEXTO_FICHA = [
  "vaga_pretendida", "nome_completo", "endereco", "whatsapp", "email", "instagram",
  "estado_civil", "tamanho_camisa", "mora_com_quem", "emprego_ocupacao_pessoas_mora_junto",
  "disponibilidade_viajar_explicacao", "cargo_atual", "renda_extra", "renda_extra_descricao",
  "formacao", "habilidades_quer_aprender", "ferramentas_outros", "cnh_categoria",
] as const;

const CAMPOS_BOOL_FICHA = [
  "trabalha_atualmente", "moto_propria", "carro_proprio", "notebook_proprio",
  "internet_casa", "celular_android", "celular_ios", "tem_cnh",
] as const;

export async function editarRespostasFicha(fichaId: string, formData: FormData) {
  const perfil = await requireAcessoTotal();
  const supabase = await createClient();

  const upd: Record<string, unknown> = {};

  for (const c of CAMPOS_TEXTO_FICHA) {
    const v = formData.get(c);
    if (v !== null) upd[c] = String(v).trim();
  }

  // Booleanos via select "sim"/"nao" (ignora vazio = não enviado).
  for (const c of CAMPOS_BOOL_FICHA) {
    const v = formData.get(c);
    if (v === "sim") upd[c] = true;
    else if (v === "nao") upd[c] = false;
  }

  // Disponibilidade (enum).
  const disp = formData.get("disponibilidade_viajar");
  if (disp && ["integral", "parcial", "nao_tenho"].includes(String(disp))) {
    upd.disponibilidade_viajar = String(disp);
  }

  // Inteiros.
  const idade = formData.get("idade");
  if (idade !== null && String(idade) !== "") upd.idade = parseInt(String(idade), 10);
  const qtdMora = formData.get("quantidade_pessoas_mora_junto");
  if (qtdMora !== null && String(qtdMora) !== "") upd.quantidade_pessoas_mora_junto = parseInt(String(qtdMora), 10);

  // CPF normalizado.
  const cpf = formData.get("cpf");
  if (cpf !== null && String(cpf) !== "") upd.cpf = limparCpf(String(cpf));

  // Listas (checkboxes) — só sobrescreve se o grupo foi enviado no form.
  if (formData.has("ferramentas")) upd.ferramentas_json = formData.getAll("ferramentas").map(String);
  if (formData.has("horas_livres")) upd.horas_livres_json = formData.getAll("horas_livres").map(String);

  // Respostas abertas (respostas_sobre_voce_json) — campos prefixados sv_<key>.
  const sv: Record<string, string> = {};
  let temSv = false;
  for (const [k, v] of formData.entries()) {
    if (k.startsWith("sv_")) { sv[k.slice(3)] = String(v); temSv = true; }
  }
  if (temSv) upd.respostas_sobre_voce_json = sv;

  if (Object.keys(upd).length === 0) {
    throw new Error("Nada para atualizar");
  }

  const { error } = await supabase.from("ficha_respostas").update(upd).eq("ficha_id", fichaId);
  if (error) throw new Error(error.message);
  await logAudit({ usuario_id: perfil.id, usuario_nome: perfil.nome, acao: "editou_ficha", entidade_tipo: "ficha", entidade_id: fichaId, dados_depois: upd });
  revalidatePath(`/fichas/${fichaId}`);
}
