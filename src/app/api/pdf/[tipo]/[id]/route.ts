import { NextRequest, NextResponse } from "next/server";
import { PDFDocument, StandardFonts, rgb, PDFFont, PDFPage } from "pdf-lib";
import { createClient } from "@/lib/supabase/server";
import { getPerfil } from "@/lib/auth";
import { formatarCpf, formatarTelefone } from "@/lib/cpf";
import { requisitosPrincipais, fmtData, fmtDataHora, fmtMoeda, ETAPA_LABELS, STATUS_FICHA_LABELS, STATUS_EQUIPE_LABELS, PERGUNTAS_SOBRE_VOCE } from "@/lib/constants";

export const dynamic = "force-dynamic";

function limpa(s: string): string {
  // Remove caracteres fora do WinAnsi (emojis etc.)
  return (s || "").replace(/[^\x00-\xFF–—‘’“”…]/g, "");
}

class Doc {
  pdf!: PDFDocument;
  page!: PDFPage;
  font!: PDFFont;
  bold!: PDFFont;
  y = 0;
  margin = 50;
  width = 595.28;
  height = 841.89;

  async init() {
    this.pdf = await PDFDocument.create();
    this.font = await this.pdf.embedFont(StandardFonts.Helvetica);
    this.bold = await this.pdf.embedFont(StandardFonts.HelveticaBold);
    this.novaPagina();
  }
  novaPagina() {
    this.page = this.pdf.addPage([this.width, this.height]);
    this.y = this.height - this.margin;
  }
  check(alt: number) {
    if (this.y - alt < this.margin) this.novaPagina();
  }
  titulo(t: string) {
    this.check(30);
    this.page.drawText(limpa(t), { x: this.margin, y: this.y, size: 16, font: this.bold, color: rgb(0.75, 0.27, 0.05) });
    this.y -= 26;
  }
  secao(t: string) {
    this.check(26);
    this.y -= 6;
    this.page.drawText(limpa(t), { x: this.margin, y: this.y, size: 12, font: this.bold });
    this.y -= 18;
  }
  linha(label: string, valor: string) {
    this.texto(`${label}: ${valor}`, 10);
  }
  texto(t: string, size = 10) {
    const maxW = this.width - this.margin * 2;
    const palavras = limpa(t).split(/\s+/);
    let linha = "";
    const linhas: string[] = [];
    for (const p of palavras) {
      const teste = linha ? `${linha} ${p}` : p;
      if (this.font.widthOfTextAtSize(teste, size) > maxW) {
        if (linha) linhas.push(linha);
        linha = p;
      } else linha = teste;
    }
    if (linha) linhas.push(linha);
    for (const l of linhas) {
      this.check(14);
      this.page.drawText(l, { x: this.margin, y: this.y, size, font: this.font });
      this.y -= 14;
    }
  }
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ tipo: string; id: string }> }) {
  const perfil = await getPerfil();
  if (!perfil) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  const acessoTotal = perfil.papel === "acesso_total";
  const supabase = await createClient();
  const { tipo, id } = await params;

  const doc = new Doc();
  await doc.init();
  let nomeArquivo = "documento";

  async function addObservacoes(entidadeTipo: string, entidadeId: string) {
    const { data: obs } = await supabase.from("observacoes")
      .select("*").eq("entidade_tipo", entidadeTipo).eq("entidade_id", entidadeId)
      .eq("apagado", false).order("criado_em", { ascending: true });
    if (obs && obs.length) {
      doc.secao("Observações internas");
      for (const o of obs) {
        doc.texto(`[${fmtDataHora(o.criado_em)} - ${o.criado_por_nome || "—"}] ${o.texto}`);
      }
    }
  }

  function addRespostas(r: Record<string, unknown>) {
    doc.secao("Dados da ficha");
    doc.linha("Vaga pretendida", String(r.vaga_pretendida));
    doc.linha("Nome completo", String(r.nome_completo));
    doc.linha("Idade", String(r.idade));
    doc.linha("Endereço", String(r.endereco));
    doc.linha("WhatsApp", formatarTelefone(String(r.whatsapp)));
    doc.linha("CPF", formatarCpf(String(r.cpf)));
    doc.linha("Tamanho de camisa", String(r.tamanho_camisa));
    doc.linha("E-mail", String(r.email));
    doc.linha("Instagram", String(r.instagram || "—"));
    doc.linha("Estado civil", String(r.estado_civil));
    doc.linha("Filhos", r.tem_filhos ? `Sim, ${r.quantidade_filhos} (${r.idades_filhos})` : "Não");
    doc.linha("Quantidade de pessoas com quem mora", String(r.quantidade_pessoas_mora_junto ?? "Não informado"));
    doc.linha("Quem são", String(r.mora_com_quem || r.mora_com || "—"));
    doc.linha("Emprego/ocupação dessas pessoas", String(r.emprego_ocupacao_pessoas_mora_junto || r.profissao_pessoas_mora_com || "—"));
    doc.linha("Trabalha atualmente", r.trabalha_atualmente ? `Sim - ${r.cargo_atual}` : "Não");
    doc.linha("Disponibilidade para viajar", r.disponibilidade_viajar === "integral" ? "Integral" : r.disponibilidade_viajar === "parcial" ? "Parcial" : "Não tem");
    if (r.disponibilidade_viajar_explicacao) doc.linha("Explicação", String(r.disponibilidade_viajar_explicacao));
    doc.linha("Conhecido no Grupo Eugênio", r.tem_conhecido_grupo ? `Sim - ${r.conhecido_nome} (${r.conhecido_relacao})` : "Não");
    doc.linha("Origem da vaga", String(r.origem_vaga));
    doc.linha(
      "Renda extra",
      r.renda_extra === "sim"
        ? `Sim - ${String(r.renda_extra_descricao || "sem descrição")}`
        : r.renda_extra === "nao"
          ? "Não"
          : String(r.renda_extra),
    );
    doc.linha("Formação", String(r.formacao));
    doc.linha("Quer aprender", String(r.habilidades_quer_aprender));
    doc.linha("Equipamentos", [
      r.moto_propria && "Moto", r.carro_proprio && "Carro", r.notebook_proprio && "Notebook",
      r.internet_casa && "Internet em casa", r.celular_android && "Android", r.celular_ios && "iOS",
      r.tem_cnh && `CNH ${r.cnh_categoria || ""}`,
    ].filter(Boolean).join(", ") || "Nenhum");
    doc.linha("Ferramentas", ((r.ferramentas_json as string[]) || []).join(", ") || "—");
    if (r.ferramentas_outros) doc.linha("Outras ferramentas", String(r.ferramentas_outros));
    doc.linha("Horas livres", ((r.horas_livres_json as string[]) || []).join(", ") || "—");
    doc.secao("Sobre você");
    const sv = (r.respostas_sobre_voce_json || {}) as Record<string, string>;
    for (const p of PERGUNTAS_SOBRE_VOCE) {
      doc.texto(`${p.label}`, 9);
      doc.texto(`R: ${sv[p.key] || "—"}`);
    }
    const reqs = requisitosPrincipais(r as Parameters<typeof requisitosPrincipais>[0]);
    doc.secao(`Requisitos principais: ${reqs.pontos} de 4`);
    doc.linha("Disponibilidade para viajar", reqs.disponibilidade ? "Sim" : "Não");
    doc.linha("Notebook próprio", reqs.notebook ? "Sim" : "Não");
    doc.linha("Veículo próprio", reqs.veiculo ? "Sim" : "Não");
    doc.linha("CNH", reqs.cnh ? "Sim" : "Não");
  }

  if (tipo === "ficha") {
    const { data: ficha } = await supabase.from("fichas").select("*, ficha_respostas(*)").eq("id", id).single();
    if (!ficha) return NextResponse.json({ error: "Não encontrada" }, { status: 404 });
    const r = Array.isArray(ficha.ficha_respostas) ? ficha.ficha_respostas[0] : ficha.ficha_respostas;
    nomeArquivo = `ficha-${(r?.nome_completo || ficha.nome_inicial).replace(/\s+/g, "-").toLowerCase()}`;
    doc.titulo("180 Graus - Ficha Cadastral");
    doc.linha("Status", STATUS_FICHA_LABELS[ficha.status] || ficha.status);
    doc.linha("Enviada em", fmtDataHora(ficha.ficha_enviada_em));
    doc.linha("Currículo anexado", ficha.curriculo_url ? "Sim" : "Não");
    if (r) addRespostas(r);
    await addObservacoes("ficha", id);
  } else if (tipo === "candidato") {
    const { data: c } = await supabase.from("candidatos").select("*").eq("id", id).single();
    if (!c) return NextResponse.json({ error: "Não encontrado" }, { status: 404 });
    nomeArquivo = `candidato-${c.nome.replace(/\s+/g, "-").toLowerCase()}`;
    doc.titulo("180 Graus - Candidato em Processo");
    doc.linha("Nome", c.nome);
    doc.linha("CPF", formatarCpf(c.cpf));
    doc.linha("Telefone", formatarTelefone(c.telefone || ""));
    doc.linha("Vaga", c.vaga_pretendida || "—");
    doc.linha("Status atual", ETAPA_LABELS[c.status] || c.status);
    doc.linha("Na etapa desde", fmtData(c.etapa_atual_desde));
    doc.linha("Currículo anexado", c.curriculo_url ? "Sim" : "Não");
    if (c.rejeicao_motivo) doc.linha("Motivo da rejeição", c.rejeicao_motivo);

    const { data: etapas } = await supabase.from("candidato_etapas").select("*").eq("candidato_id", id).order("criado_em", { ascending: true });
    if (etapas && etapas.length) {
      doc.secao("Histórico de etapas");
      for (const e of etapas) {
        doc.texto(`${ETAPA_LABELS[e.tipo_etapa] || e.tipo_etapa} - ${fmtData(e.data)}${e.horario ? ` às ${String(e.horario).slice(0, 5)}` : ""}${e.duracao_minutos ? ` (${e.duracao_minutos} min)` : ""}${e.entrevistador_nome ? ` - Entrevistou: ${e.entrevistador_nome}` : ""} - Resultado: ${e.resultado || "—"}`);
        if (e.observacoes) doc.texto(`Obs: ${e.observacoes}`, 9);
        if (e.arquivo_url) doc.texto("Redação anexada: Sim", 9);
      }
    }
    const { data: ficha } = await supabase.from("fichas").select("*, ficha_respostas(*)").eq("id", c.ficha_id).single();
    const r = ficha ? (Array.isArray(ficha.ficha_respostas) ? ficha.ficha_respostas[0] : ficha.ficha_respostas) : null;
    if (r) addRespostas(r);
    await addObservacoes("candidato", id);
  } else if (tipo === "equipe") {
    const { data: m } = await supabase.from("equipe").select("*").eq("id", id).single();
    if (!m) return NextResponse.json({ error: "Não encontrado" }, { status: 404 });
    nomeArquivo = `equipe-${m.nome.replace(/\s+/g, "-").toLowerCase()}`;
    doc.titulo("180 Graus - Equipe Atual");
    doc.linha("Nome", m.nome);
    doc.linha("CPF", formatarCpf(m.cpf));
    doc.linha("Telefone", formatarTelefone(m.telefone));
    doc.linha("Cargo", m.cargo);
    doc.linha("Salário", fmtMoeda(m.salario));
    doc.linha("Data de entrada", fmtData(m.data_entrada));
    doc.linha("Status", STATUS_EQUIPE_LABELS[m.status] || m.status);
    doc.linha("Origem", m.origem === "processo_seletivo" ? "Processo seletivo" : "Cadastro direto");
    if (m.status === "desligado") {
      doc.linha("Data de saída", fmtData(m.data_saida));
      doc.linha("Motivo", m.motivo_saida || "—");
    }
    if (m.indicado_por_equipe_id) {
      const { data: ind } = await supabase.from("equipe").select("nome").eq("id", m.indicado_por_equipe_id).single();
      doc.linha("Quem indicou", ind?.nome || "—");
    }
    const { data: bonus } = await supabase.from("bonus_indicacao")
      .select("*, indicado:indicado_equipe_id(nome)").eq("indicador_equipe_id", id);
    if (bonus && bonus.length) {
      doc.secao("Bônus por indicação");
      for (const b of bonus) {
        doc.texto(`Indicou ${(b.indicado as { nome?: string })?.nome || "—"} - ${fmtData(b.gerado_em)} - ${b.valor != null ? fmtMoeda(b.valor) : "valor pendente de configuração"} - ${b.status}`);
      }
    }
    // Dados bancários: SOMENTE acesso_total (RLS também bloqueia no banco)
    if (acessoTotal) {
      const { data: db } = await supabase.from("dados_bancarios").select("*").eq("equipe_id", id).maybeSingle();
      if (db) {
        doc.secao("Dados bancários (confidencial)");
        doc.linha("Banco", db.banco || "—");
        doc.linha("Agência", db.agencia || "—");
        doc.linha("Conta", db.conta || "—");
        doc.linha("Tipo", db.tipo_conta || "—");
        doc.linha("Titular", `${db.nome_titular || "—"} (${formatarCpf(db.cpf_titular || "") || "—"})`);
      }
    }
    await addObservacoes("equipe", id);
  } else {
    return NextResponse.json({ error: "Tipo inválido" }, { status: 400 });
  }

  const bytes = await doc.pdf.save();
  return new NextResponse(Buffer.from(bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${nomeArquivo}.pdf"`,
    },
  });
}
