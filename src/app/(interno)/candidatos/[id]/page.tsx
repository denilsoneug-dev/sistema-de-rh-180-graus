import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getPerfil } from "@/lib/auth";
import { registrarEtapa, rejeitarCandidato, efetivarCandidato, encerrarTreinamento } from "@/app/actions/candidatos";
import { salvarRequisitosCandidato } from "@/app/actions/requisitos";
import { formatarTelefone, cpfPorPapel } from "@/lib/cpf";
import { ETAPA_LABELS, diasDesde, fmtData, fmtDataHora, resumoComOverride } from "@/lib/constants";
import { candidatoEstaEmProcesso } from "@/lib/equipe-treinamento";
import { ConfirmSubmit } from "@/components/ConfirmSubmit";
import { Observacoes } from "@/components/Observacoes";
import { ResumoRequisitos } from "@/components/ResumoRequisitos";
import { EditarRequisitos } from "@/components/EditarRequisitos";

export const dynamic = "force-dynamic";

export default async function CandidatoDetalhe({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
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

  const emSelecao = candidatoEstaEmProcesso(c.status); // entrevistas + redação (fonte única)
  const isTreinamento = c.status === "em_treinamento";
  const isRedacao = c.status === "redacao_escrita";
  const podeRegistrar = emSelecao || isTreinamento; // registrar etapa vale p/ seleção e treinamento
  const treinamentoAprovado = (etapas || []).some((e) => e.tipo_etapa === "treinamento" && e.resultado === "aprovado");
  const dias = diasDesde(c.etapa_atual_desde);

  return (
    <div className="space-y-4 max-w-3xl">
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
        <p><span className="text-gray-500">Quem indicou:</span> {indicador?.nome || "Sem indicação informada"}</p>
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
        <h3 className="font-bold mb-3">Histórico de etapas</h3>
        <div className="space-y-3">
          {(etapas || []).length === 0 && <p className="text-sm text-gray-400">Nenhum registro ainda.</p>}
          {(etapas || []).map((e) => (
            <div key={e.id} className="border-b border-gray-100 pb-3 last:border-0 text-sm">
              <div className="flex justify-between flex-wrap gap-1">
                <p className="font-semibold">{ETAPA_LABELS[e.tipo_etapa as string]}</p>
                <span className={`badge ${e.resultado === "passou" || e.resultado === "aprovado" ? "bg-green-100 text-green-800" : e.resultado === "nao_passou" || e.resultado === "reprovado" ? "bg-red-100 text-red-700" : "bg-gray-100 text-gray-600"}`}>
                  {e.resultado === "passou" ? "Passou" : e.resultado === "nao_passou" ? "Não passou" : e.resultado === "ainda_nao_sabe" ? "Ainda não sabe" : e.resultado === "aprovado" ? "Aprovado" : e.resultado === "reprovado" ? "Reprovado" : e.resultado === "em_andamento" ? "Em andamento" : "—"}
                </span>
              </div>
              <p className="text-gray-500">
                {fmtData(e.data)}{e.horario ? ` às ${String(e.horario).slice(0, 5)}` : ""}{e.duracao_minutos ? ` · ${e.duracao_minutos} min` : ""}
                {e.entrevistador_nome ? ` · Entrevistou: ${e.entrevistador_nome}` : ""}
              </p>
              {e.observacoes && <p className="text-gray-600 mt-1">{e.observacoes}</p>}
              {e.arquivo_url && acessoTotal && (
                <a className="text-brand-700 underline" href={`/api/arquivo?bucket=redacoes&path=${encodeURIComponent(e.arquivo_url)}`} target="_blank">Ver redação anexada</a>
              )}
              <p className="text-xs text-gray-400 mt-1">Registrado em {fmtDataHora(e.criado_em)}</p>
            </div>
          ))}
        </div>
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
