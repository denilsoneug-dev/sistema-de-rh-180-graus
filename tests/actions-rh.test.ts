import { beforeEach, describe, expect, test, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  updates: [] as Array<Record<string, unknown>>,
  inserts: [] as Array<Record<string, unknown>>,
  revalidatePath: vi.fn(),
  logAudit: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
vi.mock("@/lib/auth", () => ({
  requireAcessoTotal: vi.fn(async () => ({ id: "perfil-1", nome: "RH Teste" })),
}));
vi.mock("@/lib/audit", () => ({ logAudit: mocks.logAudit }));
vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    from: () => ({
      select: () => ({
        eq: () => ({ single: async () => ({ data: { status_recrutamento: "nova_ficha" } }) }),
      }),
      update: (payload: Record<string, unknown>) => {
        mocks.updates.push(payload);
        return { eq: async () => ({ error: null }) };
      },
      insert: async (payload: Record<string, unknown>) => {
        mocks.inserts.push(payload);
        return { error: null };
      },
    }),
  })),
}));

import { atualizarStatusRecrutamento } from "@/app/actions/fichas";
import { apagarObservacao, criarObservacao, editarObservacao } from "@/app/actions/observacoes";

beforeEach(() => {
  mocks.updates.length = 0;
  mocks.inserts.length = 0;
  mocks.revalidatePath.mockClear();
  mocks.logAudit.mockClear();
});

describe("Ações do RH", () => {
  test("alterar status salva e registra auditoria", async () => {
    const formData = new FormData();
    formData.set("status_recrutamento", "em_analise");
    await atualizarStatusRecrutamento("ficha-1", formData);
    expect(mocks.updates).toContainEqual({ status_recrutamento: "em_analise" });
    expect(mocks.logAudit).toHaveBeenCalledWith(expect.objectContaining({ acao: "alterou_status_recrutamento" }));
  });

  test("observação pode ser criada", async () => {
    const formData = new FormData();
    formData.set("texto", "Candidato disponível.");
    formData.set("entidade_tipo", "ficha");
    formData.set("entidade_id", "ficha-1");
    formData.set("path", "/fichas/ficha-1");
    await criarObservacao(formData);
    expect(mocks.inserts[0]).toEqual(expect.objectContaining({ texto: "Candidato disponível.", criado_por_nome: "RH Teste" }));
  });

  test("observação pode ser editada", async () => {
    const formData = new FormData();
    formData.set("id", "obs-1");
    formData.set("texto", "Texto atualizado.");
    await editarObservacao(formData);
    expect(mocks.updates[0]).toEqual(expect.objectContaining({ texto: "Texto atualizado.", editado_por: "perfil-1" }));
  });

  test("observação pode ser apagada logicamente", async () => {
    const formData = new FormData();
    formData.set("id", "obs-1");
    await apagarObservacao(formData);
    expect(mocks.updates[0]).toEqual(expect.objectContaining({ apagado: true, apagado_por: "perfil-1" }));
  });
});
