import { beforeEach, describe, expect, test, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  acessoTotal: true,
  revalidatePath: vi.fn(),
  redirect: vi.fn((url: string) => {
    throw new Error(`NEXT_REDIRECT:${url}`);
  }),
  logAudit: vi.fn(),
  ficha: {
    id: "ficha-1",
    status: "recebida",
    cpf: "12345678909",
    curriculo_url: "curriculos/ficha-1.pdf",
    ficha_respostas: {
      nome_completo: "Ana Processo",
      cpf: "123.456.789-09",
      whatsapp: "86999991111",
      vaga_pretendida: "Redatora",
      tem_conhecido_grupo: true,
      conhecido_nome: "Maria Indicadora",
      conhecido_relacao: "amiga",
    },
  } as Record<string, unknown>,
  candidatos: [] as Array<Record<string, unknown>>,
  etapas: [] as Array<Record<string, unknown>>,
  fichaUpdates: [] as Array<Record<string, unknown>>,
}));

function nextId() {
  return `cand-${mocks.candidatos.length + 1}`;
}

function selectTable(table: string) {
  return {
    select: () => ({
      eq: (col: string, value: unknown) => {
        const filtered = table === "fichas"
          ? [mocks.ficha].filter((row) => row[col] === value)
          : mocks.candidatos.filter((row) => row[col] === value);
        return {
          single: async () => ({ data: filtered[0] || null, error: null }),
          limit: () => ({
            maybeSingle: async () => ({ data: filtered[0] || null, error: null }),
          }),
        };
      },
    }),
    update: (payload: Record<string, unknown>) => ({
      eq: async (col: string, value: unknown) => {
        if (table === "fichas" && mocks.ficha[col] === value) {
          Object.assign(mocks.ficha, payload);
          mocks.fichaUpdates.push(payload);
        }
        if (table === "candidatos") {
          const cand = mocks.candidatos.find((row) => row[col] === value);
          if (cand) Object.assign(cand, payload);
        }
        return { error: null };
      },
    }),
    insert: (payload: Record<string, unknown>) => {
      if (table === "candidatos") {
        const row = { id: nextId(), ...payload };
        mocks.candidatos.push(row);
        return {
          select: () => ({
            single: async () => ({ data: { id: row.id }, error: null }),
          }),
        };
      }
      if (table === "candidato_etapas") {
        mocks.etapas.push(payload);
      }
      return { error: null };
    },
  };
}

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
vi.mock("@/lib/auth", () => ({
  requireAcessoTotal: vi.fn(async () => {
    if (!mocks.acessoTotal) throw new Error("Sem acesso total");
    return { id: "perfil-1", nome: "RH Teste" };
  }),
}));
vi.mock("@/lib/audit", () => ({ logAudit: mocks.logAudit }));
vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({ from: selectTable })),
}));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn() }));

import { selecionarParaProcesso } from "@/app/actions/fichas";

beforeEach(() => {
  mocks.acessoTotal = true;
  mocks.ficha = {
    id: "ficha-1",
    status: "recebida",
    cpf: "12345678909",
    curriculo_url: "curriculos/ficha-1.pdf",
    ficha_respostas: {
      nome_completo: "Ana Processo",
      cpf: "123.456.789-09",
      whatsapp: "86999991111",
      vaga_pretendida: "Redatora",
      tem_conhecido_grupo: true,
      conhecido_nome: "Maria Indicadora",
      conhecido_relacao: "amiga",
    },
  };
  mocks.candidatos.length = 0;
  mocks.etapas.length = 0;
  mocks.fichaUpdates.length = 0;
  vi.clearAllMocks();
});

describe("selecionarParaProcesso", () => {
  test("seleciona ficha e cria candidato em entrevista online", async () => {
    const fd = new FormData();
    fd.set("indicado_por", "equipe-1");

    await expect(selecionarParaProcesso("ficha-1", fd)).rejects.toThrow("NEXT_REDIRECT:/candidatos/cand-1?origem=candidato-criado");

    expect(mocks.ficha.status).toBe("selecionada");
    expect(mocks.candidatos).toHaveLength(1);
    expect(mocks.candidatos[0]).toEqual(expect.objectContaining({
      ficha_id: "ficha-1",
      cpf: "12345678909",
      status: "entrevista_online",
      etapa_atual: "entrevista_online",
      indicado_por_equipe_id: "equipe-1",
    }));
    expect(mocks.etapas[0]).toEqual(expect.objectContaining({
      candidato_id: "cand-1",
      tipo_etapa: "entrevista_online",
      criado_por: "perfil-1",
    }));
  });

  test("selecionar a mesma ficha duas vezes não duplica candidato", async () => {
    mocks.candidatos.push({ id: "cand-existente", ficha_id: "ficha-1", cpf: "12345678909", status: "entrevista_online" });

    await expect(selecionarParaProcesso("ficha-1", new FormData())).rejects.toThrow("NEXT_REDIRECT:/candidatos/cand-existente?origem=ficha-ja-convertida");

    expect(mocks.candidatos).toHaveLength(1);
    expect(mocks.ficha.status).toBe("selecionada");
    expect(mocks.etapas).toHaveLength(0);
  });

  test("não duplica quando já existe candidato com o mesmo CPF", async () => {
    mocks.candidatos.push({ id: "cand-cpf", ficha_id: null, cpf: "12345678909", status: "entrevista_online" });

    await expect(selecionarParaProcesso("ficha-1", new FormData())).rejects.toThrow("NEXT_REDIRECT:/candidatos/cand-cpf?origem=ficha-ja-convertida");

    expect(mocks.candidatos).toHaveLength(1);
    expect(mocks.candidatos[0].ficha_id).toBe("ficha-1");
    expect(mocks.etapas).toHaveLength(0);
  });

  test("usuário sem acesso total não consegue selecionar ficha", async () => {
    mocks.acessoTotal = false;

    await expect(selecionarParaProcesso("ficha-1", new FormData())).rejects.toThrow("Sem acesso total");

    expect(mocks.candidatos).toHaveLength(0);
    expect(mocks.ficha.status).toBe("recebida");
  });
});
