import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getPerfil } from "@/lib/auth";
import { cpfPorPapel } from "@/lib/cpf";
import { ETAPA_LABELS, diasDesde, fmtData } from "@/lib/constants";
import { mapResumosPorCandidatos } from "@/lib/requisitos";
import { ResumoRequisitos } from "@/components/ResumoRequisitos";
import { PainelCandidatos, type CandidatoEmProcesso } from "@/components/PainelCandidatos";
import { STATUS_CANDIDATOS_EM_PROCESSO } from "@/lib/equipe-treinamento";

export const dynamic = "force-dynamic";

const TABS = [
  { key: "ativos", label: "Em processo" },
  { key: "rejeitado", label: "Rejeitados" },
  { key: "treinamento_encerrado", label: "Encerrados" },
  { key: "efetivado", label: "Contratados" },
] as const;

const LIMITES: Record<string, number> = {
  entrevista_online: 7,
  entrevista_presencial: 7,
  redacao_escrita: 7,
};

export default async function CandidatosPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const { tab = "ativos" } = await searchParams;
  const perfil = await getPerfil();
  const acessoTotal = perfil?.papel === "acesso_total";
  const supabase = await createClient();

  let query = supabase.from("candidatos").select("*").order("etapa_atual_desde", { ascending: true });
  if (tab === "ativos") {
    query = query.in("status", [...STATUS_CANDIDATOS_EM_PROCESSO]);
  } else {
    query = query.eq("status", tab);
  }
  const { data: candidatos } = await query;
  const resumos = await mapResumosPorCandidatos(supabase, candidatos || []);

  // Aba "Em processo": prepara a lista para o painel com filtros + contagem de treinamento.
  let listaEmProcesso: CandidatoEmProcesso[] = [];
  let emTreinamentoCount = 0;
  if (tab === "ativos") {
    listaEmProcesso = (candidatos || []).map((c) => ({
      id: c.id,
      nome: c.nome,
      cpf: c.cpf,
      vaga_pretendida: c.vaga_pretendida,
      status: c.status,
      etapa_atual_desde: c.etapa_atual_desde,
      resumo: resumos.get(c.id) ?? null,
    }));
    const { count } = await supabase
      .from("candidatos").select("id", { count: "exact", head: true }).eq("status", "em_treinamento");
    emTreinamentoCount = count ?? 0;
  }

  // Para a aba "Contratados": localizar o registro de Equipe vinculado (origem = candidato).
  const equipePorCandidato = new Map<string, { id: string }>();
  if (tab === "efetivado" && (candidatos || []).length > 0) {
    const ids = (candidatos || []).map((c) => c.id);
    const { data: vinculos } = await supabase
      .from("equipe").select("id, candidato_origem_id").in("candidato_origem_id", ids);
    for (const v of vinculos || []) {
      if (v.candidato_origem_id) equipePorCandidato.set(v.candidato_origem_id as string, { id: v.id as string });
    }
  }

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
      {tab === "efetivado" && (
        <div className="card border-l-4 border-l-emerald-500 bg-emerald-50/60 p-3 text-sm text-emerald-800">
          Histórico de contratações: estas pessoas <span className="font-semibold">já fazem parte da Equipe</span>. Não são candidatos em seleção.
        </div>
      )}
      {tab === "treinamento_encerrado" && (
        <div className="card border-l-4 border-l-amber-500 bg-amber-50/60 p-3 text-sm text-amber-800">
          Histórico: pessoas que <span className="font-semibold">passaram pelo treinamento mas não foram aprovadas</span> para efetivação. Diferente de rejeitados na seleção.
        </div>
      )}
      {tab === "ativos" ? (
        <PainelCandidatos candidatos={listaEmProcesso} acessoTotal={acessoTotal} emTreinamentoCount={emTreinamentoCount} />
      ) : (
      <div className="space-y-3">
        {(candidatos || []).length === 0 && <p className="text-gray-400 text-sm py-8 text-center">Nenhum candidato.</p>}
        {(candidatos || []).map((c) => {
          const dias = diasDesde(c.etapa_atual_desde);
          const limite = LIMITES[c.status as string];
          const atrasado = tab === "ativos" && limite && dias > limite;
          const contratado = tab === "efetivado";
          const equipeRef = contratado ? equipePorCandidato.get(c.id) : undefined;
          const href = equipeRef ? `/equipe/${equipeRef.id}` : `/candidatos/${c.id}`;
          return (
            <Link key={c.id} href={href} className={`card p-4 block hover:border-brand-300 ${atrasado ? "border-red-300" : ""}`}>
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div>
                  <p className="font-semibold">{c.nome}</p>
                  <p className="text-sm text-gray-500">CPF {cpfPorPapel(c.cpf, acessoTotal)} · {c.vaga_pretendida || "—"}</p>
                </div>
                <div className="text-right text-sm">
                  {contratado ? (
                    <span className="badge bg-emerald-100 text-emerald-800 ring-emerald-600/15">Contratado · na Equipe</span>
                  ) : c.status === "treinamento_encerrado" ? (
                    <span className="badge bg-amber-100 text-amber-800 ring-amber-600/15">Treinamento encerrado</span>
                  ) : (
                    <span className="badge bg-blue-100 text-blue-800">{ETAPA_LABELS[c.status as string] || c.status}</span>
                  )}
                  {tab === "ativos" && (
                    <p className={`mt-1 ${atrasado ? "text-red-600 font-semibold" : "text-gray-400"}`}>
                      {atrasado ? `⚠️ Parado há ${dias} dias` : `Há ${dias} dia(s) na etapa`}
                    </p>
                  )}
                  {tab !== "ativos" && <p className="text-gray-400 mt-1">{fmtData(c.rejeitado_em || c.efetivado_em)}</p>}
                </div>
              </div>
              <div className="mt-3 border-t border-slate-100 pt-3 flex flex-wrap items-center justify-between gap-2">
                <ResumoRequisitos variante="compacto" resumo={resumos.get(c.id) ?? null} />
                {contratado && (
                  <span className="text-sm font-medium text-brand-700">
                    {equipeRef ? "Ver na Equipe →" : "Registro de equipe não localizado"}
                  </span>
                )}
              </div>
            </Link>
          );
        })}
      </div>
      )}
    </div>
  );
}
