import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test, vi } from "vitest";
import { PainelFichas } from "@/components/PainelFichas";
import { PainelCandidatos } from "@/components/PainelCandidatos";
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

  test("ficha selecionada mostra conversão e link para candidato", () => {
    render(<PainelFichas fichas={[{
      ...fichas[0],
      statusFicha: "selecionada",
      estadoAtual: "Em processo — Entrevista online",
      candidatoId: "cand-1",
    }]} podeEditar />);

    expect(screen.getByText("Já convertido para candidato")).toBeTruthy();
    expect(screen.getByText("Estado atual: Em processo — Entrevista online")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Ver candidato" }).getAttribute("href")).toBe("/candidatos/cand-1");
  });
});

describe("Painel de candidatos em processo", () => {
  test("mostra etapa atual, telefone, requisitos e indicação", () => {
    render(<PainelCandidatos
      acessoTotal
      emTreinamentoCount={0}
      efetivadoCount={0}
      rejeitadoCount={0}
      candidatos={[{
        id: "cand-1",
        nome: "Ana Processo",
        cpf: "12345678909",
        telefone: "86999991111",
        vaga_pretendida: "Redatora",
        indicador_nome: "Maria Indicadora",
        idade: 27,
        criado_em: new Date().toISOString(),
        status: "entrevista_online",
        etapa_atual_desde: new Date().toISOString(),
        resumo: {
          pontos: 4,
          total: 4,
          estado: "forte",
          itens: {
            disponibilidade: { label: "Integral", estado: "ok" },
            notebook: { label: "Sim", estado: "ok" },
            veiculo: { label: "Sim", estado: "ok" },
            cnh: { label: "Sim — B", estado: "ok" },
          },
        },
      }]}
    />);

    expect(screen.getByText("Ana Processo")).toBeTruthy();
    expect(screen.getAllByText("Entrevista online").length).toBeGreaterThan(0);
    expect(screen.getByText(/\(86\) 99999-1111/)).toBeTruthy();
    expect(screen.getByText("Quem indicou: Maria Indicadora")).toBeTruthy();
    expect(screen.getByText("★ 4/4 requisitos")).toBeTruthy();
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
