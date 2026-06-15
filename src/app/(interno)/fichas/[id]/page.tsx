import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getPerfil } from "@/lib/auth";
import { atualizarStatusRecrutamento, regerarLink, arquivarFicha, rejeitarFicha, selecionarParaProcesso } from "@/app/actions/fichas";
import { formatarTelefone, cpfPorPapel } from "@/lib/cpf";
import { resumoRequisitos, fmtData, fmtDataHora, PERGUNTAS_SOBRE_VOCE, STATUS_FICHA_LABELS } from "@/lib/constants";
import { CopiarLink } from "@/components/CopiarLink";
import { ConfirmSubmit } from "@/components/ConfirmSubmit";
import { Observacoes } from "@/components/Observacoes";
import { ResumoRequisitos } from "@/components/ResumoRequisitos";
import { STATUS_RECRUTAMENTO, STATUS_RECRUTAMENTO_CLASSES, STATUS_RECRUTAMENTO_LABELS, statusRecrutamentoValido, type StatusRecrutamento } from "@/lib/rh";

export const dynamic = "force-dynamic";

export default async function FichaDetalhe({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ token?: string }> }) {
  const [{ id }, { token }] = await Promise.all([params, searchParams]);
  const perfil = await getPerfil();
  const acessoTotal = perfil?.papel === "acesso_total";
  const supabase = await createClient();

  const { data: ficha } = await supabase.from("fichas").select("*, ficha_respostas(*)").eq("id", id).single();
  if (!ficha) notFound();
  const r = Array.isArray(ficha.ficha_respostas) ? ficha.ficha_respostas[0] : ficha.ficha_respostas;

  const { data: obs } = await supabase.from("observacoes")
    .select("*").eq("entidade_tipo", "ficha").eq("entidade_id", id)
    .eq("apagado", false).order("criado_em", { ascending: false });

  // Alerta CPF rejeitado antes
  let rejeicaoAnterior: { nome: string; data: string; motivo: string | null } | null = null;
  if (ficha.cpf && ficha.status === "recebida") {
    const { data: rej } = await supabase.from("fichas")
      .select("nome_inicial, rejeitado_em, rejeicao_motivo, ficha_respostas(nome_completo)")
      .eq("cpf", ficha.cpf).eq("status", "rejeitada").neq("id", ficha.id)
      .order("rejeitado_em", { ascending: false }).limit(1).maybeSingle();
    if (rej) {
      const rr = Array.isArray(rej.ficha_respostas) ? rej.ficha_respostas[0] : rej.ficha_respostas;
      rejeicaoAnterior = { nome: (rr as { nome_completo?: string })?.nome_completo || rej.nome_inicial, data: rej.rejeitado_em, motivo: rej.rejeicao_motivo };
    }
  }

  // Equipe ativa para "quem indicou"
  const { data: equipe } = acessoTotal
    ? await supabase.from("equipe").select("id, nome").in("status", ["ativo", "em_experiencia"]).order("nome")
    : { data: [] };

  // Mostra o link recém-gerado (?token=...) ou o token salvo na ficha (uso interno).
  const tokenLink = token || ficha.token_atual || null;
  const link = tokenLink
    ? `${process.env.NEXT_PUBLIC_APP_URL || ""}/ficha/${tokenLink}`
    : null;

  const sv = (r?.respostas_sobre_voce_json || {}) as Record<string, string>;
  const statusRh: StatusRecrutamento = statusRecrutamentoValido(String(ficha.status_recrutamento || ""))
    ? ficha.status_recrutamento as StatusRecrutamento
    : "nova_ficha";

  return (
    <div className="space-y-4 max-w-3xl">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold break-words">{r?.nome_completo || ficha.nome_inicial}</h1>
          <div className="mt-1 flex flex-wrap gap-2">
            <span className={`badge ${STATUS_RECRUTAMENTO_CLASSES[statusRh]}`}>{STATUS_RECRUTAMENTO_LABELS[statusRh]}</span>
            <span className="badge bg-gray-100 text-gray-700">Ficha: {STATUS_FICHA_LABELS[ficha.status]}</span>
          </div>
        </div>
        {r && <a className="btn-secondary w-full sm:w-auto" href={`/api/pdf/ficha/${ficha.id}`} target="_blank">Exportar PDF</a>}
      </div>

      {r && (
        <div className="card p-4">
          <h2 className="font-bold mb-3">Status do recrutamento</h2>
          {acessoTotal ? (
            <form action={atualizarStatusRecrutamento.bind(null, ficha.id)} className="flex flex-col gap-2 sm:flex-row sm:items-end">
              <div className="flex-1">
                <label className="label" htmlFor="status-recrutamento">Status atual</label>
                <select id="status-recrutamento" name="status_recrutamento" className="input" defaultValue={statusRh}>
                  {STATUS_RECRUTAMENTO.map((status) => <option key={status} value={status}>{STATUS_RECRUTAMENTO_LABELS[status]}</option>)}
                </select>
              </div>
              <button className="btn-primary w-full sm:w-auto">Salvar status</button>
            </form>
          ) : (
            <p className="text-sm text-gray-600">{STATUS_RECRUTAMENTO_LABELS[statusRh]}</p>
          )}
        </div>
      )}

      {rejeicaoAnterior && (
        <div className="card p-4 border-amber-300 bg-amber-50">
          <p className="font-semibold text-amber-800">⚠️ Atenção: este CPF já teve uma ficha rejeitada anteriormente.</p>
          <p className="text-sm text-amber-700 mt-1">
            Nome anterior: {rejeicaoAnterior.nome} · Rejeitada em {fmtData(rejeicaoAnterior.data)}
            {rejeicaoAnterior.motivo && ` · Motivo: ${rejeicaoAnterior.motivo}`}
          </p>
        </div>
      )}

      {(ficha.status === "pendente" || ficha.status === "expirada") && acessoTotal && (
        <div className="card p-4 space-y-3">
          <h3 className="font-bold">Link da ficha</h3>
          {link ? (
            <>
              <p className="text-sm text-gray-600 break-all bg-gray-50 rounded-lg p-2">{link}</p>
              <CopiarLink link={link} nome={ficha.nome_inicial} />
              <p className="text-xs text-gray-400">
                {ficha.status === "expirada"
                  ? "Este link expirou — gere um novo para reativá-lo."
                  : `Enviado em ${fmtDataHora(ficha.link_enviado_em)} · expira em ${fmtData(ficha.link_expira_em)}.`}
              </p>
            </>
          ) : (
            <p className="text-sm text-gray-500">Nenhum link ativo. Gere um novo link abaixo.</p>
          )}
          <form action={regerarLink.bind(null, ficha.id)}>
            <ConfirmSubmit mensagem="Gerar um novo link? O link antigo deixará de funcionar." className="btn-secondary w-full sm:w-auto">
              Gerar novo link
            </ConfirmSubmit>
          </form>
        </div>
      )}

      {ficha.status === "recebida" && acessoTotal && (
        <div className="card p-4 space-y-4">
          <h3 className="font-bold">Ações</h3>
          <form action={selecionarParaProcesso.bind(null, ficha.id)} className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-end">
            <div className="flex-1 min-w-48">
              <label className="label">Quem indicou (opcional)</label>
              <select name="indicado_por" className="input">
                <option value="">Sem indicação</option>
                {(equipe || []).map((e) => <option key={e.id} value={e.id}>{e.nome}</option>)}
              </select>
            </div>
            <ConfirmSubmit mensagem="Selecionar esta ficha para o processo seletivo? O candidato entrará na etapa Entrevista online." className="btn-primary w-full sm:w-auto">
              Selecionar para processo
            </ConfirmSubmit>
          </form>
          <div className="flex flex-col gap-2 border-t pt-4 sm:flex-row sm:flex-wrap sm:items-end">
            <form action={arquivarFicha.bind(null, ficha.id)} className="w-full sm:w-auto">
              <ConfirmSubmit mensagem="Arquivar esta ficha? Ela sai da lista principal mas continua salva." className="btn-secondary w-full sm:w-auto">
                Arquivar
              </ConfirmSubmit>
            </form>
            <form action={rejeitarFicha.bind(null, ficha.id)} className="flex flex-col gap-2 w-full sm:w-auto sm:flex-row sm:flex-wrap sm:items-end">
              <input name="motivo" className="input w-full sm:!w-64" placeholder="Motivo da rejeição (opcional)" />
              <ConfirmSubmit mensagem="Rejeitar esta ficha? Ela sairá da área principal." className="btn-danger w-full sm:w-auto">
                Rejeitar
              </ConfirmSubmit>
            </form>
          </div>
        </div>
      )}

      {r && <ResumoRequisitos variante="detalhado" resumo={resumoRequisitos(r)} />}

      {ficha.curriculo_url && acessoTotal && (
        <div className="card p-4 flex items-center justify-between flex-wrap gap-2">
          <div>
            <h3 className="font-bold">Currículo</h3>
            {ficha.curriculo_nome_arquivo && (
              <p className="text-sm text-gray-500 break-all">{ficha.curriculo_nome_arquivo}</p>
            )}
          </div>
          <div className="flex gap-2 w-full sm:w-auto">
            <a className="btn-secondary flex-1 sm:flex-none" href={`/api/arquivo?bucket=curriculos&path=${encodeURIComponent(ficha.curriculo_url)}`} target="_blank">Ver currículo</a>
            <a className="btn-secondary flex-1 sm:flex-none" href={`/api/arquivo?bucket=curriculos&path=${encodeURIComponent(ficha.curriculo_url)}&download=1`}>Baixar</a>
          </div>
        </div>
      )}

      {r && (
        <div className="space-y-4 text-sm">
          <section className="card p-4">
            <h2 className="font-bold text-base mb-3">Dados pessoais</h2>
            <div className="grid gap-2 sm:grid-cols-2 sm:gap-x-6">
              <p><span className="text-gray-500">Nome:</span> {r.nome_completo}</p>
              <p><span className="text-gray-500">Idade:</span> {r.idade}</p>
              <p><span className="text-gray-500">Sexo:</span> Não informado no formulário atual</p>
              <p><span className="text-gray-500">Telefone:</span> {formatarTelefone(r.whatsapp)}</p>
              <p><span className="text-gray-500">CPF:</span> {cpfPorPapel(r.cpf, acessoTotal)}</p>
              <p className="break-all"><span className="text-gray-500">E-mail:</span> {r.email}</p>
              <p><span className="text-gray-500">Estado civil:</span> {r.estado_civil}</p>
              <p><span className="text-gray-500">Instagram:</span> {r.instagram || "—"}</p>
              <p className="sm:col-span-2"><span className="text-gray-500">Endereço:</span> {r.endereco}</p>
            </div>
          </section>

          <section className="card p-4">
            <h2 className="font-bold text-base mb-3">Moradia</h2>
            <div className="grid gap-2 sm:grid-cols-2 sm:gap-x-6">
              <p><span className="text-gray-500">Quantidade de pessoas:</span> {r.quantidade_pessoas_mora_junto ?? "Não informado"}</p>
              <p><span className="text-gray-500">Quem são:</span> {r.mora_com_quem || r.mora_com || "—"}</p>
              <p className="sm:col-span-2"><span className="text-gray-500">Emprego/ocupação:</span> {r.emprego_ocupacao_pessoas_mora_junto || r.profissao_pessoas_mora_com || "—"}</p>
            </div>
          </section>

          <section className="card p-4">
            <h2 className="font-bold text-base mb-3">Disponibilidade e renda</h2>
            <div className="grid gap-2 sm:grid-cols-2 sm:gap-x-6">
              <p><span className="text-gray-500">Disponibilidade:</span> {r.disponibilidade_viajar === "integral" ? "Integral" : r.disponibilidade_viajar === "parcial" ? "Parcial" : "Não tem"}</p>
              <p><span className="text-gray-500">Trabalha atualmente:</span> {r.trabalha_atualmente ? `Sim - ${r.cargo_atual}` : "Não"}</p>
              {r.disponibilidade_viajar_explicacao && <p className="sm:col-span-2"><span className="text-gray-500">Explicação:</span> {r.disponibilidade_viajar_explicacao}</p>}
              <p className="sm:col-span-2"><span className="text-gray-500">Renda extra:</span> {r.renda_extra === "sim" ? "Sim" : "Não"}</p>
              {r.renda_extra === "sim" && <p className="sm:col-span-2"><span className="text-gray-500">Atividade:</span> {r.renda_extra_descricao || "—"}</p>}
            </div>
          </section>

          <section className="card p-4">
            <h2 className="font-bold text-base mb-3">Formação e experiência</h2>
            <div className="space-y-2">
              <p><span className="text-gray-500">Formação:</span> {r.formacao}</p>
              <p><span className="text-gray-500">Experiências anteriores:</span> Não informado no formulário atual</p>
              <p><span className="text-gray-500">Habilidades que deseja aprender:</span> {r.habilidades_quer_aprender}</p>
              <p><span className="text-gray-500">Cursos:</span> Não informado no formulário atual</p>
              <p><span className="text-gray-500">Ferramentas:</span> {((r.ferramentas_json as string[]) || []).join(", ") || "—"}{r.ferramentas_outros ? ` · Outros: ${r.ferramentas_outros}` : ""}</p>
            </div>
          </section>

          <section className="card p-4">
            <h2 className="font-bold text-base mb-3">Respostas abertas</h2>
            <div className="space-y-3">
              {PERGUNTAS_SOBRE_VOCE.map((pergunta) => (
                <p key={pergunta.key}><span className="text-gray-500">{pergunta.label}</span><br />{sv[pergunta.key] || "—"}</p>
              ))}
            </div>
          </section>
        </div>
      )}

      <Observacoes entidadeTipo="ficha" entidadeId={ficha.id} observacoes={obs || []} podeEditar={acessoTotal} path={`/fichas/${ficha.id}`} />
    </div>
  );
}
