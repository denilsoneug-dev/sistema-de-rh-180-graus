import { describe, expect, test } from "vitest";
import { montarRelatorioEquipeAtual, type MontarRelatorioEquipeInput } from "@/lib/equipe-export";

function baseInput(): MontarRelatorioEquipeInput {
  return {
    perfil: "acesso_total",
    equipe: [
      {
        id: "eq-1",
        nome: "Ana Efetivada",
        cpf: "12345678909",
        telefone: "86999991111",
        cargo: "Redatora",
        salario: 2500,
        data_entrada: "2026-06-20",
        status: "em_experiencia",
        origem: "processo_seletivo",
        candidato_origem_id: "cand-duplicado",
        indicado_por_equipe_id: "eq-ind",
        observacoes_iniciais: "Entrou após treinamento",
        criado_em: "2026-06-01",
      },
    ],
    candidatosTreinamento: [
      {
        id: "cand-duplicado",
        nome: "Ana Efetivada",
        cpf: "12345678909",
        telefone: "86999991111",
        vaga_pretendida: "Redatora",
        status: "em_treinamento",
        ficha_id: "ficha-1",
        etapa_atual_desde: "2026-06-10",
        criado_em: "2026-06-02",
      },
      {
        id: "cand-2",
        nome: "Bruno Treinamento",
        cpf: "98765432100",
        telefone: "86988887777",
        vaga_pretendida: "Designer",
        status: "em_treinamento",
        ficha_id: "ficha-2",
        etapa_atual_desde: "2026-06-12",
        criado_em: "2026-06-03",
      },
      {
        id: "cand-3",
        nome: "Clara Sem Inicio",
        cpf: null,
        telefone: "86977776666",
        vaga_pretendida: "Atendimento",
        status: "em_treinamento",
        ficha_id: null,
        etapa_atual_desde: null,
        criado_em: "2026-06-04",
      },
    ],
    etapasTreinamento: [
      { candidato_id: "cand-2", data: "2026-06-15", criado_em: "2026-06-15T10:00:00Z" },
    ],
    nomesEquipePorId: new Map([["eq-ind", "Maria Indicadora"]]),
    indicacaoFichaPorFichaId: new Map([["ficha-2", "Joana da ficha"]]),
    observacoes: [
      { entidade_tipo: "equipe", entidade_id: "eq-1", texto: "Observação interna", criado_por_nome: "RH" },
      { entidade_tipo: "candidato", entidade_id: "cand-2", texto: "Bom desempenho", criado_por_nome: "Treinador" },
    ],
    selecionadoresPorFichaId: new Map([["ficha-2", "Selecionadora"]]),
    efetivadoresPorCandidatoId: new Map([["cand-duplicado", "Gestora"]]),
    bonusPorIndicadorId: new Map([["eq-1", [{ indicador_equipe_id: "eq-1", valor: 100, status: "pendente" }]]]),
  };
}

describe("relatório da equipe atual", () => {
  test("une equipe e treinamento sem duplicar pessoa efetivada", () => {
    const linhas = montarRelatorioEquipeAtual(baseInput());

    expect(linhas.map((l) => l.nome).sort()).toEqual(["Ana Efetivada", "Bruno Treinamento", "Clara Sem Inicio"]);
    expect(linhas.filter((l) => l.nome === "Ana Efetivada")).toHaveLength(1);
    expect(linhas.find((l) => l.nome === "Ana Efetivada")?.origem).toBe("equipe");
  });

  test("define data de entrada por prioridade sem alterar dados reais", () => {
    const linhas = montarRelatorioEquipeAtual(baseInput());

    expect(linhas.find((l) => l.nome === "Ana Efetivada")?.dataEntrada).toBe("20/06/2026");
    expect(linhas.find((l) => l.nome === "Bruno Treinamento")?.dataEntrada).toBe("15/06/2026");
    expect(linhas.find((l) => l.nome === "Clara Sem Inicio")?.dataEntrada).toBe("04/06/2026");
  });

  test("inclui campos financeiros apenas para acesso total", () => {
    const total = montarRelatorioEquipeAtual(baseInput()).find((l) => l.nome === "Ana Efetivada");
    expect(total?.salario).toBe("R$ 2.500,00");
    expect(total?.bonusIndicacao).toContain("R$ 100,00");

    const visualizacao = montarRelatorioEquipeAtual({ ...baseInput(), perfil: "visualizacao" });
    const ana = visualizacao.find((l) => l.nome === "Ana Efetivada");
    expect(ana?.cpf).toBe("123.***.***-09");
    expect(ana).not.toHaveProperty("salario");
    expect(ana).not.toHaveProperty("bonusIndicacao");
  });
});
