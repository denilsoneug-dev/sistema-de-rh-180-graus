import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

export async function logAudit(params: {
  usuario_id?: string | null;
  usuario_nome?: string | null;
  acao: string;
  entidade_tipo?: string;
  entidade_id?: string;
  dados_antes?: unknown;
  dados_depois?: unknown;
}) {
  try {
    const admin = createAdminClient();
    await admin.from("audit_logs").insert({
      usuario_id: params.usuario_id ?? null,
      usuario_nome: params.usuario_nome ?? null,
      acao: params.acao,
      entidade_tipo: params.entidade_tipo ?? null,
      entidade_id: params.entidade_id ?? null,
      dados_antes: params.dados_antes ?? null,
      dados_depois: params.dados_depois ?? null,
    });
  } catch (e) {
    console.error("audit log falhou", e);
  }
}
