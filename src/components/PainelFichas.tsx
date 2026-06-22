"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { atualizarStatusRecrutamento } from "@/app/actions/fichas";
import { fmtData, STATUS_FICHA_LABELS } from "@/lib/constants";
import { ResumoRequisitos } from "@/components/ResumoRequisitos";
import {
  FichaPainel,
  filtrarFichasPainel,
  STATUS_RECRUTAMENTO_FICHA,
  STATUS_RECRUTAMENTO_CLASSES,
  STATUS_RECRUTAMENTO_LABELS,
} from "@/lib/rh";

export function PainelFichas({ fichas, podeEditar }: { fichas: FichaPainel[]; podeEditar: boolean }) {
  const [busca, setBusca] = useState("");
  const [status, setStatus] = useState("");
  const [curriculo, setCurriculo] = useState("");
  const filtradas = useMemo(
    () => filtrarFichasPainel(fichas, { busca, status, curriculo }),
    [fichas, busca, status, curriculo],
  );

  return (
    <div className="space-y-4">
      <div className="card p-4 grid gap-3 sm:grid-cols-3">
        <div>
          <label className="label" htmlFor="busca-fichas">Nome ou telefone</label>
          <input id="busca-fichas" className="input" value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar candidato" />
        </div>
        <div>
          <label className="label" htmlFor="filtro-status-rh">Status</label>
          <select id="filtro-status-rh" className="input" value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">Todos</option>
            {STATUS_RECRUTAMENTO_FICHA.map((item) => <option key={item} value={item}>{STATUS_RECRUTAMENTO_LABELS[item]}</option>)}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="filtro-curriculo">Currículo</label>
          <select id="filtro-curriculo" className="input" value={curriculo} onChange={(e) => setCurriculo(e.target.value)}>
            <option value="">Todos</option>
            <option value="com">Com currículo</option>
          </select>
        </div>
      </div>

      <p className="text-sm text-gray-500" aria-live="polite">{filtradas.length} candidato(s)</p>
      {filtradas.length === 0 && <p className="text-gray-400 text-sm py-8 text-center">Nenhuma ficha encontrada.</p>}

      <div className="space-y-3">
        {filtradas.map((ficha, i) => (
          <article
            key={ficha.id}
            style={{ animationDelay: `${Math.min(i, 10) * 40}ms` }}
            className="card card-hover p-4 space-y-3 animate-fade-up"
            data-testid="ficha-card"
          >
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <h2 className="font-semibold break-words">{ficha.nome}</h2>
                <div className="mt-1 grid gap-1 text-sm text-gray-600 sm:grid-cols-2 sm:gap-x-6">
                  <p>Idade: {ficha.idade ?? "—"}</p>
                  <p>Telefone: {ficha.telefone || "—"}</p>
                  <p className="break-all">E-mail: {ficha.email || "—"}</p>
                  <p>Enviada: {fmtData(ficha.enviadaEm)}</p>
                </div>
              </div>
              <div className="flex flex-col items-start gap-2 sm:items-end">
                <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                  <span className={`badge ${STATUS_RECRUTAMENTO_CLASSES[ficha.statusRecrutamento]}`}>
                    {STATUS_RECRUTAMENTO_LABELS[ficha.statusRecrutamento]}
                  </span>
                  <span className={`badge ${ficha.curriculoUrl ? "bg-emerald-100 text-emerald-800 ring-emerald-600/15" : "bg-slate-100 text-slate-600 ring-slate-600/15"}`}>
                    {ficha.curriculoUrl ? "Com currículo" : "Sem currículo"}
                  </span>
                  {ficha.estadoAtual && (
                    <span className="badge bg-brand-100 text-brand-800 ring-brand-600/15">Estado atual: {ficha.estadoAtual}</span>
                  )}
                  {ficha.candidatoId && (
                    <span className="badge bg-emerald-100 text-emerald-800 ring-emerald-600/15">Já convertido para candidato</span>
                  )}
                </div>
                <ResumoRequisitos variante="compacto" resumo={ficha.resumoReq ?? null} pontos={ficha.requisitos} />
              </div>
            </div>

            <div className="flex flex-col gap-2 border-t pt-3 sm:flex-row sm:items-end sm:justify-between">
              <p className="text-xs text-gray-400">Situação da ficha: {STATUS_FICHA_LABELS[ficha.statusFicha] || ficha.statusFicha}</p>
              <div className="flex flex-col gap-2 sm:flex-row">
                {podeEditar && ficha.statusFicha === "recebida" && (
                  <form action={atualizarStatusRecrutamento.bind(null, ficha.id)} className="flex gap-2">
                    <label className="sr-only" htmlFor={`status-${ficha.id}`}>Alterar status de {ficha.nome}</label>
                    <select key={ficha.statusRecrutamento} id={`status-${ficha.id}`} name="status_recrutamento" defaultValue={STATUS_RECRUTAMENTO_FICHA.includes(ficha.statusRecrutamento as typeof STATUS_RECRUTAMENTO_FICHA[number]) ? ficha.statusRecrutamento : "nova_ficha"} className="input !py-2 text-sm min-w-0">
                      {STATUS_RECRUTAMENTO_FICHA.map((item) => <option key={item} value={item}>{STATUS_RECRUTAMENTO_LABELS[item]}</option>)}
                    </select>
                    <button className="btn-secondary whitespace-nowrap">Salvar</button>
                  </form>
                )}
                <Link href={`/fichas/${ficha.id}`} className="btn-primary">Ver ficha</Link>
                {ficha.candidatoId && <Link href={`/candidatos/${ficha.candidatoId}`} className="btn-secondary">Ver candidato</Link>}
              </div>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
