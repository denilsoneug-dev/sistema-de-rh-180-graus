import { describe, expect, test } from "vitest";
import { formatarCpf, mascararCpf, cpfPorPapel } from "@/lib/cpf";

describe("máscara de CPF", () => {
  const cpf = "12345678900";

  test("formatarCpf mostra completo", () => {
    expect(formatarCpf(cpf)).toBe("123.456.789-00");
  });

  test("mascararCpf esconde o miolo, mantém início e fim", () => {
    expect(mascararCpf(cpf)).toBe("123.***.***-00");
  });

  test("mascararCpf trata vazio/ inválido", () => {
    expect(mascararCpf("")).toBe("—");
    expect(mascararCpf("123")).toBe("•••.•••.•••-••");
  });

  test("cpfPorPapel: acesso total vê completo, visualização vê mascarado", () => {
    expect(cpfPorPapel(cpf, true)).toBe("123.456.789-00");
    expect(cpfPorPapel(cpf, false)).toBe("123.***.***-00");
  });
});
