import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test, vi } from "vitest";
import { PainelFichas } from "@/components/PainelFichas";
import { Observacoes } from "@/components/Observacoes";
import type { FichaPainel } from "@/lib/rh";

vi.mock("@/app/actions/fichas", () => ({ atualizarStatusRecrutamento: vi.fn() }));
vi.mock("@/app/actions/observacoes", () => ({
  criarObservacao: vi.fn(),
  editarObservacao: vi.fn(),
  apagarObservacao: vi.fn(),
}));

const fichas: FichaPainel[] = [
  {
    id: "1",
    nome: "Ana Silva",
    idade: 24,
    telefone: "(86) 99999-1111",
    email: "ana@example.com",
    statusRecrutamento: "nova_ficha",
    statusFicha: "recebida",
    enviadaEm: "2026-06-12T10:00:00Z",
    curriculoUrl: "1/curriculo.pdf",
    requisitos: 4,
  },
  {
    id: "2",
    nome: "Bruno Costa",
    idade: 31,
    telefone: "(86) 98888-2222",
    email: "bruno@example.com",
    statusRecrutamento: "em_analise",
    statusFicha: "recebida",
    enviadaEm: "2026-06-11T10:00:00Z",
    curriculoUrl: null,
    requisitos: 2,
  },
];

describe("Painel de fichas do RH", () => {
  test("carrega candidatos e expõe acesso ao detalhe", () => {
    render(<PainelFichas fichas={fichas} podeEditar />);
    expect(screen.getByText("Ana Silva")).toBeTruthy();
    expect(screen.getByText("Bruno Costa")).toBeTruthy();
    expect(screen.getAllByRole("link", { name: "Ver ficha" })).toHaveLength(2);
    expect(screen.getAllByText("Com currículo").length).toBeGreaterThan(0);
    expect(screen.getByText("★ 4/4 requisitos")).toBeTruthy();
    expect(screen.getByText("★ 2/4 requisitos")).toBeTruthy();
  });

  test("filtra por nome e telefone sem recarregar a tela", async () => {
    const user = userEvent.setup();
    render(<PainelFichas fichas={fichas} podeEditar />);
    const busca = screen.getByLabelText("Nome ou telefone");
    await user.type(busca, "Ana");
    expect(screen.getByText("Ana Silva")).toBeTruthy();
    expect(screen.queryByText("Bruno Costa")).toBeNull();
    await user.clear(busca);
    await user.type(busca, "988882222");
    expect(screen.getByText("Bruno Costa")).toBeTruthy();
    expect(screen.queryByText("Ana Silva")).toBeNull();
  });

  test("filtra por status e por currículo", () => {
    render(<PainelFichas fichas={fichas} podeEditar />);
    fireEvent.change(screen.getByLabelText("Status"), { target: { value: "em_analise" } });
    expect(screen.getByText("Bruno Costa")).toBeTruthy();
    expect(screen.queryByText("Ana Silva")).toBeNull();
    fireEvent.change(screen.getByLabelText("Status"), { target: { value: "" } });
    fireEvent.change(screen.getByLabelText("Currículo"), { target: { value: "com" } });
    expect(screen.getByText("Ana Silva")).toBeTruthy();
    expect(screen.queryByText("Bruno Costa")).toBeNull();
  });

  test("usa cards responsivos e botões acessíveis no mobile", () => {
    render(<PainelFichas fichas={fichas} podeEditar />);
    const card = screen.getAllByTestId("ficha-card")[0];
    expect(card.className).toContain("card");
    expect(screen.getAllByRole("button", { name: "Salvar" })).toHaveLength(2);
  });
});

describe("Observações internas", () => {
  test("mostra criação, edição, exclusão e autoria", () => {
    render(<Observacoes
      entidadeTipo="ficha"
      entidadeId="1"
      observacoes={[{
        id: "obs-1",
        texto: "Bom perfil para entrevista.",
        criado_por_nome: "RH Teste",
        criado_em: "2026-06-12T10:00:00Z",
        editado_em: null,
      }]}
      podeEditar
      path="/fichas/1"
    />);
    expect(screen.getAllByText("Bom perfil para entrevista.").length).toBeGreaterThan(0);
    expect(screen.getByText(/RH Teste/)).toBeTruthy();
    expect(screen.getByText("editar")).toBeTruthy();
    expect(screen.getByRole("button", { name: "apagar" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Adicionar observação" })).toBeTruthy();
  });
});
