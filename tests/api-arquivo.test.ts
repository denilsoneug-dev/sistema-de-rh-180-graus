import { beforeEach, describe, expect, test, vi } from "vitest";
import { NextRequest } from "next/server";

const state = vi.hoisted(() => ({
  perfil: null as null | { papel: string },
  fichaFound: false,
  candFound: false,
  etapaFound: false,
}));

vi.mock("@/lib/auth", () => ({
  getPerfil: vi.fn(async () => state.perfil),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    from: (table: string) => ({
      select: () => ({
        eq: () => ({
          limit: () => ({
            maybeSingle: async () => {
              if (table === "fichas") return { data: state.fichaFound ? { id: "f1" } : null };
              if (table === "candidatos") return { data: state.candFound ? { id: "c1" } : null };
              if (table === "candidato_etapas") return { data: state.etapaFound ? { id: "e1" } : null };
              return { data: null };
            },
          }),
        }),
      }),
    }),
    storage: {
      from: () => ({
        createSignedUrl: async () => ({ data: { signedUrl: "https://signed.example/file" }, error: null }),
      }),
    },
  })),
}));

import { GET } from "@/app/api/arquivo/route";

function req(qs: string) {
  return new NextRequest(`http://localhost/api/arquivo?${qs}`);
}

beforeEach(() => {
  state.perfil = null;
  state.fichaFound = false;
  state.candFound = false;
  state.etapaFound = false;
});

describe("/api/arquivo — controle de acesso", () => {
  test("401 sem usuário autenticado", async () => {
    const res = await GET(req("bucket=curriculos&path=f1/cv.pdf"));
    expect(res.status).toBe(401);
  });

  test("403 para papel visualização", async () => {
    state.perfil = { papel: "visualizacao" };
    const res = await GET(req("bucket=curriculos&path=f1/cv.pdf"));
    expect(res.status).toBe(403);
  });

  test("400 para bucket inválido", async () => {
    state.perfil = { papel: "acesso_total" };
    const res = await GET(req("bucket=secreto&path=x"));
    expect(res.status).toBe(400);
  });

  test("404 para path arbitrário (não vinculado a registro)", async () => {
    state.perfil = { papel: "acesso_total" };
    const res = await GET(req("bucket=curriculos&path=qualquer/coisa.pdf"));
    expect(res.status).toBe(404);
  });

  test("redirect (acesso_total + currículo vinculado a ficha)", async () => {
    state.perfil = { papel: "acesso_total" };
    state.fichaFound = true;
    const res = await GET(req("bucket=curriculos&path=f1/cv.pdf"));
    expect([302, 307]).toContain(res.status);
    expect(res.headers.get("location")).toBe("https://signed.example/file");
  });

  test("redirect (acesso_total + redação vinculada a etapa)", async () => {
    state.perfil = { papel: "acesso_total" };
    state.etapaFound = true;
    const res = await GET(req("bucket=redacoes&path=c1/redacao.pdf"));
    expect([302, 307]).toContain(res.status);
  });
});
