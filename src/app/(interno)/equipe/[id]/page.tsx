import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getPerfil } from "@/lib/auth";
import { editarEquipe, desligarEquipe, atualizarStatusBonus } from "@/app/actions/equipe";
import { formatarTelefone, cpfPorPapel } from "@/lib/cpf";
import { STATUS_EQUIPE_LABELS, STATUS_BONUS_LABELS, fmtData, fmtMoeda } from "@/lib/constants";
import { ConfirmSubmit } from "@/components/ConfirmSubmit";
import { Observacoes } from "@/components/Observacoes";
import { ResumoRequisitos } from "@/components/ResumoRequisitos";
import { EditarRequisitos } from "@/components/EditarRequisitos";
import { mapResumosPorEquipe } from "@/lib/requisitos";
import { salvarRequisitosEquipe } from "@/app/actions/requisitos";

export const dynamic = "force-dynamic";

export default async function EquipeDetalhe({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const perfil = await getPerfil();
  const acessoTotal = perfil?.papel === "acesso_total";
  const supabase = await createClient();

  const { data: m } = await supabase.from("equipe").select("*").eq("id", id).single();
  if (!m) notFound();

  // Dados bancários: RLS garante que visualização não recebe nada aqui
  const { data: db } = acessoTotal
    ? await supabase.from("dados_bancarios").select("*").eq("equipe_id", id).maybeSingle()
    : { data: null };

  const { data: indicador } = m.indicado_por_equipe_id
    ? await supabase.from("equipe").select("nome").eq("id", m.indicado_por_equipe_id).single()
    : { data: null };

  // Bônus que esta pessoa tem a receber (como indicadora)
  const { data: bonus } = await supabase.from("bonus_indicacao")
    .select("*, indicado:indicado_equipe_id(nome)")
    .eq("indicador_equipe_id", id)
    .order("gerado_em", { ascending: false });

  const { data: obs } = await supabase.from("observacoes")
    .select("*").eq("entidade_tipo", "equipe").eq("entidade_id", id)
    .eq("apagado", false).order("criado_em", { ascending: false });

  // Requisitos derivados da ficha de origem (se o membro veio de processo seletivo)
  const resumoMap = await mapResumosPorEquipe(supabase, [m]);
  const resumoReq = resumoMap.get(m.id) ?? null;

  return (
    <div className="space-y-4 max-w-3xl">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-xl font-bold">{m.nome}</h1>
          <p className="text-sm text-gray-500">{m.cargo} · CPF {cpfPorPapel(m.cpf, acessoTotal)} · {formatarTelefone(m.telefone)}</p>
          <span className="badge bg-gray-100 text-gray-700 mt-1">{STATUS_EQUIPE_LABELS[m.status as string]}</span>
        </div>
        <a className="btn-secondary" href={`/api/pdf/equipe/${m.id}`} target="_blank">Exportar PDF</a>
      </div>

      <div className="card p-4 text-sm grid sm:grid-cols-2 gap-x-6 gap-y-2">
        <p><span className="text-gray-500">Salário:</span> {fmtMoeda(m.salario)}</p>
        <p><span className="text-gray-500">Data de entrada:</span> {fmtData(m.data_entrada)}</p>
        <p><span className="text-gray-500">Origem:</span> {m.origem === "processo_seletivo" ? "Processo seletivo" : "Cadastro direto"}</p>
        <p><span className="text-gray-500">Quem indicou:</span> {indicador?.nome || "Sem indicação"}</p>
        {m.status === "desligado" && (
          <>
            <p><span className="text-gray-500">Data de saída:</span> {fmtData(m.data_saida)}</p>
            <p><span className="text-gray-500">Motivo:</span> {m.motivo_saida || "—"}</p>
          </>
        )}
        {m.observacoes_iniciais && <p className="sm:col-span-2"><span className="text-gray-500">Observações iniciais:</span> {m.observacoes_iniciais}</p>}
        {m.candidato_origem_id && (
          <p className="sm:col-span-2">
            <Link className="text-brand-700 underline" href={`/candidatos/${m.candidato_origem_id}`}>Ver processo seletivo de origem</Link>
          </p>
        )}
      </div>

      <ResumoRequisitos
        variante="detalhado"
        resumo={resumoReq}
        semFichaMsg="Requisitos não informados porque este membro foi cadastrado diretamente na equipe."
      />
      {acessoTotal && <EditarRequisitos action={salvarRequisitosEquipe.bind(null, m.id)} valores={m} />}

      <div className="card p-4">
        <h3 className="font-bold mb-2">Bônus por indicação</h3>
        {(bonus || []).length === 0 ? (
          <p className="text-sm text-gray-400">Nenhum bônus.</p>
        ) : (
          <div className="space-y-2">
            {(bonus || []).map((b) => (
              <div key={b.id} className="flex items-center justify-between flex-wrap gap-2 text-sm border-b border-gray-100 pb-2 last:border-0">
                <div>
                  <p className="font-medium">Indicou: {(b.indicado as { nome?: string })?.nome || "—"}</p>
                  <p className="text-gray-500">Efetivado em {fmtData(b.gerado_em)} · Valor: {b.valor != null ? fmtMoeda(b.valor) : "pendente de configuração"}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`badge ${b.status === "pago" ? "bg-green-100 text-green-800" : b.status === "cancelado" ? "bg-red-100 text-red-700" : "bg-yellow-100 text-yellow-800"}`}>
                    {STATUS_BONUS_LABELS[b.status as string]}
                  </span>
                  {acessoTotal && b.status === "pendente" && (
                    <form action={atualizarStatusBonus} className="flex gap-1">
                      <input type="hidden" name="id" value={b.id} />
                      <input type="hidden" name="path" value={`/equipe/${m.id}`} />
                      <button name="status" value="pago" className="text-xs text-green-700 underline">marcar pago</button>
                      <button name="status" value="cancelado" className="text-xs text-red-500 underline">cancelar</button>
                    </form>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {acessoTotal && (
        <div className="card p-4 space-y-3">
          <h3 className="font-bold">Editar dados</h3>
          <form action={editarEquipe.bind(null, m.id)} className="space-y-3">
            <div className="grid sm:grid-cols-2 gap-3">
              <div><label className="label">Nome</label><input name="nome" className="input" defaultValue={m.nome} required /></div>
              <div><label className="label">Telefone</label><input name="telefone" className="input" defaultValue={formatarTelefone(m.telefone)} required /></div>
              <div><label className="label">Cargo</label><input name="cargo" className="input" defaultValue={m.cargo} required /></div>
              <div><label className="label">Salário (R$)</label><input name="salario" type="number" step="0.01" className="input" defaultValue={m.salario} required /></div>
              <div><label className="label">Data de entrada</label><input name="data_entrada" type="date" className="input" defaultValue={m.data_entrada} required /></div>
              <div>
                <label className="label">Status</label>
                <select name="status" className="input" defaultValue={m.status}>
                  <option value="ativo">Ativo</option>
                  <option value="em_experiencia">Em experiência</option>
                  <option value="afastado">Afastado</option>
                  <option value="desligado">Desligado</option>
                </select>
              </div>
            </div>
            <details className="text-sm" open={!!db}>
              <summary className="cursor-pointer font-medium">Dados bancários (somente acesso total)</summary>
              <div className="grid sm:grid-cols-2 gap-3 mt-3">
                <div><label className="label">Banco</label><input name="banco" className="input" defaultValue={db?.banco || ""} /></div>
                <div><label className="label">Agência</label><input name="agencia" className="input" defaultValue={db?.agencia || ""} /></div>
                <div><label className="label">Conta</label><input name="conta" className="input" defaultValue={db?.conta || ""} /></div>
                <div>
                  <label className="label">Tipo de conta</label>
                  <select name="tipo_conta" className="input" defaultValue={db?.tipo_conta || ""}>
                    <option value="">Selecione</option>
                    <option>Corrente</option>
                    <option>Poupança</option>
                    <option>Salário</option>
                  </select>
                </div>
                <div><label className="label">Nome do titular</label><input name="nome_titular" className="input" defaultValue={db?.nome_titular || ""} /></div>
                <div><label className="label">CPF do titular</label><input name="cpf_titular" className="input" defaultValue={db?.cpf_titular || ""} /></div>
              </div>
            </details>
            <button className="btn-primary">Salvar alterações</button>
          </form>
        </div>
      )}

      {acessoTotal && m.status !== "desligado" && (
        <div className="card p-4">
          <h3 className="font-bold mb-2">Desligamento</h3>
          <form action={desligarEquipe.bind(null, m.id)} className="flex flex-wrap items-end gap-2">
            <div>
              <label className="label">Data de saída *</label>
              <input name="data_saida" type="date" className="input" required />
            </div>
            <div className="flex-1 min-w-48">
              <label className="label">Motivo (opcional)</label>
              <input name="motivo" className="input" />
            </div>
            <ConfirmSubmit mensagem="Tem certeza que deseja desligar esta pessoa da equipe?" className="btn-danger">
              Desligar
            </ConfirmSubmit>
          </form>
        </div>
      )}

      <Observacoes entidadeTipo="equipe" entidadeId={m.id} observacoes={obs || []} podeEditar={acessoTotal} path={`/equipe/${m.id}`} />
    </div>
  );
}
