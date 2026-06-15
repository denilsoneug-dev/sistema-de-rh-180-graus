import { describe, expect, test } from "vitest";
import { resumoRequisitos, resumoComOverride } from "@/lib/constants";
import { mapResumosPorFicha, mapResumosPorCandidatos, mapResumosPorEquipe } from "@/lib/requisitos";

describe("resumoRequisitos — cálculo", () => {
  test("4 de 4 (integral, notebook, veículo, CNH com categoria)", () => {
    const r = resumoRequisitos({
      disponibilidade_viajar: "integral",
      notebook_proprio: true,
      carro_proprio: true,
      tem_cnh: true,
      cnh_categoria: "B",
    });
    expect(r?.pontos).toBe(4);
    expect(r?.estado).toBe("forte");
    expect(r?.itens.disponibilidade.label).toBe("Integral");
    expect(r?.itens.cnh.label).toBe("Sim — B");
    expect(r?.itens.veiculo.estado).toBe("ok");
  });

  test("parcial conta como atenção e não soma ponto", () => {
    const r = resumoRequisitos({
      disponibilidade_viajar: "parcial",
      notebook_proprio: true,
      moto_propria: false,
      carro_proprio: false,
      tem_cnh: false,
    });
    expect(r?.itens.disponibilidade.estado).toBe("atencao");
    expect(r?.pontos).toBe(1); // só notebook
    expect(r?.estado).toBe("fraco");
  });

  test("0 de 4", () => {
    const r = resumoRequisitos({
      disponibilidade_viajar: "nao_tenho",
      notebook_proprio: false,
      moto_propria: false,
      carro_proprio: false,
      tem_cnh: false,
    });
    expect(r?.pontos).toBe(0);
    expect(r?.estado).toBe("fraco");
    expect(r?.itens.cnh.label).toBe("Não");
  });

  test("entrada nula retorna null", () => {
    expect(resumoRequisitos(null)).toBeNull();
    expect(resumoRequisitos(undefined)).toBeNull();
  });
});

describe("resumoComOverride — manual vence ficha", () => {
  const fichaFraca = {
    disponibilidade_viajar: "nao_tenho",
    notebook_proprio: false,
    moto_propria: false,
    carro_proprio: false,
    tem_cnh: false,
  };

  test("sem override usa a ficha", () => {
    const r = resumoComOverride(fichaFraca, null);
    expect(r?.pontos).toBe(0);
  });

  test("override eleva os requisitos campo a campo", () => {
    const r = resumoComOverride(fichaFraca, {
      req_disponibilidade: "integral",
      req_notebook: true,
      req_veiculo: true,
      req_cnh: true,
      req_cnh_categoria: "B",
    });
    expect(r?.pontos).toBe(4);
    expect(r?.itens.cnh.label).toBe("Sim — B");
  });

  test("override parcial: só os campos definidos mudam", () => {
    const r = resumoComOverride(fichaFraca, { req_notebook: true });
    expect(r?.pontos).toBe(1);
    expect(r?.itens.notebook.estado).toBe("ok");
    expect(r?.itens.cnh.estado).toBe("negativo");
  });

  test("sem ficha mas com override (ex.: equipe cadastrada direto)", () => {
    const r = resumoComOverride(null, { req_disponibilidade: "integral", req_notebook: true });
    expect(r?.pontos).toBe(2);
  });

  test("sem ficha e sem override retorna null", () => {
    expect(resumoComOverride(null, null)).toBeNull();
  });
});

function supabaseMock(tabelas: Record<string, Record<string, unknown>[]>) {
  return {
    from: (table: string) => ({
      select: () => ({
        in: async () => ({ data: tabelas[table] ?? [] }),
      }),
    }),
  };
}

describe("mapResumosPorFicha", () => {
  test("monta map por ficha_id", async () => {
    const supabase = supabaseMock({
      ficha_respostas: [
        { ficha_id: "f1", disponibilidade_viajar: "integral", notebook_proprio: true, carro_proprio: true, tem_cnh: true, cnh_categoria: "B" },
      ],
    });
    const map = await mapResumosPorFicha(supabase, ["f1", null, undefined]);
    expect(map.get("f1")?.pontos).toBe(4);
  });

  test("lista vazia não consulta e devolve map vazio", async () => {
    const supabase = supabaseMock({});
    const map = await mapResumosPorFicha(supabase, [null, undefined]);
    expect(map.size).toBe(0);
  });
});

describe("mapResumosPorEquipe", () => {
  test("membro com candidato de origem traz resumo da ficha", async () => {
    const supabase = supabaseMock({
      candidatos: [{ id: "c1", ficha_id: "f1" }],
      ficha_respostas: [
        { ficha_id: "f1", disponibilidade_viajar: "integral", notebook_proprio: true, carro_proprio: true, tem_cnh: true, cnh_categoria: "B" },
      ],
    });
    const map = await mapResumosPorEquipe(supabase, [{ id: "e1", candidato_origem_id: "c1" }]);
    expect(map.get("e1")?.pontos).toBe(4);
  });

  test("membro cadastrado direto (sem origem) não aparece no map", async () => {
    const supabase = supabaseMock({});
    const map = await mapResumosPorEquipe(supabase, [{ id: "e2", candidato_origem_id: null }]);
    expect(map.has("e2")).toBe(false);
  });

  test("membro cadastrado direto COM override manual aparece no map", async () => {
    const supabase = supabaseMock({});
    const map = await mapResumosPorEquipe(supabase, [
      { id: "e3", candidato_origem_id: null, req_disponibilidade: "integral", req_notebook: true },
    ]);
    expect(map.get("e3")?.pontos).toBe(2);
  });
});

describe("mapResumosPorCandidatos", () => {
  test("override do candidato vence a ficha", async () => {
    const supabase = supabaseMock({
      ficha_respostas: [
        { ficha_id: "f1", disponibilidade_viajar: "nao_tenho", notebook_proprio: false, tem_cnh: false },
      ],
    });
    const map = await mapResumosPorCandidatos(supabase, [
      { id: "c1", ficha_id: "f1", req_disponibilidade: "integral", req_cnh: true, req_cnh_categoria: "B" },
    ]);
    expect(map.get("c1")?.pontos).toBe(2);
    expect(map.get("c1")?.itens.cnh.label).toBe("Sim — B");
  });
});
