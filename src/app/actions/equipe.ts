"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireAcessoTotal } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { limparCpf, limparTelefone, validarCpf } from "@/lib/cpf";

const STATUS_EQUIPE_VALIDOS = ["ativo", "em_experiencia", "afastado", "desligado"] as const;

function lerStatusEquipe(formData: FormData, padrao = "ativo"): string {
  const s = String(formData.get("status") || padrao);
  return (STATUS_EQUIPE_VALIDOS as readonly string[]).includes(s) ? s : padrao;
}

function lerSalario(formData: FormData): number {
  const n = parseFloat(String(formData.get("salario") || "0"));
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

export async function cadastrarEquipe(formData: FormData) {
  const perfil = await requireAcessoTotal();
  const cpf = limparCpf(String(formData.get("cpf") || ""));
  if (!validarCpf(cpf)) throw new Error("CPF inválido");

  const supabase = await createClient();
  const { data: membro, error } = await supabase.from("equipe").insert({
    nome: String(formData.get("nome") || "").trim(),
    cpf,
    telefone: limparTelefone(String(formData.get("telefone") || "")),
    cargo: String(formData.get("cargo") || "").trim(),
    salario: lerSalario(formData),
    data_entrada: String(formData.get("data_entrada") || ""),
    status: lerStatusEquipe(formData),
    indicado_por_equipe_id: String(formData.get("indicado_por") || "") || null,
    origem: "cadastro_direto",
    observacoes_iniciais: String(formData.get("observacoes") || "") || null,
  }).select("id").single();
  if (error) {
    if (error.code === "23505") throw new Error("Já existe pessoa na equipe com esse CPF");
    throw new Error(error.message);
  }

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

  await logAudit({ usuario_id: perfil.id, usuario_nome: perfil.nome, acao: "cadastrou_equipe_direto", entidade_tipo: "equipe", entidade_id: membro.id });
  revalidatePath("/equipe");
  redirect(`/equipe/${membro.id}`);
}

export async function editarEquipe(equipeId: string, formData: FormData) {
  const perfil = await requireAcessoTotal();
  const supabase = await createClient();

  const { data: antes } = await supabase.from("equipe").select("*").eq("id", equipeId).single();

  const upd: Record<string, unknown> = {
    nome: String(formData.get("nome") || "").trim(),
    telefone: limparTelefone(String(formData.get("telefone") || "")),
    cargo: String(formData.get("cargo") || "").trim(),
    salario: lerSalario(formData),
    data_entrada: String(formData.get("data_entrada") || ""),
    status: lerStatusEquipe(formData),
  };

  const { error } = await supabase.from("equipe").update(upd).eq("id", equipeId);
  if (error) throw new Error(error.message);

  if (antes && antes.salario !== upd.salario) {
    await logAudit({ usuario_id: perfil.id, usuario_nome: perfil.nome, acao: "editou_salario", entidade_tipo: "equipe", entidade_id: equipeId, dados_antes: { salario: antes.salario }, dados_depois: { salario: upd.salario } });
  }

  // Dados bancários (upsert)
  const banco = String(formData.get("banco") || "").trim();
  const temAlgumDado = banco || formData.get("agencia") || formData.get("conta");
  if (temAlgumDado) {
    const { error: dbErr } = await supabase.from("dados_bancarios").upsert({
      equipe_id: equipeId,
      banco: banco || null,
      agencia: String(formData.get("agencia") || "") || null,
      conta: String(formData.get("conta") || "") || null,
      tipo_conta: String(formData.get("tipo_conta") || "") || null,
      nome_titular: String(formData.get("nome_titular") || "") || null,
      cpf_titular: String(formData.get("cpf_titular") || "") || null,
    }, { onConflict: "equipe_id" });
    if (dbErr) throw new Error(dbErr.message);
    await logAudit({ usuario_id: perfil.id, usuario_nome: perfil.nome, acao: "editou_dados_bancarios", entidade_tipo: "equipe", entidade_id: equipeId });
  }

  await logAudit({ usuario_id: perfil.id, usuario_nome: perfil.nome, acao: "editou_equipe", entidade_tipo: "equipe", entidade_id: equipeId });
  revalidatePath(`/equipe/${equipeId}`);
  revalidatePath("/equipe");
}

export async function desligarEquipe(equipeId: string, formData: FormData) {
  const perfil = await requireAcessoTotal();
  const dataSaida = String(formData.get("data_saida") || "");
  if (!dataSaida) throw new Error("Data de saída obrigatória");
  const supabase = await createClient();
  const { error } = await supabase.from("equipe").update({
    status: "desligado",
    data_saida: dataSaida,
    motivo_saida: String(formData.get("motivo") || "") || null,
  }).eq("id", equipeId);
  if (error) throw new Error(error.message);
  await logAudit({ usuario_id: perfil.id, usuario_nome: perfil.nome, acao: "desligou_equipe", entidade_tipo: "equipe", entidade_id: equipeId });
  revalidatePath("/equipe");
  redirect("/equipe");
}

export async function atualizarStatusBonus(formData: FormData) {
  const perfil = await requireAcessoTotal();
  const id = String(formData.get("id"));
  const status = String(formData.get("status"));
  const path = String(formData.get("path") || "/equipe");
  const supabase = await createClient();
  const upd: Record<string, unknown> = { status };
  if (status === "pago") upd.pago_em = new Date().toISOString();
  const { error } = await supabase.from("bonus_indicacao").update(upd).eq("id", id);
  if (error) throw new Error(error.message);
  await logAudit({ usuario_id: perfil.id, usuario_nome: perfil.nome, acao: "editou_bonus", entidade_tipo: "bonus", entidade_id: id, dados_depois: { status } });
  revalidatePath(path);
}
