import { formatarCpf, formatarTelefone, limparCpf, limparTelefone, mascararCpf } from "@/lib/cpf";
import { ETAPA_LABELS, fmtMoeda, STATUS_EQUIPE_LABELS } from "@/lib/constants";

export type PerfilExportacao = "acesso_total" | "visualizacao";

export type EquipeExportRow = {
  id: string;
  origem: "equipe" | "treinamento";
  nome: string;
  telefone: string;
  cpf: string;
  cargo: string;
  status: string;
  dataEntrada: string;
  dataInicioTreinamento: string;
  dataEfetivacao: string;
  quemIndicou: string;
  quemSelecionou: string;
  observacoes: string;
  salario?: string;
  bonusIndicacao?: string;
};

export type EquipeRaw = {
  id: string;
  nome: string | null;
  cpf: string | null;
  telefone: string | null;
  cargo: string | null;
  salario?: number | null;
  data_entrada: string | null;
  status: string | null;
  origem?: string | null;
  candidato_origem_id?: string | null;
  indicado_por_equipe_id?: string | null;
  observacoes_iniciais?: string | null;
  criado_em?: string | null;
};

export type CandidatoTreinamentoRaw = {
  id: string;
  nome: string | null;
  cpf: string | null;
  telefone: string | null;
  vaga_pretendida: string | null;
  status: string | null;
  ficha_id?: string | null;
  indicado_por_equipe_id?: string | null;
  etapa_atual_desde?: string | null;
  efetivado_em?: string | null;
  criado_em?: string | null;
};

export type EtapaTreinamentoRaw = {
  candidato_id: string;
  data: string | null;
  criado_em: string | null;
};

export type ObservacaoExportRaw = {
  entidade_tipo: "equipe" | "candidato" | string;
  entidade_id: string;
  texto: string | null;
  criado_por_nome?: string | null;
  criado_em?: string | null;
};

export type AuditoriaExportRaw = {
  entidade_tipo: "ficha" | "candidato" | string;
  entidade_id: string;
  usuario_nome: string | null;
  criado_em?: string | null;
};

export type BonusExportRaw = {
  indicador_equipe_id: string | null;
  valor: number | null;
  status: string | null;
};

export type MontarRelatorioEquipeInput = {
  equipe: EquipeRaw[];
  candidatosTreinamento: CandidatoTreinamentoRaw[];
  etapasTreinamento: EtapaTreinamentoRaw[];
  nomesEquipePorId: Map<string, string>;
  indicacaoFichaPorFichaId: Map<string, string>;
  observacoes: ObservacaoExportRaw[];
  selecionadoresPorFichaId?: Map<string, string>;
  efetivadoresPorCandidatoId?: Map<string, string>;
  bonusPorIndicadorId?: Map<string, BonusExportRaw[]>;
  perfil: PerfilExportacao;
};

function texto(valor: unknown): string {
  const v = valor == null ? "" : String(valor).trim();
  return v || "—";
}

function fmtDataExport(d: string | Date | null | undefined): string {
  if (!d) return "—";
  if (typeof d === "string") {
    const m = d.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (m) return `${m[3]}/${m[2]}/${m[1]}`;
  }
  return new Date(d).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
}

function dataEntradaEquipe(m: EquipeRaw): string | null {
  return m.data_entrada || m.criado_em || null;
}

function dataEntradaTreinamento(c: CandidatoTreinamentoRaw, inicio: string | null): string | null {
  return inicio || c.efetivado_em || c.criado_em || null;
}

function chavePessoa(cpf: string | null | undefined, telefone: string | null | undefined, nome: string | null | undefined, data: string | null | undefined): string {
  const cpfLimpo = limparCpf(cpf || "");
  if (cpfLimpo) return `cpf:${cpfLimpo}`;
  const telLimpo = limparTelefone(telefone || "");
  if (telLimpo) return `tel:${telLimpo}`;
  return `nome-data:${(nome || "").trim().toLocaleLowerCase("pt-BR")}:${(data || "").slice(0, 10)}`;
}

function formatarCpfPorPerfil(cpf: string | null | undefined, perfil: PerfilExportacao): string {
  return perfil === "acesso_total" ? texto(formatarCpf(cpf)) : mascararCpf(cpf);
}

function primeiraEtapaPorCandidato(etapas: EtapaTreinamentoRaw[]): Map<string, string> {
  const mapa = new Map<string, string>();
  const ordenadas = [...etapas].sort((a, b) => new Date(a.data || a.criado_em || 0).getTime() - new Date(b.data || b.criado_em || 0).getTime());
  for (const etapa of ordenadas) {
    if (!mapa.has(etapa.candidato_id)) mapa.set(etapa.candidato_id, etapa.data || etapa.criado_em || "");
  }
  return mapa;
}

function observacoesPorEntidade(observacoes: ObservacaoExportRaw[]): Map<string, string> {
  const mapa = new Map<string, string[]>();
  for (const obs of observacoes) {
    const chave = `${obs.entidade_tipo}:${obs.entidade_id}`;
    const lista = mapa.get(chave) || [];
    const autor = obs.criado_por_nome ? `${obs.criado_por_nome}: ` : "";
    lista.push(`${autor}${obs.texto || ""}`.trim());
    mapa.set(chave, lista);
  }
  return new Map([...mapa.entries()].map(([chave, lista]) => [chave, lista.filter(Boolean).join(" | ")]));
}

function bonusResumo(bonus: BonusExportRaw[] | undefined): string {
  if (!bonus || bonus.length === 0) return "—";
  return bonus
    .map((b) => `${b.valor != null ? fmtMoeda(b.valor) : "valor pendente"} (${b.status || "sem status"})`)
    .join(" | ");
}

export function montarRelatorioEquipeAtual(input: MontarRelatorioEquipeInput): EquipeExportRow[] {
  const acessoTotal = input.perfil === "acesso_total";
  const inicioTreinamento = primeiraEtapaPorCandidato(input.etapasTreinamento);
  const obs = observacoesPorEntidade(input.observacoes);
  const usadas = new Set<string>();
  const linhas: EquipeExportRow[] = [];

  for (const m of input.equipe) {
    const entrada = dataEntradaEquipe(m);
    usadas.add(chavePessoa(m.cpf, m.telefone, m.nome, entrada));
    if (m.candidato_origem_id) usadas.add(`candidato:${m.candidato_origem_id}`);

    linhas.push({
      id: m.id,
      origem: "equipe",
      nome: texto(m.nome),
      telefone: texto(formatarTelefone(m.telefone)),
      cpf: formatarCpfPorPerfil(m.cpf, input.perfil),
      cargo: texto(m.cargo),
      status: STATUS_EQUIPE_LABELS[m.status || ""] || texto(m.status),
      dataEntrada: fmtDataExport(entrada),
      dataInicioTreinamento: "—",
      dataEfetivacao: m.origem === "processo_seletivo" ? fmtDataExport(m.data_entrada) : "—",
      quemIndicou: m.indicado_por_equipe_id ? texto(input.nomesEquipePorId.get(m.indicado_por_equipe_id)) : "—",
      quemSelecionou: m.candidato_origem_id ? texto(input.efetivadoresPorCandidatoId?.get(m.candidato_origem_id)) : "—",
      observacoes: texto([m.observacoes_iniciais, obs.get(`equipe:${m.id}`)].filter(Boolean).join(" | ")),
      ...(acessoTotal ? { salario: fmtMoeda(m.salario ?? null), bonusIndicacao: bonusResumo(input.bonusPorIndicadorId?.get(m.id)) } : {}),
    });
  }

  for (const c of input.candidatosTreinamento) {
    const inicio = inicioTreinamento.get(c.id) || c.etapa_atual_desde || null;
    const entrada = dataEntradaTreinamento(c, inicio);
    const chave = chavePessoa(c.cpf, c.telefone, c.nome, entrada);
    if (usadas.has(chave) || usadas.has(`candidato:${c.id}`)) continue;
    usadas.add(chave);

    const indicado = c.indicado_por_equipe_id
      ? input.nomesEquipePorId.get(c.indicado_por_equipe_id)
      : c.ficha_id
        ? input.indicacaoFichaPorFichaId.get(c.ficha_id)
        : null;

    linhas.push({
      id: c.id,
      origem: "treinamento",
      nome: texto(c.nome),
      telefone: texto(formatarTelefone(c.telefone)),
      cpf: formatarCpfPorPerfil(c.cpf, input.perfil),
      cargo: texto(c.vaga_pretendida),
      status: ETAPA_LABELS[c.status || ""] || "Em treinamento",
      dataEntrada: fmtDataExport(entrada),
      dataInicioTreinamento: fmtDataExport(inicio),
      dataEfetivacao: fmtDataExport(c.efetivado_em),
      quemIndicou: texto(indicado),
      quemSelecionou: c.ficha_id ? texto(input.selecionadoresPorFichaId?.get(c.ficha_id)) : "—",
      observacoes: texto(obs.get(`candidato:${c.id}`)),
      ...(acessoTotal ? { salario: "—", bonusIndicacao: "—" } : {}),
    });
  }

  return linhas.sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
}
