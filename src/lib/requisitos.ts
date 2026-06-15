import {
  resumoRequisitos,
  resumoComOverride,
  REQUISITOS_SELECT,
  type ResumoRequisitos,
  type RequisitosOverride,
} from "@/lib/constants";

// Cliente Supabase tipado como `any` de propósito: estes helpers só fazem
// leituras simples e são reutilizados em várias páginas server-side, evitando
// acoplamento com os tipos genéricos profundos do supabase-js.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SupabaseLike = any;

type CamposFicha = Parameters<typeof resumoRequisitos>[0];

// ficha_id -> campos brutos de requisitos da ficha (1 query).
async function fetchCamposFicha(
  supabase: SupabaseLike,
  fichaIds: (string | null | undefined)[],
): Promise<Map<string, CamposFicha>> {
  const ids = [...new Set(fichaIds.filter((x): x is string => !!x))];
  const map = new Map<string, CamposFicha>();
  if (ids.length === 0) return map;
  const { data } = await supabase
    .from("ficha_respostas")
    .select(`ficha_id, ${REQUISITOS_SELECT}`)
    .in("ficha_id", ids);
  for (const row of (data || []) as Record<string, unknown>[]) {
    if (row.ficha_id) map.set(row.ficha_id as string, row as CamposFicha);
  }
  return map;
}

// ficha_id -> resumo (somente ficha, sem override). Usado na Busca para fichas.
export async function mapResumosPorFicha(
  supabase: SupabaseLike,
  fichaIds: (string | null | undefined)[],
): Promise<Map<string, ResumoRequisitos>> {
  const campos = await fetchCamposFicha(supabase, fichaIds);
  const map = new Map<string, ResumoRequisitos>();
  for (const [fid, c] of campos) {
    const r = resumoRequisitos(c);
    if (r) map.set(fid, r);
  }
  return map;
}

type LinhaCandidato = { id: string; ficha_id?: string | null } & RequisitosOverride;

// candidato.id -> resumo (ficha de origem + override do candidato).
export async function mapResumosPorCandidatos(
  supabase: SupabaseLike,
  candidatos: LinhaCandidato[],
): Promise<Map<string, ResumoRequisitos>> {
  const campos = await fetchCamposFicha(supabase, candidatos.map((c) => c.ficha_id));
  const map = new Map<string, ResumoRequisitos>();
  for (const c of candidatos) {
    const r = resumoComOverride(c.ficha_id ? campos.get(c.ficha_id) : null, c);
    if (r) map.set(c.id, r);
  }
  return map;
}

type LinhaEquipe = { id: string; candidato_origem_id: string | null } & RequisitosOverride;

// equipe.id -> resumo (ficha via candidato de origem + override do membro).
export async function mapResumosPorEquipe(
  supabase: SupabaseLike,
  membros: LinhaEquipe[],
): Promise<Map<string, ResumoRequisitos>> {
  const map = new Map<string, ResumoRequisitos>();

  const candIds = [...new Set(membros.map((m) => m.candidato_origem_id).filter((x): x is string => !!x))];
  const candParaFicha = new Map<string, string>();
  if (candIds.length > 0) {
    const { data: cands } = await supabase.from("candidatos").select("id, ficha_id").in("id", candIds);
    for (const c of (cands || []) as Record<string, unknown>[]) {
      if (c.id && c.ficha_id) candParaFicha.set(c.id as string, c.ficha_id as string);
    }
  }
  const campos = await fetchCamposFicha(supabase, [...candParaFicha.values()]);

  for (const m of membros) {
    const fichaId = m.candidato_origem_id ? candParaFicha.get(m.candidato_origem_id) : undefined;
    const base = fichaId ? campos.get(fichaId) : null;
    const r = resumoComOverride(base ?? null, m);
    if (r) map.set(m.id, r);
  }
  return map;
}
