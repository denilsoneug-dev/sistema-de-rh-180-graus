import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getPerfil } from "@/lib/auth";

const BUCKETS_PERMITIDOS = ["curriculos", "redacoes"] as const;
type Bucket = (typeof BUCKETS_PERMITIDOS)[number];

// Confere que o path solicitado pertence a um registro existente (sem path arbitrário).
async function pathVinculado(
  supabase: Awaited<ReturnType<typeof createClient>>,
  bucket: Bucket,
  path: string,
): Promise<boolean> {
  if (bucket === "curriculos") {
    const { data: ficha } = await supabase
      .from("fichas").select("id").eq("curriculo_url", path).limit(1).maybeSingle();
    if (ficha) return true;
    const { data: cand } = await supabase
      .from("candidatos").select("id").eq("curriculo_url", path).limit(1).maybeSingle();
    return !!cand;
  }
  // redacoes -> candidato_etapas.arquivo_url
  const { data: etapa } = await supabase
    .from("candidato_etapas").select("id").eq("arquivo_url", path).limit(1).maybeSingle();
  return !!etapa;
}

// Gera URL assinada para currículos/redações.
// Política Fase A:
//  - exige usuário autenticado (401);
//  - exige papel "acesso_total" — visualização NÃO baixa currículo/redação (403);
//  - valida que o path pertence a um registro existente (404 se não vinculado);
//  - bucket permanece privado; service role nunca vai ao cliente.
export async function GET(req: NextRequest) {
  const perfil = await getPerfil();
  if (!perfil) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  if (perfil.papel !== "acesso_total") {
    return NextResponse.json({ error: "Sem permissão para acessar este arquivo" }, { status: 403 });
  }

  const bucketParam = req.nextUrl.searchParams.get("bucket");
  const path = req.nextUrl.searchParams.get("path");
  const download = req.nextUrl.searchParams.get("download") === "1";

  if (!bucketParam || !path || !BUCKETS_PERMITIDOS.includes(bucketParam as Bucket)) {
    return NextResponse.json({ error: "Parâmetros inválidos" }, { status: 400 });
  }
  const bucket = bucketParam as Bucket;

  const supabase = await createClient();

  if (!(await pathVinculado(supabase, bucket, path))) {
    return NextResponse.json({ error: "Arquivo não encontrado" }, { status: 404 });
  }

  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUrl(path, 300, download ? { download: true } : undefined);
  if (error || !data) return NextResponse.json({ error: "Arquivo não encontrado" }, { status: 404 });
  return NextResponse.redirect(data.signedUrl);
}
