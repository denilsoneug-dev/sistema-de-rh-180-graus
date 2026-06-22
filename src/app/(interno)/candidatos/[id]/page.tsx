import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getPerfil } from "@/lib/auth";
import { registrarEtapa, rejeitarCandidato, efetivarCandidato, encerrarTreinamento, voltarEtapa } from "@/app/actions/candidatos";
import { salvarRequisitosCandidato } from "@/app/actions/requisitos";
import { formatarTelefone, cpfPorPapel } from "@/lib/cpf";
import { ETAPA_LABELS, diasDesde, fmtData, resumoComOverride } from "@/lib/constants";
import { candidatoEstaEmProcesso } from "@/lib/equipe-treinamento";
import { ConfirmSubmit } from "@/components/ConfirmSubmit";
import { Observacoes } from "@/components/Observacoes";
import { ResumoRequisitos } from "@/components/ResumoRequisitos";
import { EditarRequisitos } from "@/components/EditarRequisitos";
import { Timeline, type EventoTimeline } from "@/components/Timeline";

const RESULTADO_LABEL: Record<string, string> = {
  passou: "Passou",
  nao_passou: "Não passou",
  ainda_nao_sabe: "Ainda não sabe",
  aprovado: "Aprovado",
  reprovado: "Reprovado",
  em_andamento: "Em andamento",
};

function jsonField(v: unknown, key: string): string | null {
  if (v && typeof v === "object" && key in (v as Record<string, unknown>)) {
    const val = (v as Record<string, unknown>)[key];
    return val == null ? null : String(val);
  }
  return null;
}

export const dynamic = "force-dynamic";

export default async function CandidatoDetalhe({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ origem?: string }> }) {
  const [{ id }, { origem }] = await Promise.all([params, searchParams]);
  const perfil = await getPerfil();
  const acessoTotal = perfil?.papel === "acesso_total";
  const supabase = await createClient();

  const { data: c } = await supabase.from("candidatos").select("*").eq("id", id).single();
  if (!c) notFound();

  const { data: etapas } = await supabase.from("candidato_etapas")
    .select("*").eq("candidato_id", id).order("criado_em", { ascending: false });

  const { data: ficha } = await supabase.from("fichas")
    .select("*, ficha_respostas(*)").eq("id", c.ficha_id).single();
  const r = ficha ? (Array.isArray(ficha.ficha_respostas) ? ficha.ficha_respostas[0] : ficha.ficha_respostas) : null;

  const { data: obs } = await supabase.from("observacoes")
    .select("*").eq("entidade_tipo", "candidato").eq("entidade_id", id)
    .eq("apagado", false).order("criado_em", { ascending: false });

  const { data: equipe } = acessoTotal
    ? await supabase.from("equipe").select("id, nome").in("status", ["ativo", "em_experiencia"]).order("nome")
    : { data: [] };
  const indicador = c.indicado_por_equipe_id
    ? (equipe || []).find((m) => m.id === c.indicado_por_equipe_id) ||
      (await supabase.from("equipe").select("id, nome").eq("id", c.indicado_por_equipe_id).maybeSingle()).data
    : null;
  const indicacaoFicha = !indicador && r?.tem_conhecido_grupo && r?.conhecido_nome
    ? String(r.conhecido_nome)
    : null;

  const emSelecao = candidatoEstaEmProcesso(c.status); // entrevistas + redação (fonte única)
  const isTreinamento = c.status === "em_treinamento";
  const isRedacao = c.status === "redacao_escrita";
  const podeRegistrar = emSelecao || isTreinamento; // registrar etapa vale p/ seleção e treinamento
  const treinamentoAprovado = (etapas || []).some((e) => e.tipo_etapa === "treinamento" && e.resultado === "aprovado");
  const dias = diasDesde(c.etapa_atual_desde);
  const ordemEtapas = ["entrevista_online", "entrevista_presencial", "redacao_escrita", "em_treinamento"] as const;
  const etapaAtualIdx = ordemEtapas.indexOf(c.status as (typeof ordemEtapas)[number]);
  const proximasEtapas = etapaAtualIdx >= 0 ? ordemEtapas.slice(etapaAtualIdx + 1) : [];
  const etapaSugerida = proximasEtapas[0];
  // Etapas anteriores (para "voltar etapa")
  const etapasAnteriores = etapaAtualIdx > 0 ? ordemEtapas.slice(0, etapaAtualIdx) : [];
  const podeVoltar = (emSelecao || isTreinamento) && etapasAnteriores.length > 0;

  // ---- Linha do tempo (timeline) ----
  const eventos: EventoTimeline[] = [];

  // Marcos com autor vêm do audit_logs (RLS: somente acesso_total lê).
  if (acessoTotal) {
    const [{ data: logsFicha }, { data: logsCand }] = await Promise.all([
      c.ficha_id
        ? supabase.from("audit_logs")
            .select("acao, usuario_nome, criado_em")
            .eq("entidade_tipo", "ficha").eq("entidade_id", c.ficha_id)
            .in("acao", ["selecionou_para_processo", "selecionou_para_processo_idempotente"])
        : Promise.resolve({ data: [] as { acao: string; usuario_nome: string | null; criado_em: string }[] }),
      supabase.from("audit_logs")
        .select("acao, usuario_nome, dados_antes, dados_depois, criado_em")
        .eq("entidade_tipo", "candidato").eq("entidade_id", id),
    ]);

    for (const l of logsFicha || []) {
      eventos.push({ ts: l.criado_em, titulo: "Ficha selecionada para o processo", detalhe: "Candidato gerado automaticamente.", autor: l.usuario_nome, tom: "brand" });
    }
    for (const l of (logsCand || []) as { acao: string; usuario_nome: string | null; dados_antes: unknown; dados_depois: unknown; criado_em: string }[]) {
      const de = jsonField(l.dados_antes, "etapa");
      const para = jsonField(l.dados_depois, "etapa");
      if (l.acao === "mudou_etapa" && para) {
        eventos.push({ ts: l.criado_em, titulo: `Avançou para ${ETAPA_LABELS[para] || para}`, detalhe: de ? `De ${ETAPA_LABELS[de] || de}` : null, autor: l.usuario_nome, tom: "brand" });
      } else if (l.acao === "voltou_etapa" && para) {
        eventos.push({ ts: l.criado_em, titulo: `Voltou para ${ETAPA_LABELS[para] || para}`, detalhe: de ? `De ${ETAPA_LABELS[de] || de}` : null, autor: l.usuario_nome, tom: "amber" });
      } else if (l.acao === "rejeitou_candidato") {
        eventos.push({ ts: l.criado_em, titulo: "Candidato rejeitado", detalhe: jsonField(l.dados_depois, "motivo"), autor: l.usuario_nome, tom: "red" });
      } else if (l.acao === "encerrou_treinamento") {
        eventos.push({ ts: l.criado_em, titulo: "Treinamento encerrado (não aprovado)", detalhe: jsonField(l.dados_depois, "motivo"), autor: l.usuario_nome, tom: "amber" });
      } else if (l.acao === "efetivou_candidato") {
        eventos.push({ ts: l.criado_em, titulo: "Efetivado na equipe", autor: l.usuario_nome, tom: "emerald" });
      }
    }
  }

  // Gênese (sempre).
  eventos.push({ ts: c.criado_em, titulo: "Candidato criado — Entrevista online", tom: "brand" });

  // Registros detalhados de cada etapa (sempre).
  for (const e of etapas || []) {
    const partes: string[] = [];
    if (e.resultado) partes.push(`Resultado: ${RESULTADO_LABEL[e.resultado as string] || e.resultado}`);
    if (e.data) partes.push(`Quando: ${fmtData(e.data)}${e.horario ? ` às ${String(e.horario).slice(0, 5)}` : ""}`);
    if (e.observacoes) partes.push(String(e.observacoes));
    const ok = e.resultado === "passou" || e.resultado === "aprovado";
    const ruim = e.resultado === "nao_passou" || e.resultado === "reprovado";
    eventos.push({
      ts: e.criado_em,
      titulo: `Registro: ${ETAPA_LABELS[e.tipo_etapa as string] || e.tipo_etapa}`,
      detalhe: partes.join("\n") || null,
      autor: e.entrevistador_nome,
      tom: ok ? "emerald" : ruim ? "red" : "slate",
      link: e.arquivo_url && acessoTotal
        ? { href: `/api/arquivo?bucket=redacoes&path=${encodeURIComponent(e.arquivo_url)}`, label: "Ver redação anexada" }
        : null,
    });
  }

  // Fallback para visualização (sem acesso ao audit_logs).
  if (!acessoTotal) {
    if (c.status === "rejeitado" && c.rejeitado_em) eventos.push({ ts: c.rejeitado_em, titulo: "Candidato rejeitado", detalhe: c.rejeicao_motivo, tom: "red" });
    if (c.status === "treinamento_encerrado" && c.rejeitado_em) eventos.push({ ts: c.rejeitado_em, titulo: "Treinamento encerrado", detalhe: c.rejeicao_motivo, tom: "amber" });
    if (c.efetivado_em) eventos.push({ ts: c.efetivado_em, titulo: "Efetivado na equipe", tom: "emerald" });
  }

  eventos.sort((a, b) => new Date(a.ts).getTime() - new Date(b.ts).getTime());

  return (
    <div className="space-y-4 max-w-3xl">
      {origem === "candidato-criado" && (
        <div className="card border-l-4 border-l-emerald-500 bg-emerald-50/60 p-4 text-sm text-emerald-800">
          <p className="font-semibold">Candidato criado com sucesso.</p>
          <p>Etapa inicial: Entrevista online.</p>
        </div>
      )}
      {origem === "ficha-ja-convertida" && (
        <div className="card border-l-4 border-l-brand-500 bg-brand-50/60 p-4 text-sm text-brand-800">
          <p className="font-semibold">Esta ficha já foi convertida em candidato.</p>
          <p>O sistema abriu o candidato existente para evitar duplicidade.</p>
        </div>
      )}

      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-xl font-bold">{c.nome}</h1>
          <p className="text-sm text-gray-500">CPF {cpfPorPapel(c.cpf, acessoTotal)} · {formatarTelefone(c.telefone)} · {c.vaga_pretendida || "—"}</p>
          <div className="flex items-center gap-2 mt-1">
            <span className="badge bg-blue-100 text-blue-800">{ETAPA_LABELS[c.status as string] || c.status}</span>
            {podeRegistrar && <span className="text-sm text-gray-500">há {dias} dia(s) nesta etapa (desde {fmtData(c.etapa_atual_desde)})</span>}
          </div>
        </div>
        <div className="flex gap-2">
          <a className="btn-secondary" href={`/api/pdf/candidato/${c.id}`} target="_blank">Exportar PDF</a>
          {ficha && <Link className="btn-secondary" href={`/fichas/${ficha.id}`}>Ver ficha</Link>}
        </div>
      </div>

      {isTreinamento && (
        <div className="card p-4 border-l-4 border-l-brand-500 bg-brand-50/60">
          <p className="font-semibold text-brand-800">Esta pessoa está em treinamento e já aparece na Equipe.</p>
          <p className="mt-1 text-sm text-brand-700">
            Treinamento já é operação — não é mais seleção. Ainda não é ativo definitivo nem efetivado.{" "}
            <Link href="/equipe?tab=em_treinamento" className="font-medium underline underline-offset-2">Ver em Equipe › Em treinamento</Link>.
          </p>
        </div>
      )}

      <ResumoRequisitos
        variante="detalhado"
        resumo={resumoComOverride(r, c)}
        semFichaMsg="Requisitos não informados (sem ficha vinculada)."
      />
      <div className="card p-4 text-sm">
        <p><span className="text-gray-500">Quem indicou:</span> {indicador?.nome || indicacaoFicha || "Sem indicação informada"}</p>
      </div>
      {acessoTotal && <EditarRequisitos action={salvarRequisitosCandidato.bind(null, c.id)} valores={c} />}

      {c.curriculo_url && acessoTotal && (
        <div className="card p-4 flex items-center justify-between flex-wrap gap-2">
          <h3 className="font-bold">Currículo</h3>
          <div className="flex gap-2 w-full sm:w-auto">
            <a className="btn-secondary flex-1 sm:flex-none" href={`/api/arquivo?bucket=curriculos&path=${encodeURIComponent(c.curriculo_url)}`} target="_blank">Ver</a>
            <a className="btn-secondary flex-1 sm:flex-none" href={`/api/arquivo?bucket=curriculos&path=${encodeURIComponent(c.curriculo_url)}&download=1`}>Baixar</a>
          </div>
        </div>
      )}

      {podeRegistrar && acessoTotal && (
        <div className="card p-4 space-y-3">
          <h3 className="font-bold">{isTreinamento ? "Registrar acompanhamento do treinamento" : `Registrar ${ETAPA_LABELS[c.status as string]?.toLowerCase()}`}</h3>
          {!isTreinamento && (
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600">
              <p className="font-medium text-slate-700">Fluxo recomendado</p>
              <p>Entrevista online → Entrevista presencial → Redação escrita → Em treinamento → Efetivação.</p>
            </div>
          )}
          <form action={registrarEtapa.bind(null, c.id)} className="space-y-3">
            <div className="grid sm:grid-cols-3 gap-3">
              <div>
                <label className="label">{isTreinamento ? "Data de início" : "Data"}</label>
                <input name="data" type="date" className="input" required />
              </div>
              {!isTreinamento && !isRedacao && (
                <>
                  <div>
                    <label className="label">Horário</label>
                    <input name="horario" type="time" className="input" />
                  </div>
                  <div>
                    <label className="label">Duração (min)</label>
                    <input name="duracao" type="number" className="input" />
                  </div>
                </>
              )}
            </div>
            {!isTreinamento && !isRedacao && (
              <div>
                <label className="label">Quem entrevistou</label>
                <input name="entrevistador" className="input" defaultValue={perfil?.nome} />
              </div>
            )}
            {isRedacao && (
              <div>
                <label className="label">Foto da redação (JPG, PNG ou PDF)</label>
                <input name="arquivo" type="file" accept=".jpg,.jpeg,.png,.pdf" className="text-sm" />
              </div>
            )}
            <div>
              <label className="label">Observações</label>
              <textarea name="observacoes" className="input min-h-[60px]" />
            </div>
            <div>
              <label className="label">Resultado</label>
              <select name="resultado" className="input" required>
                <option value="">Selecione</option>
                {isTreinamento ? (
                  <>
                    <option value="em_andamento">Ainda em treinamento</option>
                    <option value="aprovado">Aprovado</option>
                    <option value="reprovado">Reprovado</option>
                  </>
                ) : isRedacao ? (
                  <>
                    <option value="passou">Passou</option>
                    <option value="nao_passou">Não passou</option>
                  </>
                ) : (
                  <>
                    <option value="passou">Passou</option>
                    <option value="nao_passou">Não passou</option>
                    <option value="ainda_nao_sabe">Ainda não sabe</option>
                  </>
                )}
              </select>
            </div>
            {!isTreinamento && etapaSugerida && (
              <div>
                <label className="label">Se passar, enviar para</label>
                <select name="proxima_etapa" className="input" defaultValue={etapaSugerida}>
                  {proximasEtapas.map((etapa) => (
                    <option key={etapa} value={etapa}>
                      {ETAPA_LABELS[etapa]}{etapa === etapaSugerida ? " (próxima recomendada)" : " (pular etapa)"}
                    </option>
                  ))}
                </select>
              </div>
            )}
            <button className="btn-primary w-full sm:w-auto">Salvar registro</button>
          </form>
        </div>
      )}

      {isTreinamento && treinamentoAprovado && acessoTotal && (
        <div className="card p-4 border-green-300 bg-green-50/50 space-y-3">
          <h3 className="font-bold text-green-800">Efetivar candidato</h3>
          <p className="text-sm text-green-700">Treinamento aprovado. Preencha os dados para efetivar na Equipe Atual.</p>
          <form action={efetivarCandidato.bind(null, c.id)} className="space-y-3">
            <div className="grid sm:grid-cols-3 gap-3">
              <div><label className="label">Cargo *</label><input name="cargo" className="input" required /></div>
              <div><label className="label">Salário (R$) *</label><input name="salario" type="number" step="0.01" className="input" required /></div>
              <div><label className="label">Data de entrada *</label><input name="data_entrada" type="date" className="input" required /></div>
            </div>
            <div>
              <label className="label">Quem indicou</label>
              <select name="indicado_por" className="input" defaultValue={c.indicado_por_equipe_id || ""}>
                <option value="">Sem indicação</option>
                {(equipe || []).map((e) => <option key={e.id} value={e.id}>{e.nome}</option>)}
              </select>
            </div>
            <div><label className="label">Observações</label><textarea name="observacoes" className="input min-h-[50px]" /></div>
            <details className="text-sm">
              <summary className="cursor-pointer font-medium text-gray-700">Dados bancários (opcional)</summary>
              <div className="grid sm:grid-cols-2 gap-3 mt-3">
                <div><label className="label">Banco</label><input name="banco" className="input" /></div>
                <div><label className="label">Agência</label><input name="agencia" className="input" /></div>
                <div><label className="label">Conta</label><input name="conta" className="input" /></div>
                <div>
                  <label className="label">Tipo de conta</label>
                  <select name="tipo_conta" className="input">
                    <option value="">Selecione</option>
                    <option>Corrente</option>
                    <option>Poupança</option>
                    <option>Salário</option>
                  </select>
                </div>
                <div><label className="label">Nome do titular</label><input name="nome_titular" className="input" /></div>
                <div><label className="label">CPF do titular</label><input name="cpf_titular" className="input" /></div>
              </div>
            </details>
            <ConfirmSubmit mensagem="Tem certeza que deseja efetivar este candidato?" className="btn-success w-full sm:w-auto">
              Efetivar candidato
            </ConfirmSubmit>
          </form>
        </div>
      )}

      {emSelecao && acessoTotal && (
        <div className="card p-4">
          <h3 className="font-bold mb-2">Rejeitar candidato</h3>
          <form action={rejeitarCandidato.bind(null, c.id)} className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-end">
            <input name="motivo" className="input w-full sm:!w-72" placeholder="Motivo da rejeição" />
            <ConfirmSubmit mensagem="Tem certeza que deseja rejeitar este candidato?" className="btn-danger w-full sm:w-auto">
              Rejeitar
            </ConfirmSubmit>
          </form>
        </div>
      )}

      {podeVoltar && acessoTotal && (
        <div className="card p-4">
          <h3 className="font-bold mb-2">Voltar etapa</h3>
          <p className="text-sm text-gray-500 mb-2">Use em caso de erro para devolver o candidato a uma etapa anterior. O histórico é mantido.</p>
          <form action={voltarEtapa.bind(null, c.id)} className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-end">
            <div className="flex-1 min-w-48">
              <label className="label">Voltar para</label>
              <select name="etapa_destino" className="input" defaultValue={etapasAnteriores[etapasAnteriores.length - 1]}>
                {etapasAnteriores.map((etapa) => (
                  <option key={etapa} value={etapa}>{ETAPA_LABELS[etapa]}</option>
                ))}
              </select>
            </div>
            <ConfirmSubmit mensagem="Voltar o candidato para a etapa anterior?" className="btn-secondary w-full sm:w-auto">
              Voltar etapa
            </ConfirmSubmit>
          </form>
        </div>
      )}

      {isTreinamento && acessoTotal && (
        <div className="card p-4">
          <h3 className="font-bold mb-2">Encerrar treinamento</h3>
          <p className="text-sm text-gray-500 mb-2">Use quando a pessoa não for aprovada no treinamento. Ela sai da operação em treinamento.</p>
          <form action={encerrarTreinamento.bind(null, c.id)} className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-end">
            <input name="motivo" className="input w-full sm:!w-72" placeholder="Motivo (opcional)" />
            <ConfirmSubmit mensagem="Encerrar o treinamento desta pessoa? Ela deixará de aparecer em Equipe › Em treinamento." className="btn-danger w-full sm:w-auto">
              Não aprovar no treinamento
            </ConfirmSubmit>
          </form>
        </div>
      )}

      <div className="card p-4">
        <h3 className="font-bold mb-4">Linha do tempo</h3>
        <Timeline eventos={eventos} />
      </div>

      {c.status === "rejeitado" && (
        <div className="card p-4 border-red-200">
          <p className="text-sm text-red-700">Rejeitado em {fmtData(c.rejeitado_em)}{c.rejeicao_motivo ? ` · Motivo: ${c.rejeicao_motivo}` : ""}</p>
        </div>
      )}

      {c.status === "treinamento_encerrado" && (
        <div className="card p-4 border-amber-200 bg-amber-50/50">
          <p className="font-semibold text-amber-800">Treinamento encerrado — não aprovado para efetivação.</p>
          <p className="text-sm text-amber-700 mt-1">
            Encerrado em {fmtData(c.rejeitado_em)}{c.rejeicao_motivo ? ` · ${c.rejeicao_motivo}` : ""}. Esta pessoa não faz parte da Equipe.
          </p>
        </div>
      )}

      <Observacoes entidadeTipo="candidato" entidadeId={c.id} observacoes={obs || []} podeEditar={acessoTotal} path={`/candidatos/${c.id}`} />
    </div>
  );
}
