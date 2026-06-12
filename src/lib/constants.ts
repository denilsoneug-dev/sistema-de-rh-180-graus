export const FERRAMENTAS = [
  "Word","Excel","PowerPoint","Photoshop","Illustrator","InDesign","ZBrush",
  "Corel Draw","After Effects","Canva PC","Canva Celular","InShot","AutoCAD",
  "SketchUp","SoundForge","XMind","Mindomo","Outros",
] as const;

export const HORAS_LIVRES = [
  "Assistir séries e/ou filmes","Ir à igreja","Praticar esportes","Ler um livro",
  "Sair com amigos","Tocar instrumentos musicais","Ficar em casa com a família",
  "Viajar","Dormir","Estudar para concursos","Estudar assuntos que gosta",
  "Ouvir música","Vender produtos e serviços",
] as const;

export const PERGUNTAS_SOBRE_VOCE: { key: string; label: string }[] = [
  { key: "no_futuro", label: "No futuro eu…" },
  { key: "pensam_que_sou", label: "Quando ainda não me conhecem, as pessoas pensam que eu sou…" },
  { key: "sabem_que_sou", label: "As pessoas que realmente me conhecem sabem que eu sou…" },
  { key: "ex_chefe", label: "Como o seu ex-chefe lhe definiria?" },
  { key: "tira_do_serio", label: "O que lhe tira do sério?" },
  { key: "valores_lider", label: "Quais valores humanos você acredita que um líder deve ter?" },
  { key: "valores_proprios", label: "Quais valores humanos você mais gosta em si mesmo?" },
  { key: "proximas_conquistas", label: "Quais suas próximas duas conquistas?" },
  { key: "tempo_conquistas", label: "Em quanto tempo você vai conquistá-las?" },
  { key: "pontos_positivos", label: "Cite dois pontos positivos seus" },
  { key: "pontos_melhoria", label: "Cite dois pontos de melhoria seus" },
  { key: "ultimo_livro", label: "Último livro que você leu" },
  { key: "frase_define", label: "Cite uma frase que lhe define bem" },
  { key: "motivo_escolher", label: "Dê-nos um motivo para escolhermos você" },
];

export const ETAPA_LABELS: Record<string, string> = {
  entrevista_online: "Entrevista online",
  entrevista_presencial: "Entrevista presencial",
  redacao_escrita: "Redação escrita",
  em_treinamento: "Em treinamento",
  treinamento: "Treinamento",
  rejeitado: "Rejeitado",
  efetivado: "Efetivado",
};

export const STATUS_FICHA_LABELS: Record<string, string> = {
  pendente: "Pendente",
  recebida: "Recebida",
  arquivada: "Arquivada",
  rejeitada: "Rejeitada",
  expirada: "Expirada",
  selecionada: "Selecionada",
};

export const STATUS_EQUIPE_LABELS: Record<string, string> = {
  ativo: "Ativo",
  em_experiencia: "Em experiência",
  afastado: "Afastado",
  desligado: "Desligado",
};

export const STATUS_BONUS_LABELS: Record<string, string> = {
  pendente: "Pendente",
  pago: "Pago",
  cancelado: "Cancelado",
};

export function requisitosPrincipais(r: {
  disponibilidade_viajar?: string | null;
  notebook_proprio?: boolean | null;
  moto_propria?: boolean | null;
  carro_proprio?: boolean | null;
  tem_cnh?: boolean | null;
}) {
  const disponibilidade = r.disponibilidade_viajar === "integral";
  const notebook = !!r.notebook_proprio;
  const veiculo = !!r.moto_propria || !!r.carro_proprio;
  const cnh = !!r.tem_cnh;
  const pontos = [disponibilidade, notebook, veiculo, cnh].filter(Boolean).length;
  return { disponibilidade, notebook, veiculo, cnh, pontos };
}

export function diasDesde(data: string | Date | null | undefined): number {
  if (!data) return 0;
  return Math.floor((Date.now() - new Date(data).getTime()) / 86400000);
}

export function fmtData(d: string | Date | null | undefined): string {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
}

export function fmtDataHora(d: string | Date | null | undefined): string {
  if (!d) return "—";
  return new Date(d).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });
}

export function fmtMoeda(v: number | null | undefined): string {
  if (v === null || v === undefined) return "—";
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
