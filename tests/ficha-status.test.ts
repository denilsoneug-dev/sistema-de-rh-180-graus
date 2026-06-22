import { beforeEach, describe, expect, test, vi } from "vitest";
import { STATUS_RECRUTAMENTO_FICHA, statusFichaAnaliseValido } from "@/lib/rh";

const mocks = vi.hoisted(() => ({
  updates: [] as Array<Record<string, unknown>>,
  fichaStatus: "recebida" as string,
  revalidatePath: vi.fn(),
  logAudit: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
vi.mock("@/lib/auth", () => ({ requireAcessoTotal: vi.fn(async () => ({ id: "p1", nome: "RH" })) }));
vi.mock("@/lib/audit", () => ({ logAudit: mocks.logAudit }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    from: () => ({
      select: () => ({ eq: () => ({ single: async () => ({ data: { status: mocks.fichaStatus, status_recrutamento: "nova_ficha" } }) }) }),
      update: (payload: Record<string, unknown>) => {
        mocks.updates.push(payload);
        return { eq: async () => ({ error: null }) };
      },
    }),
  })),
}));

import { atualizarStatusRecrutamento } from "@/app/actions/fichas";

beforeEach(() => {
  mocks.updates.length = 0;
  mocks.fichaStatus = "recebida";
  vi.clearAllMocks();
});

describe("status da ficha = só fase de análise", () => {
  test("opções da ficha são apenas análise (sem entrevista/aprovado)", () => {
    expect([...STATUS_RECRUTAMENTO_FICHA]).toEqual(["nova_ficha", "em_analise", "banco_de_talentos"]);
    for (const removido of ["chamado_entrevista", "entrevista_marcada", "aprovado"]) {
      expect(STATUS_RECRUTAMENTO_FICHA.includes(removido as never)).toBe(false);
      expect(statusFichaAnaliseValido(removido)).toBe(false);
    }
  });

  test("statusFichaAnaliseValido aceita os 3 de análise", () => {
    expect(statusFichaAnaliseValido("nova_ficha")).toBe(true);
    expect(statusFichaAnaliseValido("em_analise")).toBe(true);
    expect(statusFichaAnaliseValido("banco_de_talentos")).toBe(true);
  });
});

describe("atualizarStatusRecrutamento", () => {
  function fd(status: string) {
    const f = new FormData();
    f.set("status_recrutamento", status);
    return f;
  }

  test("aceita status de análise quando ficha está recebida", async () => {
    await atualizarStatusRecrutamento("f1", fd("em_analise"));
    expect(mocks.updates).toEqual([{ status_recrutamento: "em_analise" }]);
  });

  test("rejeita status de funil (ex.: aprovado)", async () => {
    await expect(atualizarStatusRecrutamento("f1", fd("aprovado"))).rejects.toThrow();
    expect(mocks.updates).toHaveLength(0);
  });

  test("rejeita alteração quando a ficha não está mais em análise", async () => {
    mocks.fichaStatus = "selecionada";
    await expect(atualizarStatusRecrutamento("f1", fd("em_analise"))).rejects.toThrow();
    expect(mocks.updates).toHaveLength(0);
  });
});
