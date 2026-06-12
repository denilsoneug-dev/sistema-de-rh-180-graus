import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getPerfil } from "@/lib/auth";
import { registrarEtapa, rejeitarCandidato, efetivarCandidato } from "@/app/actions/candidatos";
import { formatarCpf, formatarTelefone } from "@/lib/cpf";
import { ETAPA_LABELS, diasDesde, fmtData, fmtDataHora, requisitosPrincipais } from "@/lib/constants";
import { ConfirmSubmit } from "@/components/ConfirmSubmit";
import { Observacoes } from "@/components/Observacoes";

export const dynamic = "force-dynamic";

const ETAPAS_ATIVAS = ["entrevista_online", "entrevista_presencial", "redacao_escrita", "em_treinamento"];

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
  const req = r ? requisitosPrincipais(r) : null;

  const { data: obs } = await supabase.from("observacoes")
    .select("*").eq("entidade_tipo", "candidato").eq("entidade_id", id)
    .eq("apagado", false).order("criado_em", { ascending: false });

  const { data: equipe } = acessoTotal
    ? await supabase.from("equipe").select("id, nome").in("status", ["ativo", "em_experiencia"]).order("nome")
    : { data: [] };

  const emProcesso = ETAPAS_ATIVAS.includes(c.status as string);
  const isTreinamento = c.status === "em_treinamento";
  const isRedacao = c.status === "redacao_escrita";
  const treinamentoAprovado = (etapas || []).some((e) => e.tipo_etapa === "treinamento" && e.resultado === "aprovado");
  const dias = diasDesde(c.etapa_atual_desde);

  return (
    <div className="space-y-4 max-w-3xl">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-xl font-bold">{c.nome}</h1>
          <p className="text-sm text-gray-500">CPF {formatarCpf(c.cpf)} · {formatarTelefone(c.telefone)} · {c.vaga_pretendida || "—"}</p>
          <div className="flex items-center gap-2 mt-1">
            <span className="badge bg-blue-100 text-blue-800">{ETAPA_LABELS[c.status as string] || c.status}</span>
            {emProcesso && <span className="text-sm text-gray-500">há {dias} dia(s) nesta etapa (desde {fmtData(c.etapa_atual_desde)})</span>}
          </div>
        </div>
        <div className="flex gap-2">
          <a className="btn-secondary" href={`/api/pdf/candidato/${c.id}`} target="_blank">Exportar PDF</a>
          {ficha && <Link className="btn-secondary" href={`/fichas/${ficha.id}`}>Ver ficha</Link>}
        </div>
      </div>

      {req && (
        <div className="card p-4">
          <h3 className="font-bold mb-1">Requisitos principais: {req.pontos} de 4</h3>
          <p className="text-sm text-gray-600">
            Viajar: {req.disponibilidade ? "Sim" : "Não"} · Notebook: {req.notebook ? "Sim" : "Não"} · Veículo: {req.veiculo ? "Sim" : "Não"} · CNH: {req.cnh ? "Sim" : "Não"}
          </p>
        </div>
      )}

      {c.curriculo_url && (
        <div className="card p-4 flex items-center justify-between flex-wrap gap-2">
          <h3 className="font-bold">Currículo</h3>
          <div className="flex gap-2">
            <a className="btn-secondary" href={`/api/arquivo?bucket=curriculos&path=${encodeURIComponent(c.curriculo_url)}`} target="_blank">Ver</a>
            <a className="btn-secondary" href={`/api/arquivo?bucket=curriculos&path=${encodeURIComponent(c.curriculo_url)}&download=1`}>Baixar</a>
          </div>
        </div>
      )}

      {emProcesso && acessoTotal && (
        <div className="card p-4 space-y-3">
          <h3 className="font-bold">Registrar {ETAPA_LABELS[c.status as string]?.toLowerCase()}</h3>
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
            <button className="btn-primary">Salvar registro</button>
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
              <label className="label">Quem indicou *</label>
              <select name="indicado_por" className="input">
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
            <ConfirmSubmit mensagem="Tem certeza que deseja efetivar este candidato?" className="btn-success">
              Efetivar candidato
            </ConfirmSubmit>
          </form>
        </div>
      )}

      {emProcesso && acessoTotal && (
        <div className="card p-4">
          <h3 className="font-bold mb-2">Rejeitar candidato</h3>
          <form action={rejeitarCandidato.bind(null, c.id)} className="flex flex-wrap gap-2">
            <input name="motivo" className="input !w-72" placeholder="Motivo da rejeição" />
            <ConfirmSubmit mensagem="Tem certeza que deseja rejeitar este candidato?" className="btn-danger">
              Rejeitar
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
              {e.arquivo_url && (
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

      <Observacoes entidadeTipo="candidato" entidadeId={c.id} observacoes={obs || []} podeEditar={acessoTotal} path={`/candidatos/${c.id}`} />
    </div>
  );
}
