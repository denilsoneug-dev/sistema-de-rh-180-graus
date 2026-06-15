import { beforeEach, describe, expect, test, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  equipeUpdates: [] as Array<Record<string, unknown>>,
  equipeInserts: [] as Array<Record<string, unknown>>,
  bonusInserts: [] as Array<Record<string, unknown>>,
  candidatoUpdates: [] as Array<Record<string, unknown>>,
}));

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
vi.mock("@/lib/auth", () => ({
  requireAcessoTotal: vi.fn(async () => ({ id: "perfil-1", nome: "RH Teste" })),
}));
vi.mock("@/lib/audit", () => ({ logAudit: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: vi.fn(() => ({
    from: () => ({ select: () => ({ eq: () => ({ single: async () => ({ data: { valor: "100" } }) }) }) }),
  })),
}));

function thenable<T>(value: T) {
  return { then: (resolve: (result: T) => unknown) => Promise.resolve(resolve(value)) };
}

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    from: (table: string) => ({
      select: () => {
        if (table === "candidatos") {
          return { eq: () => ({ single: async () => ({ data: {
            id: "cand-1", status: "em_treinamento", nome: "Ana", cpf: "12345678909",
            telefone: "86999991111", indicado_por_equipe_id: "indicador-1",
          } }) }) };
        }
        if (table === "candidato_etapas") {
          return { eq: () => ({ eq: () => thenable({ data: [{ resultado: "aprovado" }] }) }) };
        }
        if (table === "equipe") {
          return { or: () => ({ limit: () => ({ maybeSingle: async () => ({ data: { id: "membro-existente" }, error: null }) }) }) };
        }
        if (table === "bonus_indicacao") {
          return { eq: () => ({ limit: () => ({ maybeSingle: async () => ({ data: { id: "bonus-existente" }, error: null }) }) }) };
        }
        throw new Error(`select inesperado em ${table}`);
      },
      update: (payload: Record<string, unknown>) => {
        if (table === "equipe") mocks.equipeUpdates.push(payload);
        if (table === "candidatos") mocks.candidatoUpdates.push(payload);
        return { eq: async () => ({ error: null }) };
      },
      insert: (payload: Record<string, unknown>) => {
        if (table === "equipe") mocks.equipeInserts.push(payload);
        if (table === "bonus_indicacao") mocks.bonusInserts.push(payload);
        return { select: () => ({ single: async () => ({ data: { id: "novo" }, error: null }) }) };
      },
      upsert: async () => ({ error: null }),
    }),
  })),
}));

import { efetivarCandidato } from "@/app/actions/candidatos";

beforeEach(() => {
  mocks.equipeUpdates.length = 0;
  mocks.equipeInserts.length = 0;
  mocks.bonusInserts.length = 0;
  mocks.candidatoUpdates.length = 0;
});

describe("efetivação sem duplicidade", () => {
  test("reaproveita equipe por candidato ou CPF e preserva indicação", async () => {
    const formData = new FormData();
    formData.set("cargo", "Redatora");
    formData.set("salario", "2500");
    formData.set("data_entrada", "2026-06-15");

    await efetivarCandidato("cand-1", formData);

    expect(mocks.equipeInserts).toHaveLength(0);
    expect(mocks.equipeUpdates).toContainEqual(expect.objectContaining({
      candidato_origem_id: "cand-1",
      cpf: "12345678909",
      status: "em_experiencia",
      indicado_por_equipe_id: "indicador-1",
    }));
    expect(mocks.bonusInserts).toHaveLength(0);
    expect(mocks.candidatoUpdates).toContainEqual(expect.objectContaining({ status: "efetivado" }));
  });
});
