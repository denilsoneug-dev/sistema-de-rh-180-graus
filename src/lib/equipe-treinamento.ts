export const STATUS_CANDIDATOS_EM_PROCESSO = [
  "entrevista_online",
  "entrevista_presencial",
  "redacao_escrita",
] as const;

export function candidatoEstaEmProcesso(status: string): boolean {
  return (STATUS_CANDIDATOS_EM_PROCESSO as readonly string[]).includes(status);
}

type ItemStatus = { status: string };

export function calcularContadoresOperacionais(candidatos: ItemStatus[], equipe: ItemStatus[]) {
  return {
    candidatosEmProcesso: candidatos.filter((c) => candidatoEstaEmProcesso(c.status)).length,
    emTreinamento: candidatos.filter((c) => c.status === "em_treinamento").length,
    efetivados: candidatos.filter((c) => c.status === "efetivado").length,
    ativosDefinitivos: equipe.filter((m) => m.status === "ativo").length,
  };
}

export function apresentacaoBuscaCandidato(status: string, vagaPretendida?: string | null) {
  if (status === "em_treinamento") {
    return {
      tipo: "Equipe",
      status: "Em treinamento",
      detalhe: `Entrada virtual${vagaPretendida ? ` · Vaga: ${vagaPretendida}` : ""}`,
    };
  }

  if (status === "treinamento_encerrado") {
    return {
      tipo: "Candidato",
      status: "Treinamento encerrado",
      detalhe: "Histórico",
    };
  }

  return {
    tipo: "Candidato",
    status: null,
    detalhe: candidatoEstaEmProcesso(status) ? "em_processo" : "",
  };
}
