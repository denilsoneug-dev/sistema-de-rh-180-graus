import { NextResponse } from "next/server";
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import { getPerfil } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import {
  montarRelatorioEquipeAtual,
  type AuditoriaExportRaw,
  type BonusExportRaw,
  type CandidatoTreinamentoRaw,
  type EquipeExportRow,
  type EquipeRaw,
  type EtapaTreinamentoRaw,
  type ObservacaoExportRaw,
} from "@/lib/equipe-export";

export const dynamic = "force-dynamic";

function limpa(s: string): string {
  return (s || "").replace(/[^\x00-\xFF–—‘’“”…]/g, "");
}

function slug(s: string): string {
  return limpa(s).toLocaleLowerCase("pt-BR").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function dataHoraRelatorio(d: Date): string {
  return d.toLocaleString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).replace(",", "");
}

class TabelaPdf {
  pdf!: PDFDocument;
  page!: PDFPage;
  font!: PDFFont;
  bold!: PDFFont;
  y = 0;
  margin = 28;
  width = 841.89;
  height = 595.28;
  footer = "Gerado pelo Sistema de RH 180graus";

  async init() {
    this.pdf = await PDFDocument.create();
    this.font = await this.pdf.embedFont(StandardFonts.Helvetica);
    this.bold = await this.pdf.embedFont(StandardFonts.HelveticaBold);
    this.novaPagina();
  }

  novaPagina() {
    this.page = this.pdf.addPage([this.width, this.height]);
    this.y = this.height - this.margin;
    this.page.drawText(this.footer, { x: this.margin, y: 18, size: 8, font: this.font, color: rgb(0.35, 0.39, 0.45) });
  }

  check(altura: number) {
    if (this.y - altura < 36) this.novaPagina();
  }

  texto(t: string, x: number, y: number, size: number, font = this.font, color = rgb(0.08, 0.1, 0.14)) {
    this.page.drawText(limpa(t), { x, y, size, font, color });
  }

  linhas(t: string, largura: number, size: number, font = this.font, maxLinhas = 3): string[] {
    const palavras = limpa(t || "—").split(/\s+/);
    const linhas: string[] = [];
    let linha = "";
    for (const p of palavras) {
      const teste = linha ? `${linha} ${p}` : p;
      if (font.widthOfTextAtSize(teste, size) > largura) {
        if (linha) linhas.push(linha);
        linha = p;
      } else {
        linha = teste;
      }
      if (linhas.length === maxLinhas) break;
    }
    if (linha && linhas.length < maxLinhas) linhas.push(linha);
    if (linhas.length === maxLinhas && palavras.join(" ").length > linhas.join(" ").length) {
      const ultima = linhas[maxLinhas - 1];
      linhas[maxLinhas - 1] = `${ultima.slice(0, Math.max(0, ultima.length - 3))}...`;
    }
    return linhas.length ? linhas : ["—"];
  }

  cabecalho(geradoEm: Date, total: number, acessoTotal: boolean) {
    this.texto("Relatório da Equipe Atual — 180graus", this.margin, this.y, 17, this.bold, rgb(0.75, 0.27, 0.05));
    this.y -= 20;
    this.texto("Efetivados e em treinamento", this.margin, this.y, 11, this.font, rgb(0.25, 0.3, 0.38));
    this.y -= 15;
    this.texto(`Data de geração: ${dataHoraRelatorio(geradoEm)} · Pessoas no relatório: ${total}`, this.margin, this.y, 9, this.font, rgb(0.38, 0.43, 0.5));
    this.y -= 11;
    this.texto(
      acessoTotal ? "Inclui campos financeiros permitidos para acesso total." : "Campos financeiros e dados bancários não incluídos para este perfil.",
      this.margin,
      this.y,
      8,
      this.font,
      rgb(0.45, 0.5, 0.57),
    );
    this.y -= 20;
  }

  tabela(linhas: EquipeExportRow[], acessoTotal: boolean) {
    const colunas = [
      { key: "nome", label: "Nome", w: 116 },
      { key: "telefone", label: "Telefone", w: 78 },
      { key: "cpf", label: "CPF", w: 78 },
      { key: "cargo", label: "Cargo/Função", w: 94 },
      { key: "status", label: "Status", w: 72 },
      { key: "dataEntrada", label: "Data de entrada", w: 70 },
      { key: "quemIndicou", label: "Indicação", w: 90 },
      ...(acessoTotal ? [{ key: "salario", label: "Salário", w: 66 }, { key: "bonusIndicacao", label: "Bônus", w: 70 }] : []),
      { key: "observacoes", label: "Observações", w: acessoTotal ? 92 : 190 },
    ] as const;

    const desenharHeader = () => {
      this.check(28);
      let x = this.margin;
      this.page.drawRectangle({ x: this.margin - 2, y: this.y - 5, width: this.width - this.margin * 2 + 4, height: 18, color: rgb(0.94, 0.96, 0.99) });
      for (const c of colunas) {
        this.texto(c.label, x, this.y, 7.5, this.bold, rgb(0.18, 0.24, 0.32));
        x += c.w;
      }
      this.y -= 18;
    };

    desenharHeader();
    for (const linha of linhas) {
      const partes = colunas.map((c) => this.linhas(String(linha[c.key as keyof EquipeExportRow] || "—"), c.w - 4, 7, this.font, c.key === "observacoes" ? 4 : 3));
      const altura = Math.max(...partes.map((p) => p.length)) * 9 + 8;
      this.check(altura + 18);
      if (this.y > this.height - this.margin - 8) desenharHeader();

      let x = this.margin;
      const yBase = this.y;
      for (let i = 0; i < colunas.length; i++) {
        const col = colunas[i];
        for (let j = 0; j < partes[i].length; j++) {
          this.texto(partes[i][j], x, yBase - j * 9, 7, this.font, rgb(0.11, 0.13, 0.17));
        }
        x += col.w;
      }
      this.y -= altura;
      this.page.drawLine({ start: { x: this.margin, y: this.y + 4 }, end: { x: this.width - this.margin, y: this.y + 4 }, thickness: 0.4, color: rgb(0.88, 0.9, 0.94) });
    }
  }
}

export async function GET() {
  const perfil = await getPerfil();
  if (!perfil) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const acessoTotal = perfil.papel === "acesso_total";
  const supabase = await createClient();

  const [{ data: equipe }, { data: candidatosTreinamento }] = await Promise.all([
    supabase.from("equipe").select("*").order("nome"),
    supabase.from("candidatos").select("*").eq("status", "em_treinamento").order("nome"),
  ]);

  const equipeLista = (equipe || []) as EquipeRaw[];
  const treinamentoLista = (candidatosTreinamento || []) as CandidatoTreinamentoRaw[];
  const candidatoIds = treinamentoLista.map((c) => c.id);
  const fichaIds = [...new Set(treinamentoLista.map((c) => c.ficha_id).filter((id): id is string => !!id))];
  const indicadorIds = [
    ...new Set([
      ...equipeLista.map((m) => m.indicado_por_equipe_id),
      ...treinamentoLista.map((c) => c.indicado_por_equipe_id),
    ].filter((id): id is string => !!id)),
  ];
  const equipeIds = equipeLista.map((m) => m.id);
  const candidatoOrigemIds = equipeLista.map((m) => m.candidato_origem_id).filter((id): id is string => !!id);

  const [
    { data: etapas },
    { data: indicadores },
    { data: respostasIndicacao },
    { data: obsEquipe },
    { data: obsCandidatos },
    { data: logsFicha },
    { data: logsEfetivacao },
    { data: bonus },
  ] = await Promise.all([
    candidatoIds.length > 0
      ? supabase.from("candidato_etapas").select("candidato_id, data, criado_em").in("candidato_id", candidatoIds).eq("tipo_etapa", "treinamento")
      : Promise.resolve({ data: [] }),
    indicadorIds.length > 0
      ? supabase.from("equipe").select("id, nome").in("id", indicadorIds)
      : Promise.resolve({ data: [] }),
    fichaIds.length > 0
      ? supabase.from("ficha_respostas").select("ficha_id, tem_conhecido_grupo, conhecido_nome").in("ficha_id", fichaIds)
      : Promise.resolve({ data: [] }),
    equipeIds.length > 0
      ? supabase.from("observacoes").select("entidade_tipo, entidade_id, texto, criado_por_nome, criado_em").eq("entidade_tipo", "equipe").in("entidade_id", equipeIds).eq("apagado", false).order("criado_em")
      : Promise.resolve({ data: [] }),
    candidatoIds.length > 0
      ? supabase.from("observacoes").select("entidade_tipo, entidade_id, texto, criado_por_nome, criado_em").eq("entidade_tipo", "candidato").in("entidade_id", candidatoIds).eq("apagado", false).order("criado_em")
      : Promise.resolve({ data: [] }),
    acessoTotal && fichaIds.length > 0
      ? supabase.from("audit_logs").select("entidade_tipo, entidade_id, usuario_nome, criado_em").eq("entidade_tipo", "ficha").in("entidade_id", fichaIds).in("acao", ["selecionou_para_processo", "selecionou_para_processo_idempotente"]).order("criado_em")
      : Promise.resolve({ data: [] }),
    acessoTotal && candidatoOrigemIds.length > 0
      ? supabase.from("audit_logs").select("entidade_tipo, entidade_id, usuario_nome, criado_em").eq("entidade_tipo", "candidato").in("entidade_id", candidatoOrigemIds).eq("acao", "efetivou_candidato").order("criado_em")
      : Promise.resolve({ data: [] }),
    acessoTotal && equipeIds.length > 0
      ? supabase.from("bonus_indicacao").select("indicador_equipe_id, valor, status").in("indicador_equipe_id", equipeIds)
      : Promise.resolve({ data: [] }),
  ]);

  const nomesEquipePorId = new Map((indicadores || []).map((i) => [String(i.id), String(i.nome)]));
  const indicacaoFichaPorFichaId = new Map(
    (respostasIndicacao || [])
      .filter((r) => r.tem_conhecido_grupo && r.conhecido_nome)
      .map((r) => [String(r.ficha_id), String(r.conhecido_nome)]),
  );
  const selecionadoresPorFichaId = new Map<string, string>();
  for (const log of (logsFicha || []) as AuditoriaExportRaw[]) {
    if (!selecionadoresPorFichaId.has(log.entidade_id)) selecionadoresPorFichaId.set(log.entidade_id, log.usuario_nome || "—");
  }
  const efetivadoresPorCandidatoId = new Map<string, string>();
  for (const log of (logsEfetivacao || []) as AuditoriaExportRaw[]) {
    if (!efetivadoresPorCandidatoId.has(log.entidade_id)) efetivadoresPorCandidatoId.set(log.entidade_id, log.usuario_nome || "—");
  }
  const bonusPorIndicadorId = new Map<string, BonusExportRaw[]>();
  for (const b of (bonus || []) as BonusExportRaw[]) {
    if (!b.indicador_equipe_id) continue;
    const lista = bonusPorIndicadorId.get(b.indicador_equipe_id) || [];
    lista.push(b);
    bonusPorIndicadorId.set(b.indicador_equipe_id, lista);
  }

  const linhas = montarRelatorioEquipeAtual({
    equipe: equipeLista,
    candidatosTreinamento: treinamentoLista,
    etapasTreinamento: (etapas || []) as EtapaTreinamentoRaw[],
    nomesEquipePorId,
    indicacaoFichaPorFichaId,
    observacoes: [...((obsEquipe || []) as ObservacaoExportRaw[]), ...((obsCandidatos || []) as ObservacaoExportRaw[])],
    selecionadoresPorFichaId,
    efetivadoresPorCandidatoId,
    bonusPorIndicadorId,
    perfil: perfil.papel,
  });

  const doc = new TabelaPdf();
  await doc.init();
  const agora = new Date();
  doc.cabecalho(agora, linhas.length, acessoTotal);
  doc.tabela(linhas, acessoTotal);

  const bytes = await doc.pdf.save();
  return new NextResponse(Buffer.from(bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${slug(`relatorio-equipe-atual-${agora.toISOString().slice(0, 10)}`)}.pdf"`,
    },
  });
}
