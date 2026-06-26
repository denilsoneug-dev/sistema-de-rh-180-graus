export const CURRICULO_MAX_BYTES = 10 * 1024 * 1024;

export const CURRICULO_ACCEPT = [
  ".pdf",
  ".doc",
  ".docx",
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
].join(",");

const TIPOS_POR_EXTENSAO: Record<string, string[]> = {
  pdf: ["application/pdf"],
  doc: ["application/msword"],
  docx: ["application/vnd.openxmlformats-officedocument.wordprocessingml.document"],
};

export function extensaoCurriculo(nome: string): string {
  return nome.split(".").pop()?.toLowerCase() || "";
}

// Redação/comprovante anexado nas etapas do candidato (imagem ou PDF).
export const REDACAO_MAX_BYTES = 10 * 1024 * 1024;
const REDACAO_EXTENSOES = ["jpg", "jpeg", "png", "pdf"];

export function validarRedacaoArquivo(arquivo: Pick<File, "name" | "size" | "type">): string | null {
  const extensao = extensaoCurriculo(arquivo.name);
  if (!REDACAO_EXTENSOES.includes(extensao)) return "Arquivo deve ser JPG, PNG ou PDF.";
  if (arquivo.size <= 0) return "O arquivo selecionado está vazio.";
  if (arquivo.size > REDACAO_MAX_BYTES) return "Arquivo muito grande (máx. 10MB).";
  return null;
}

export function validarCurriculoArquivo(arquivo: Pick<File, "name" | "size" | "type">): string | null {
  const extensao = extensaoCurriculo(arquivo.name);
  const tiposPermitidos = TIPOS_POR_EXTENSAO[extensao];

  if (!tiposPermitidos) return "Envie um currículo em PDF, DOC ou DOCX.";
  if (!arquivo.type || !tiposPermitidos.includes(arquivo.type.toLowerCase())) {
    return "O tipo do arquivo não corresponde a um PDF, DOC ou DOCX válido.";
  }
  if (arquivo.size <= 0) return "O arquivo selecionado está vazio.";
  if (arquivo.size > CURRICULO_MAX_BYTES) return "Currículo muito grande (máx. 10MB).";
  return null;
}
