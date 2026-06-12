"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireAcessoTotal } from "@/lib/auth";
import { logAudit } from "@/lib/audit";

export async function criarObservacao(formData: FormData) {
  const perfil = await requireAcessoTotal();
  const texto = String(formData.get("texto") || "").trim();
  const entidade_tipo = String(formData.get("entidade_tipo"));
  const entidade_id = String(formData.get("entidade_id"));
  const path = String(formData.get("path") || "/");
  if (!texto) return;

  const supabase = await createClient();
  const { error } = await supabase.from("observacoes").insert({
    entidade_tipo, entidade_id, texto,
    criado_por: perfil.id, criado_por_nome: perfil.nome,
  });
  if (error) throw new Error(error.message);
  await logAudit({ usuario_id: perfil.id, usuario_nome: perfil.nome, acao: "criou_observacao", entidade_tipo, entidade_id });
  revalidatePath(path);
}

export async function editarObservacao(formData: FormData) {
  const perfil = await requireAcessoTotal();
  const id = String(formData.get("id"));
  const texto = String(formData.get("texto") || "").trim();
  const path = String(formData.get("path") || "/");
  if (!texto) return;

  const supabase = await createClient();
  const { error } = await supabase.from("observacoes")
    .update({ texto, editado_por: perfil.id, editado_em: new Date().toISOString() })
    .eq("id", id);
  if (error) throw new Error(error.message);
  await logAudit({ usuario_id: perfil.id, usuario_nome: perfil.nome, acao: "editou_observacao", entidade_tipo: "observacao", entidade_id: id });
  revalidatePath(path);
}

export async function apagarObservacao(formData: FormData) {
  const perfil = await requireAcessoTotal();
  const id = String(formData.get("id"));
  const path = String(formData.get("path") || "/");
  const supabase = await createClient();
  const { error } = await supabase.from("observacoes")
    .update({ apagado: true, apagado_por: perfil.id, apagado_em: new Date().toISOString() })
    .eq("id", id);
  if (error) throw new Error(error.message);
  await logAudit({ usuario_id: perfil.id, usuario_nome: perfil.nome, acao: "apagou_observacao", entidade_tipo: "observacao", entidade_id: id });
  revalidatePath(path);
}
