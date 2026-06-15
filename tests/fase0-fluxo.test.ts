import { beforeEach, describe, expect, test, vi } from "vitest";
import { candidatoEstaEmProcesso, apresentacaoBuscaCandidato, calcularContadoresOperacionais } from "@/lib/equipe-treinamento";

const mocks = vi.hoisted(() => ({
  updates: [] as Array<Record<string, unknown>>,
  candStatus: "em_treinamento" as string,
  revalidatePath: vi.fn(),
  redirect: vi.fn(),
  logAudit: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
vi.mock("@/lib/auth", () => ({
  requireAcessoTotal: vi.fn(async () => ({ id: "perfil-1", nome: "RH Teste" })),
}));
vi.mock("@/lib/audit", () => ({ logAudit: mocks.logAudit }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    from: () => ({
      select: () => ({
        eq: () => ({ single: async () => ({ data: { status: mocks.candStatus } }) }),
      }),
      update: (payload: Record<string, unknown>) => {
        mocks.updates.push(payload);
        return { eq: async () => ({ error: null }) };
      },
    }),
  })),
}));

import { encerrarTreinamento } from "@/app/actions/candidatos";

beforeEach(() => {
  mocks.updates.length = 0;
  mocks.candStatus = "em_treinamento";
  vi.clearAllMocks();
});

describe("definição única de 'em processo'", () => {
  test("apenas etapas de seleção contam como em processo", () => {
    expect(candidatoEstaEmProcesso("entrevista_online")).toBe(true);
    expect(candidatoEstaEmProcesso("entrevista_presencial")).toBe(true);
    expect(candidatoEstaEmProcesso("redacao_escrita")).toBe(true);
    expect(candidatoEstaEmProcesso("em_treinamento")).toBe(false);
    expect(candidatoEstaEmProcesso("efetivado")).toBe(false);
    expect(candidatoEstaEmProcesso("rejeitado")).toBe(false);
  });
});

describe("encerrarTreinamento", () => {
  test("encerra treinamento com status próprio, motivo prefixado e auditoria própria", async () => {
    const fd = new FormData();
    fd.set("motivo", "faltou muito");
    await encerrarTreinamento("cand-1", fd);

    expect(mocks.updates).toHaveLength(1);
    expect(mocks.updates[0].status).toBe("treinamento_encerrado");
    expect(mocks.updates[0].status).not.toBe("rejeitado");
    expect(mocks.updates[0].rejeicao_motivo).toBe("Treinamento não aprovado: faltou muito");
    expect(mocks.logAudit).toHaveBeenCalledWith(
      expect.objectContaining({ acao: "encerrou_treinamento" }),
    );
  });

  test("não permite encerrar quem não está em treinamento", async () => {
    mocks.candStatus = "entrevista_online";
    await expect(encerrarTreinamento("cand-1", new FormData())).rejects.toThrow();
    expect(mocks.updates).toHaveLength(0);
  });
});

describe("treinamento_encerrado é histórico, não conta em nada", () => {
  test("não é em processo", () => {
    expect(candidatoEstaEmProcesso("treinamento_encerrado")).toBe(false);
  });

  test("busca mostra 'Treinamento encerrado', não 'Rejeitado'", () => {
    expect(apresentacaoBuscaCandidato("treinamento_encerrado")).toEqual({
      tipo: "Candidato",
      status: "Treinamento encerrado",
      detalhe: "Histórico",
    });
  });

  test("não conta como em processo, ativo, efetivado nem em treinamento", () => {
    const contadores = calcularContadoresOperacionais(
      [
        { status: "entrevista_online" },
        { status: "em_treinamento" },
        { status: "efetivado" },
        { status: "treinamento_encerrado" },
      ],
      [{ status: "ativo" }],
    );
    expect(contadores).toEqual({
      candidatosEmProcesso: 1,
      emTreinamento: 1,
      efetivados: 1,
      ativosDefinitivos: 1,
    });
  });
});
