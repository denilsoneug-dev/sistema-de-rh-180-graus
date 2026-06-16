"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { cpfPorPapel } from "@/lib/cpf";
import { ETAPA_LABELS, diasDesde, type ResumoRequisitos as ResumoTipo } from "@/lib/constants";

export type CandidatoEmProcesso = {
  id: string;
  nome: string;
  cpf: string | null;
  vaga_pretendida: string | null;
  status: string;
  etapa_atual_desde: string | null;
  resumo: ResumoTipo | null;
};

const LIMITES: Record<string, number> = {
  entrevista_online: 7,
  entrevista_presencial: 7,
  redacao_escrita: 7,
};

const FASES = [
  { key: "todos", label: "Todos" },
  { key: "entrevista_online", label: "Entrevista online" },
  { key: "entrevista_presencial", label: "Entrevista presencial" },
  { key: "redacao_escrita", label: "Redação escrita" },
] as const;

type Pontuacao = "todos" | "req4" | "req3";
const PONTUACOES: { key: Pontuacao; label: string }[] = [
  { key: "todos", label: "Todas" },
  { key: "req4", label: "4 de 4" },
  { key: "req3", label: "3 de 4" },
];

type ReqItem = "viajar" | "notebook" | "veiculo" | "cnh";
const REQ_ITENS: { key: ReqItem; label: string; icone: string }[] = [
  { key: "viajar", label: "Viajar", icone: "✈" },
  { key: "notebook", label: "Notebook", icone: "💻" },
  { key: "veiculo", label: "Veículo", icone: "🚗" },
  { key: "cnh", label: "CNH", icone: "🪪" },
];

function pontuacaoOk(r: ResumoTipo | null, p: Pontuacao): boolean {
  if (p === "todos") return true;
  if (!r) return false;
  return p === "req4" ? r.pontos === 4 : r.pontos === 3;
}

function possuiItem(r: ResumoTipo | null, item: ReqItem): boolean {
  if (!r) return false;
  return r.itens[item === "viajar" ? "disponibilidade" : item].estado === "ok";
}

// "Sim — B" -> "Sim, categoria B"
function rotuloCnh(label: string): string {
  const m = label.match(/^Sim\s*—\s*(.+)$/);
  return m ? `Sim, categoria ${m[1]}` : label;
}

const COR_ESTADO: Record<string, string> = {
  ok: "bg-emerald-50 text-emerald-700 ring-emerald-600/15",
  atencao: "bg-amber-50 text-amber-700 ring-amber-600/15",
  negativo: "bg-slate-100 text-slate-500 ring-slate-500/10",
};

function RequisitoChip({ rotulo, valor, estado }: { rotulo: string; valor: string; estado: string }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-lg px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${COR_ESTADO[estado] || COR_ESTADO.negativo}`}>
      <span className="opacity-70">{rotulo}:</span> {estado === "negativo" ? "✕" : estado === "atencao" ? "!" : "✓"} {valor}
    </span>
  );
}

export function PainelCandidatos({
  candidatos,
  acessoTotal,
  emTreinamentoCount,
}: {
  candidatos: CandidatoEmProcesso[];
  acessoTotal: boolean;
  emTreinamentoCount: number;
}) {
  const [fase, setFase] = useState<string>("todos");
  const [pontuacao, setPontuacao] = useState<Pontuacao>("todos");
  const [reqs, setReqs] = useState<Set<ReqItem>>(new Set());
  const [busca, setBusca] = useState("");

  const temFiltro = fase !== "todos" || pontuacao !== "todos" || reqs.size > 0 || busca.trim() !== "";

  function toggleReq(item: ReqItem) {
    setReqs((atual) => {
      const novo = new Set(atual);
      if (novo.has(item)) novo.delete(item);
      else novo.add(item);
      return novo;
    });
  }
  function limpar() {
    setFase("todos");
    setPontuacao("todos");
    setReqs(new Set());
    setBusca("");
  }

  const faseCount = (key: string) =>
    key === "todos" ? candidatos.length : candidatos.filter((c) => c.status === key).length;

  const porFase = useMemo(
    () => (fase === "todos" ? candidatos : candidatos.filter((c) => c.status === fase)),
    [candidatos, fase],
  );

  // Contadores das pontuações dentro da fase atual.
  const pontuacaoCount = (p: Pontuacao) => porFase.filter((c) => pontuacaoOk(c.resumo, p)).length;
  // Contador de cada requisito dentro da fase atual (quantos possuem).
  const itemCount = (item: ReqItem) => porFase.filter((c) => possuiItem(c.resumo, item)).length;

  const filtrados = useMemo(() => {
    const termo = busca.trim().toLocaleLowerCase("pt-BR");
    const cpfBusca = termo.replace(/\D/g, "");
    const itens = [...reqs];
    return porFase.filter((c) => {
      if (!pontuacaoOk(c.resumo, pontuacao)) return false;
      if (itens.some((item) => !possuiItem(c.resumo, item))) return false; // precisa ter TODOS os marcados
      if (!termo) return true;
      const nomeOk = c.nome.toLocaleLowerCase("pt-BR").includes(termo);
      const cpfOk = cpfBusca.length >= 3 && (c.cpf || "").replace(/\D/g, "").includes(cpfBusca);
      return nomeOk || cpfOk;
    });
  }, [porFase, pontuacao, reqs, busca]);

  return (
    <div className="space-y-4">
      {/* Filtro por fase */}
      <div>
        <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-400">Fase do processo</p>
        <div className="flex gap-2 overflow-x-auto pb-1">
          {FASES.map((f) => {
            const ativo = fase === f.key;
            return (
              <button
                key={f.key}
                type="button"
                onClick={() => setFase(f.key)}
                className={`shrink-0 rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${
                  ativo ? "bg-brand-600 text-white shadow-soft" : "bg-white text-slate-600 ring-1 ring-inset ring-slate-200 hover:bg-slate-50"
                }`}
              >
                {f.label} <span className={ativo ? "opacity-80" : "text-slate-400"}>({faseCount(f.key)})</span>
              </button>
            );
          })}
          <Link
            href="/equipe?tab=em_treinamento"
            className="shrink-0 rounded-full px-3 py-1.5 text-sm font-medium bg-white text-brand-700 ring-1 ring-inset ring-brand-200 hover:bg-brand-50"
            title="Em treinamento já é operação — fica na Equipe"
          >
            Em treinamento ({emTreinamentoCount}) ›
          </Link>
        </div>
      </div>

      {/* Filtros de requisitos — dois grupos claros */}
      <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-3 space-y-3">
        {/* Pontuação: escolha única (segmented) */}
        <div className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:gap-3">
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-400 sm:w-28 sm:shrink-0">Pontuação</span>
          <div className="inline-flex rounded-lg bg-white p-0.5 ring-1 ring-inset ring-slate-200 self-start">
            {PONTUACOES.map((p) => {
              const ativo = pontuacao === p.key;
              return (
                <button
                  key={p.key}
                  type="button"
                  onClick={() => setPontuacao(p.key)}
                  className={`rounded-md px-3 py-1 text-sm font-medium transition-colors ${
                    ativo ? "bg-brand-600 text-white shadow-soft" : "text-slate-600 hover:bg-slate-100"
                  }`}
                >
                  {p.label} <span className={ativo ? "opacity-80" : "text-slate-400"}>({pontuacaoCount(p.key)})</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Possui requisito: multi-seleção (combina) */}
        <div className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:gap-3">
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-400 sm:w-28 sm:shrink-0">Possui</span>
          <div className="flex flex-wrap gap-2">
            {REQ_ITENS.map((item) => {
              const ativo = reqs.has(item.key);
              return (
                <button
                  key={item.key}
                  type="button"
                  aria-pressed={ativo}
                  onClick={() => toggleReq(item.key)}
                  className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${
                    ativo
                      ? "bg-emerald-600 text-white shadow-soft"
                      : "bg-white text-slate-600 ring-1 ring-inset ring-slate-200 hover:bg-slate-50"
                  }`}
                >
                  <span aria-hidden>{ativo ? "✓" : item.icone}</span>
                  {item.label}
                  <span className={ativo ? "opacity-80" : "text-slate-400"}>({itemCount(item.key)})</span>
                </button>
              );
            })}
          </div>
        </div>

        {reqs.size > 0 && (
          <p className="text-xs text-slate-500">Mostrando quem possui {reqs.size > 1 ? "todos os requisitos marcados" : "o requisito marcado"}.</p>
        )}
      </div>

      {/* Busca local + limpar */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <input
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          className="input"
          placeholder="Filtrar por nome ou CPF nesta lista..."
          aria-label="Filtrar candidatos em processo"
        />
        {temFiltro && (
          <button type="button" onClick={limpar} className="btn-secondary whitespace-nowrap">
            Limpar filtros
          </button>
        )}
      </div>

      <p className="text-sm text-slate-500" aria-live="polite">{filtrados.length} candidato(s)</p>

      {filtrados.length === 0 ? (
        <p className="text-slate-400 text-sm py-8 text-center">Nenhum candidato encontrado com esses filtros.</p>
      ) : (
        <div className="space-y-3">
          {filtrados.map((c) => {
            const dias = diasDesde(c.etapa_atual_desde);
            const limite = LIMITES[c.status];
            const atrasado = !!limite && dias > limite;
            const r = c.resumo;
            return (
              <Link
                key={c.id}
                href={`/candidatos/${c.id}`}
                className={`card card-hover p-4 block ${atrasado ? "border-red-300" : ""}`}
              >
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="min-w-0">
                    <p className="font-semibold break-words">{c.nome}</p>
                    <p className="text-sm text-slate-500">CPF {cpfPorPapel(c.cpf, acessoTotal)} · {c.vaga_pretendida || "—"}</p>
                  </div>
                  <div className="text-right text-sm shrink-0">
                    <span className="badge bg-blue-100 text-blue-800">{ETAPA_LABELS[c.status] || c.status}</span>
                    <p className={`mt-1 ${atrasado ? "text-red-600 font-semibold" : "text-slate-400"}`}>
                      {atrasado ? `⚠️ Parado há ${dias} dias` : `Há ${dias} dia(s) na etapa`}
                    </p>
                  </div>
                </div>

                <div className="mt-3 border-t border-slate-100 pt-3">
                  {r ? (
                    <>
                      <span className="badge bg-brand-50 text-brand-700 ring-brand-600/15 mb-2">★ {r.pontos}/4 requisitos</span>
                      <div className="flex flex-wrap gap-1.5">
                        <RequisitoChip rotulo="Viajar" valor={r.itens.disponibilidade.label} estado={r.itens.disponibilidade.estado} />
                        <RequisitoChip rotulo="Notebook" valor={r.itens.notebook.label} estado={r.itens.notebook.estado} />
                        <RequisitoChip rotulo="Veículo" valor={r.itens.veiculo.label} estado={r.itens.veiculo.estado} />
                        <RequisitoChip rotulo="CNH" valor={rotuloCnh(r.itens.cnh.label)} estado={r.itens.cnh.estado} />
                      </div>
                    </>
                  ) : (
                    <span className="text-xs text-slate-400">Requisitos não informados</span>
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
