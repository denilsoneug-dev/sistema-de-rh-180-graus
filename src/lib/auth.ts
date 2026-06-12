import "server-only";
import { createClient } from "@/lib/supabase/server";

export type Perfil = {
  id: string;
  user_id: string;
  nome: string;
  email: string;
  papel: "acesso_total" | "visualizacao";
  ativo: boolean;
};

export async function getPerfil(): Promise<Perfil | null> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase
    .from("perfis")
    .select("*")
    .eq("user_id", user.id)
    .eq("ativo", true)
    .single();
  return (data as Perfil) || null;
}

export async function requirePerfil(): Promise<Perfil> {
  const p = await getPerfil();
  if (!p) throw new Error("Não autenticado");
  return p;
}

export async function requireAcessoTotal(): Promise<Perfil> {
  const p = await requirePerfil();
  if (p.papel !== "acesso_total") throw new Error("Sem permissão");
  return p;
}
