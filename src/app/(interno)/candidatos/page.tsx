import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { formatarCpf } from "@/lib/cpf";
import { ETAPA_LABELS, diasDesde, fmtData } from "@/lib/constants";

export const dynamic = "force-dynamic";

const TABS = [
  { key: "ativos", label: "Em processo" },
  { key: "rejeitado", label: "Rejeitados" },
  { key: "efetivado", label: "Efetivados" },
] as const;

const LIMITES: Record<string, number> = {
  entrevista_online: 7,
  entrevista_presencial: 7,
  redacao_escrita: 7,
  em_treinamento: 15,
};

export default async function CandidatosPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const { tab = "ativos" } = await searchParams;
  const supabase = await createClient();

  let query = supabase.from("candidatos").select("*").order("etapa_atual_desde", { ascending: true });
  if (tab === "ativos") {
    query = query.in("status", ["entrevista_online", "entrevista_presencial", "redacao_escrita", "em_treinamento"]);
  } else {
    query = query.eq("status", tab);
  }
  const { data: candidatos } = await query;

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">Candidatos</h1>
      <div className="flex gap-1 border-b border-gray-200">
        {TABS.map((t) => (
          <Link key={t.key} href={`/candidatos?tab=${t.key}`}
            className={`px-4 py-2 text-sm font-medium border-b-2 ${tab === t.key ? "border-brand-600 text-brand-700" : "border-transparent text-gray-500"}`}>
            {t.label}
          </Link>
        ))}
      </div>
      <div className="space-y-3">
        {(candidatos || []).length === 0 && <p className="text-gray-400 text-sm py-8 text-center">Nenhum candidato.</p>}
        {(candidatos || []).map((c) => {
          const dias = diasDesde(c.etapa_atual_desde);
          const limite = LIMITES[c.status as string];
          const atrasado = tab === "ativos" && limite && dias > limite;
          return (
            <Link key={c.id} href={`/candidatos/${c.id}`} className={`card p-4 block hover:border-brand-300 ${atrasado ? "border-red-300" : ""}`}>
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div>
                  <p className="font-semibold">{c.nome}</p>
                  <p className="text-sm text-gray-500">CPF {formatarCpf(c.cpf)} · {c.vaga_pretendida || "—"}</p>
                </div>
                <div className="text-right text-sm">
                  <span className="badge bg-blue-100 text-blue-800">{ETAPA_LABELS[c.status as string] || c.status}</span>
                  {tab === "ativos" && (
                    <p className={`mt-1 ${atrasado ? "text-red-600 font-semibold" : "text-gray-400"}`}>
                      {atrasado ? `⚠️ Parado há ${dias} dias` : `Há ${dias} dia(s) na etapa`}
                    </p>
                  )}
                  {tab !== "ativos" && <p className="text-gray-400 mt-1">{fmtData(c.rejeitado_em || c.efetivado_em)}</p>}
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
