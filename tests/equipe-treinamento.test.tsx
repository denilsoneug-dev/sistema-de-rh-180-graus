import { render, screen } from "@testing-library/react";
import { describe, expect, test } from "vitest";
import { EquipeEmTreinamento } from "@/components/EquipeEmTreinamento";
import {
  apresentacaoBuscaCandidato,
  calcularContadoresOperacionais,
  candidatoEstaEmProcesso,
  STATUS_CANDIDATOS_EM_PROCESSO,
} from "@/lib/equipe-treinamento";

const pessoa = {
  id: "cand-1",
  nome: "Ana Treinamento",
  cpf: "12345678909",
  telefone: "86999991111",
  vaga_pretendida: "Redatora",
  inicio_treinamento: "2026-06-10",
  indicador_nome: "Maria Indicadora",
  resumo: null,
};

describe("entrada virtual de treinamento na Equipe", () => {
  test("exibe candidato, indicação e link para o detalhe existente", () => {
    render(<EquipeEmTreinamento pessoas={[pessoa]} acessoTotal />);

    expect(screen.getByText("Ana Treinamento")).toBeTruthy();
    expect(screen.getByText("Quem indicou:")).toBeTruthy();
    expect(screen.getByText("Maria Indicadora")).toBeTruthy();
    expect(screen.getByText("Em treinamento")).toBeTruthy();
    expect(screen.queryByText("Ativo")).toBeNull();
    expect(screen.getByRole("link", { name: "Ver detalhes" }).getAttribute("href")).toBe("/candidatos/cand-1");
  });

  test("mostra ausência de indicação e mascara CPF para visualização", () => {
    render(<EquipeEmTreinamento pessoas={[{ ...pessoa, indicador_nome: null }]} acessoTotal={false} />);

    expect(screen.getByText(/Sem indicação informada/)).toBeTruthy();
    expect(screen.getByText(/CPF 123\.\*\*\*\.\*\*\*-09/)).toBeTruthy();
    expect(screen.queryByText(/123\.456\.789-09/)).toBeNull();
  });

  test("treinamento não pertence à lista de candidatos em processo", () => {
    expect(STATUS_CANDIDATOS_EM_PROCESSO).toEqual([
      "entrevista_online",
      "entrevista_presencial",
      "redacao_escrita",
    ]);
    expect(candidatoEstaEmProcesso("em_treinamento")).toBe(false);
    expect(candidatoEstaEmProcesso("efetivado")).toBe(false);
  });

  test("busca apresenta treinamento como Equipe, não como candidato", () => {
    expect(apresentacaoBuscaCandidato("em_treinamento", "Redatora")).toEqual({
      tipo: "Equipe",
      status: "Em treinamento",
      detalhe: "Entrada virtual · Vaga: Redatora",
    });
  });

  test("treinamento tem contador próprio e não conta como ativo ou efetivado", () => {
    const contadores = calcularContadoresOperacionais(
      [
        { status: "entrevista_online" },
        { status: "em_treinamento" },
        { status: "efetivado" },
      ],
      [{ status: "ativo" }, { status: "em_experiencia" }],
    );

    expect(contadores).toEqual({
      candidatosEmProcesso: 1,
      emTreinamento: 1,
      efetivados: 1,
      ativosDefinitivos: 1,
    });
  });
});
