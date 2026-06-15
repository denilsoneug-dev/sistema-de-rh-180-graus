export const STATUS_RECRUTAMENTO = [
  "nova_ficha",
  "em_analise",
  "chamado_entrevista",
  "entrevista_marcada",
  "aprovado",
  "reprovado",
  "banco_de_talentos",
] as const;

export type StatusRecrutamento = (typeof STATUS_RECRUTAMENTO)[number];

export const STATUS_RECRUTAMENTO_LABELS: Record<StatusRecrutamento, string> = {
  nova_ficha: "Nova ficha",
  em_analise: "Em análise",
  chamado_entrevista: "Chamado para entrevista",
  entrevista_marcada: "Entrevista marcada",
  aprovado: "Aprovado",
  reprovado: "Reprovado",
  banco_de_talentos: "Banco de talentos",
};

export const STATUS_RECRUTAMENTO_CLASSES: Record<StatusRecrutamento, string> = {
  nova_ficha: "bg-brand-100 text-brand-800 ring-brand-600/15",
  em_analise: "bg-amber-100 text-amber-800 ring-amber-600/15",
  chamado_entrevista: "bg-purple-100 text-purple-800 ring-purple-600/15",
  entrevista_marcada: "bg-indigo-100 text-indigo-800 ring-indigo-600/15",
  aprovado: "bg-emerald-100 text-emerald-800 ring-emerald-600/15",
  reprovado: "bg-red-100 text-red-700 ring-red-600/15",
  banco_de_talentos: "bg-slate-200 text-slate-700 ring-slate-600/15",
};

export function statusRecrutamentoValido(value: string): value is StatusRecrutamento {
  return STATUS_RECRUTAMENTO.includes(value as StatusRecrutamento);
}

// Cor do indicador dos 4 requisitos principais: verde (forte) / ambar (medio) / vermelho (fraco)
export function requisitosBadgeClasse(pontos: number): string {
  if (pontos >= 4) return "bg-emerald-100 text-emerald-800 ring-emerald-600/15";
  if (pontos >= 2) return "bg-amber-100 text-amber-800 ring-amber-600/15";
  return "bg-red-100 text-red-700 ring-red-600/15";
}

import type { ResumoRequisitos } from "@/lib/constants";

export type FichaPainel = {
  id: string;
  nome: string;
  idade: number | null;
  telefone: string;
  email: string;
  statusRecrutamento: StatusRecrutamento;
  statusFicha: string;
  enviadaEm: string | null;
  curriculoUrl: string | null;
  requisitos: number;
  resumoReq?: ResumoRequisitos | null;
  estadoAtual?: string | null;
};

export function filtrarFichasPainel(
  fichas: FichaPainel[],
  filtros: { busca: string; status: string; curriculo: string },
) {
  const busca = filtros.busca.trim().toLocaleLowerCase("pt-BR");
  const telefoneBusca = busca.replace(/\D/g, "");

  return fichas.filter((ficha) => {
    const nomeConfere = !busca || ficha.nome.toLocaleLowerCase("pt-BR").includes(busca);
    const telefoneConfere = Boolean(telefoneBusca) && ficha.telefone.replace(/\D/g, "").includes(telefoneBusca);
    const buscaConfere = !busca || nomeConfere || telefoneConfere;
    const statusConfere = !filtros.status || ficha.statusRecrutamento === filtros.status;
    const curriculoConfere = filtros.curriculo !== "com" || Boolean(ficha.curriculoUrl);
    return buscaConfere && statusConfere && curriculoConfere;
  });
}
