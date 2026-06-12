export function limparCpf(cpf: string): string {
  return (cpf || "").replace(/\D/g, "");
}

export function formatarCpf(cpf: string | null | undefined): string {
  const c = limparCpf(cpf || "");
  if (c.length !== 11) return cpf || "";
  return `${c.slice(0, 3)}.${c.slice(3, 6)}.${c.slice(6, 9)}-${c.slice(9)}`;
}

export function validarCpf(cpf: string): boolean {
  const c = limparCpf(cpf);
  if (c.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(c)) return false; // 000..., 111... etc
  let soma = 0;
  for (let i = 0; i < 9; i++) soma += parseInt(c[i]) * (10 - i);
  let resto = (soma * 10) % 11;
  if (resto === 10 || resto === 11) resto = 0;
  if (resto !== parseInt(c[9])) return false;
  soma = 0;
  for (let i = 0; i < 10; i++) soma += parseInt(c[i]) * (11 - i);
  resto = (soma * 10) % 11;
  if (resto === 10 || resto === 11) resto = 0;
  return resto === parseInt(c[10]);
}

export function limparTelefone(t: string): string {
  return (t || "").replace(/\D/g, "");
}

export function formatarTelefone(t: string | null | undefined): string {
  const c = limparTelefone(t || "");
  if (c.length === 11) return `(${c.slice(0, 2)}) ${c.slice(2, 7)}-${c.slice(7)}`;
  if (c.length === 10) return `(${c.slice(0, 2)}) ${c.slice(2, 6)}-${c.slice(6)}`;
  return t || "";
}
