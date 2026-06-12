import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getPerfil } from "@/lib/auth";

// Gera URL assinada para currículos/redações (somente usuários logados)
export async function GET(req: NextRequest) {
  const perfil = await getPerfil();
  if (!perfil) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const bucket = req.nextUrl.searchParams.get("bucket");
  const path = req.nextUrl.searchParams.get("path");
  const download = req.nextUrl.searchParams.get("download") === "1";
  if (!bucket || !path || !["curriculos", "redacoes"].includes(bucket)) {
    return NextResponse.json({ error: "Parâmetros inválidos" }, { status: 400 });
  }

  const supabase = await createClient();
  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUrl(path, 300, download ? { download: true } : undefined);
  if (error || !data) return NextResponse.json({ error: "Arquivo não encontrado" }, { status: 404 });
  return NextResponse.redirect(data.signedUrl);
}
