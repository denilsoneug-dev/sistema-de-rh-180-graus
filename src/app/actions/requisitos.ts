"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireAcessoTotal } from "@/lib/auth";
import { logAudit } from "@/lib/audit";

const DISP_VALIDAS = ["integral", "parcial", "nao_tenho"];

function triEstado(v: FormDataEntryValue | null): boolean | null {
  const s = String(v || "");
  if (s === "sim") return true;
  if (s === "nao") return false;
  return null; // "" = usar da ficha
}

function lerOverride(formData: FormData) {
  const disp = String(formData.get("req_disponibilidade") || "");
  const categoria = String(formData.get("req_cnh_categoria") || "").trim();
  return {
    req_disponibilidade: DISP_VALIDAS.includes(disp) ? disp : null,
    req_notebook: triEstado(formData.get("req_notebook")),
    req_veiculo: triEstado(formData.get("req_veiculo")),
    req_cnh: triEstado(formData.get("req_cnh")),
    req_cnh_categoria: categoria || null,
  };
}

export async function salvarRequisitosCandidato(candidatoId: string, formData: FormData) {
  const perfil = await requireAcessoTotal();
  const upd = lerOverride(formData);
  const supabase = await createClient();
  const { error } = await supabase.from("candidatos").update(upd).eq("id", candidatoId);
  if (error) throw new Error(error.message);
  await logAudit({
    usuario_id: perfil.id, usuario_nome: perfil.nome,
    acao: "editou_requisitos", entidade_tipo: "candidato", entidade_id: candidatoId, dados_depois: upd,
  });
  revalidatePath(`/candidatos/${candidatoId}`);
  revalidatePath("/candidatos");
}

export async function salvarRequisitosEquipe(equipeId: string, formData: FormData) {
  const perfil = await requireAcessoTotal();
  const upd = lerOverride(formData);
  const supabase = await createClient();
  const { error } = await supabase.from("equipe").update(upd).eq("id", equipeId);
  if (error) throw new Error(error.message);
  await logAudit({
    usuario_id: perfil.id, usuario_nome: perfil.nome,
    acao: "editou_requisitos", entidade_tipo: "equipe", entidade_id: equipeId, dados_depois: upd,
  });
  revalidatePath(`/equipe/${equipeId}`);
  revalidatePath("/equipe");
}
