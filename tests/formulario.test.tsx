import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { PERGUNTAS_SOBRE_VOCE } from "@/lib/constants";

const { enviarFichaPublicaMock } = vi.hoisted(() => ({
  enviarFichaPublicaMock: vi.fn(async (_token: string, _formData: FormData) => ({ ok: true })),
}));

vi.mock("@/app/actions/ficha-publica", () => ({
  enviarFichaPublica: enviarFichaPublicaMock,
}));

import { FormularioFicha } from "@/app/ficha/[token]/FormularioFicha";

function inputs(container: HTMLElement) {
  return Array.from(container.querySelectorAll("input"));
}

function preencherEtapa1(container: HTMLElement) {
  const campos = inputs(container);
  fireEvent.change(campos[1], { target: { value: "Maria Teste" } });
  fireEvent.change(campos[2], { target: { value: "25" } });
  fireEvent.change(campos[3], { target: { value: "Rua A, 1" } });
  fireEvent.change(campos[4], { target: { value: "(86) 99999-9999" } });
  fireEvent.change(campos[5], { target: { value: "529.982.247-25" } });
  const selects = Array.from(container.querySelectorAll("select"));
  fireEvent.change(selects[0], { target: { value: "M" } });
  fireEvent.change(campos[6], { target: { value: "maria@teste.com" } });
  fireEvent.change(selects[1], { target: { value: "Solteiro(a)" } });
}

async function irParaEtapa2(user: ReturnType<typeof userEvent.setup>, container: HTMLElement) {
  preencherEtapa1(container);
  await user.click(screen.getByRole("button", { name: "Continuar" }));
}

async function preencherEtapa2Minima(user: ReturnType<typeof userEvent.setup>) {
  fireEvent.change(screen.getByLabelText("Você mora com quantas pessoas, tirando você?"), { target: { value: "0" } });
  const nao = screen.getAllByRole("button", { name: "Não" });
  await user.click(nao[0]);
  await user.click(nao[1]);
}

async function irParaEtapa3(user: ReturnType<typeof userEvent.setup>, container: HTMLElement) {
  await irParaEtapa2(user, container);
  await preencherEtapa2Minima(user);
  await user.click(screen.getByRole("button", { name: "Continuar" }));
}

async function preencherEtapa3Minima(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("button", { name: "Integral" }));
  await user.click(screen.getAllByRole("button", { name: "Não" })[0]);
  await user.type(screen.getByLabelText("Onde você teve conhecimento dessa vaga?"), "Instagram");
  await user.click(screen.getAllByRole("button", { name: "Não" })[1]);
}

async function irParaEtapa7(user: ReturnType<typeof userEvent.setup>, container: HTMLElement) {
  await irParaEtapa3(user, container);
  await preencherEtapa3Minima(user);
  await user.click(screen.getByRole("button", { name: "Continuar" }));

  await user.type(screen.getByLabelText("Formação"), "Ensino médio completo");
  await user.type(screen.getByLabelText("Quais outras habilidades gostaria de aprender?"), "Edição de vídeo");
  await user.click(screen.getByRole("button", { name: "Continuar" }));

  await user.click(screen.getByRole("button", { name: "Continuar" }));

  for (const pergunta of PERGUNTAS_SOBRE_VOCE) {
    await user.type(screen.getByLabelText(pergunta.label), "Resposta de teste");
  }
  await user.click(screen.getByRole("button", { name: "Continuar" }));
}

beforeEach(() => {
  enviarFichaPublicaMock.mockClear();
});

describe("Ficha digital - etapa 1", () => {
  test("digitação contínua mantém o foco e registra o texto completo", async () => {
    const user = userEvent.setup();
    const { container } = render(<FormularioFicha token="t" nome="" />);
    const nome = inputs(container)[1];

    await user.click(nome);
    await user.keyboard("Maria da Silva Teste");

    expect(document.activeElement).toBe(nome);
    expect((nome as HTMLInputElement).value).toBe("Maria da Silva Teste");
  });

  test("CPF inválido mostra erro e CPF válido remove o erro", () => {
    const { container } = render(<FormularioFicha token="t" nome="X" />);
    const cpf = inputs(container)[5];
    fireEvent.change(cpf, { target: { value: "111.111.111-11" } });
    expect(screen.queryByText("CPF inválido")).toBeTruthy();
    fireEvent.change(cpf, { target: { value: "529.982.247-25" } });
    expect(screen.queryByText("CPF inválido")).toBeNull();
  });

  test("validação bloqueia Continuar com campos vazios", async () => {
    const user = userEvent.setup();
    render(<FormularioFicha token="t" nome="" />);
    await user.click(screen.getByRole("button", { name: "Continuar" }));
    expect(screen.getByText(/Preencha: Nome completo/)).toBeTruthy();
    expect(screen.getByText(/Etapa 1 de 7/)).toBeTruthy();
  });
});

describe("Pergunta condicional de moradia", () => {
  test("zero oculta campos; valor positivo exige, exibe e limpa os campos ao voltar para zero", async () => {
    const user = userEvent.setup();
    const { container } = render(<FormularioFicha token="t" nome="" />);
    await irParaEtapa2(user, container);

    const quantidade = screen.getByLabelText("Você mora com quantas pessoas, tirando você?");
    fireEvent.change(quantidade, { target: { value: "0" } });
    expect(screen.queryByLabelText("Quem são essas pessoas?")).toBeNull();

    fireEvent.change(quantidade, { target: { value: "2" } });
    expect(screen.getByLabelText("Quem são essas pessoas?")).toBeTruthy();
    expect(screen.getByLabelText("Qual o emprego/ocupação dessas pessoas?")).toBeTruthy();

    const nao = screen.getAllByRole("button", { name: "Não" });
    await user.click(nao[0]);
    await user.click(nao[1]);
    await user.click(screen.getByRole("button", { name: "Continuar" }));
    expect(screen.getByText(/Preencha quem são as pessoas/)).toBeTruthy();

    await user.type(screen.getByLabelText("Quem são essas pessoas?"), "Pais");
    await user.click(screen.getByRole("button", { name: "Continuar" }));
    expect(screen.getByText(/Preencha o emprego\/ocupação/)).toBeTruthy();
    await user.type(screen.getByLabelText("Qual o emprego/ocupação dessas pessoas?"), "Comerciantes");

    fireEvent.change(quantidade, { target: { value: "0" } });
    expect(screen.queryByLabelText("Quem são essas pessoas?")).toBeNull();
    fireEvent.change(quantidade, { target: { value: "1" } });
    expect((screen.getByLabelText("Quem são essas pessoas?") as HTMLInputElement).value).toBe("");
    expect((screen.getByLabelText("Qual o emprego/ocupação dessas pessoas?") as HTMLInputElement).value).toBe("");
  });

  test("botão Voltar preserva os dados da etapa anterior", async () => {
    const user = userEvent.setup();
    const { container } = render(<FormularioFicha token="t" nome="" />);
    await irParaEtapa2(user, container);
    await user.click(screen.getByRole("button", { name: "Voltar" }));
    expect(screen.getByText(/Etapa 1 de 7/)).toBeTruthy();
    expect((inputs(container)[1] as HTMLInputElement).value).toBe("Maria Teste");
  });
});

describe("Pergunta condicional de renda extra", () => {
  test("Sim exige descrição e trocar para Não limpa o texto", async () => {
    const user = userEvent.setup();
    const { container } = render(<FormularioFicha token="t" nome="" />);
    await irParaEtapa3(user, container);

    await user.click(screen.getByRole("button", { name: "Integral" }));
    await user.click(screen.getAllByRole("button", { name: "Não" })[0]);
    await user.type(screen.getByLabelText("Onde você teve conhecimento dessa vaga?"), "Instagram");
    await user.click(screen.getAllByRole("button", { name: "Sim" })[1]);

    expect(screen.getByLabelText("Qual atividade você faz para obter renda extra?")).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Continuar" }));
    expect(screen.getByText(/Informe qual atividade/)).toBeTruthy();

    await user.type(screen.getByLabelText("Qual atividade você faz para obter renda extra?"), "Venda de doces");
    await user.click(screen.getAllByRole("button", { name: "Não" })[1]);
    expect(screen.queryByLabelText("Qual atividade você faz para obter renda extra?")).toBeNull();

    await user.click(screen.getAllByRole("button", { name: "Sim" })[1]);
    expect((screen.getByLabelText("Qual atividade você faz para obter renda extra?") as HTMLTextAreaElement).value).toBe("");
    await user.click(screen.getAllByRole("button", { name: "Não" })[1]);
    await user.click(screen.getByRole("button", { name: "Continuar" }));
    expect(screen.getByText(/Etapa 4 de 7/)).toBeTruthy();
  });
});

describe("Upload obrigatório de currículo", () => {
  test("bloqueia sem arquivo, rejeita formato inválido e permite remover e substituir", async () => {
    const user = userEvent.setup({ applyAccept: false });
    const { container } = render(<FormularioFicha token="token-teste" nome="" />);
    await irParaEtapa7(user, container);

    await user.click(screen.getByRole("button", { name: "Enviar ficha" }));
    expect(screen.getByText(/Anexe seu currículo em PDF, DOC ou DOCX/)).toBeTruthy();
    expect(enviarFichaPublicaMock).not.toHaveBeenCalled();

    const input = screen.getByLabelText("Anexe seu currículo");
    await user.upload(input, new File(["texto"], "curriculo.txt", { type: "text/plain" }));
    expect(screen.getByText(/Envie um currículo em PDF, DOC ou DOCX/)).toBeTruthy();

    await user.upload(input, new File(["pdf"], "curriculo.pdf", { type: "application/pdf" }));
    expect(screen.getByText("✓ curriculo.pdf")).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Remover arquivo" }));
    expect(screen.queryByText("✓ curriculo.pdf")).toBeNull();

    await user.upload(input, new File(["doc"], "curriculo.doc", { type: "application/msword" }));
    expect(screen.getByText("✓ curriculo.doc")).toBeTruthy();
    await user.upload(input, new File(["docx"], "curriculo-novo.docx", {
      type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    }));
    expect(screen.queryByText("✓ curriculo.doc")).toBeNull();
    expect(screen.getByText("✓ curriculo-novo.docx")).toBeTruthy();

    await user.click(screen.getByRole("button", { name: "Enviar ficha" }));
    expect(enviarFichaPublicaMock).toHaveBeenCalledOnce();
    const formData = enviarFichaPublicaMock.mock.calls[0][1] as FormData;
    expect((formData.get("curriculo") as File).name).toBe("curriculo-novo.docx");
    expect(formData.get("quantidade_pessoas_mora_junto")).toBe("0");
    expect(formData.get("renda_extra")).toBe("nao");
    expect(formData.get("renda_extra_descricao")).toBeNull();
  });
});
