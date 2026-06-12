import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getPerfil } from "@/lib/auth";
import { regerarLink, arquivarFicha, rejeitarFicha, selecionarParaProcesso } from "@/app/actions/fichas";
import { formatarCpf, formatarTelefone } from "@/lib/cpf";
import { requisitosPrincipais, fmtData, fmtDataHora, PERGUNTAS_SOBRE_VOCE, STATUS_FICHA_LABELS } from "@/lib/constants";
import { CopiarLink } from "@/components/CopiarLink";
import { ConfirmSubmit } from "@/components/ConfirmSubmit";
import { Observacoes } from "@/components/Observacoes";

export const dynamic = "force-dynamic";

export default async function FichaDetalhe({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ token?: string }> }) {
  const [{ id }, { token }] = await Promise.all([params, searchParams]);
  const perfil = await getPerfil();
  const acessoTotal = perfil?.papel === "acesso_total";
  const supabase = await createClient();

  const { data: ficha } = await supabase.from("fichas").select("*, ficha_respostas(*)").eq("id", id).single();
  if (!ficha) notFound();
  const r = Array.isArray(ficha.ficha_respostas) ? ficha.ficha_respostas[0] : ficha.ficha_respostas;
  const req = r ? requisitosPrincipais(r) : null;

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

  const link = token
    ? `${process.env.NEXT_PUBLIC_APP_URL || ""}/ficha/${token}`
    : null;

  const sv = (r?.respostas_sobre_voce_json || {}) as Record<string, string>;

  return (
    <div className="space-y-4 max-w-3xl">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-xl font-bold">{r?.nome_completo || ficha.nome_inicial}</h1>
          <span className="badge bg-gray-100 text-gray-700">{STATUS_FICHA_LABELS[ficha.status]}</span>
        </div>
        {r && <a className="btn-secondary" href={`/api/pdf/ficha/${ficha.id}`} target="_blank">Exportar PDF</a>}
      </div>

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
              <p className="text-xs text-gray-400">Guarde este link agora — por segurança ele não fica salvo no sistema. Se perder, gere um novo.</p>
            </>
          ) : (
            <p className="text-sm text-gray-500">
              {ficha.status === "expirada" ? "O link expirou." : `Link enviado em ${fmtDataHora(ficha.link_enviado_em)} · expira ${fmtData(ficha.link_expira_em)}.`}
              {" "}O link só é exibido no momento da geração.
            </p>
          )}
          <form action={regerarLink.bind(null, ficha.id)}>
            <ConfirmSubmit mensagem="Gerar um novo link? O link antigo deixará de funcionar." className="btn-secondary">
              Gerar novo link
            </ConfirmSubmit>
          </form>
        </div>
      )}

      {ficha.status === "recebida" && acessoTotal && (
        <div className="card p-4 space-y-4">
          <h3 className="font-bold">Ações</h3>
          <form action={selecionarParaProcesso.bind(null, ficha.id)} className="flex flex-wrap items-end gap-2">
            <div className="flex-1 min-w-48">
              <label className="label">Quem indicou (opcional)</label>
              <select name="indicado_por" className="input">
                <option value="">Sem indicação</option>
                {(equipe || []).map((e) => <option key={e.id} value={e.id}>{e.nome}</option>)}
              </select>
            </div>
            <ConfirmSubmit mensagem="Selecionar esta ficha para o processo seletivo? O candidato entrará na etapa Entrevista online." className="btn-primary">
              Selecionar para processo
            </ConfirmSubmit>
          </form>
          <div className="flex flex-wrap gap-2 border-t pt-4">
            <form action={arquivarFicha.bind(null, ficha.id)}>
              <ConfirmSubmit mensagem="Arquivar esta ficha? Ela sai da lista principal mas continua salva." className="btn-secondary">
                Arquivar
              </ConfirmSubmit>
            </form>
            <form action={rejeitarFicha.bind(null, ficha.id)} className="flex flex-wrap gap-2">
              <input name="motivo" className="input !w-64" placeholder="Motivo da rejeição (opcional)" />
              <ConfirmSubmit mensagem="Rejeitar esta ficha? Ela sairá da área principal." className="btn-danger">
                Rejeitar
              </ConfirmSubmit>
            </form>
          </div>
        </div>
      )}

      {req && (
        <div className="card p-4">
          <h3 className="font-bold mb-2">Requisitos principais: {req.pontos} de 4</h3>
          <ul className="text-sm space-y-1">
            <li>{req.disponibilidade ? "✅" : "❌"} Disponibilidade para viajar: {req.disponibilidade ? "Sim" : r?.disponibilidade_viajar === "parcial" ? "Parcial" : "Não"}</li>
            <li>{req.notebook ? "✅" : "❌"} Notebook próprio: {req.notebook ? "Sim" : "Não"}</li>
            <li>{req.veiculo ? "✅" : "❌"} Veículo próprio: {req.veiculo ? "Sim" : "Não"}</li>
            <li>{req.cnh ? "✅" : "❌"} CNH: {req.cnh ? `Sim${r?.cnh_categoria ? ` (${r.cnh_categoria})` : ""}` : "Não"}</li>
          </ul>
        </div>
      )}

      {ficha.curriculo_url && (
        <div className="card p-4 flex items-center justify-between flex-wrap gap-2">
          <div>
            <h3 className="font-bold">Currículo</h3>
            {ficha.curriculo_nome_arquivo && (
              <p className="text-sm text-gray-500 break-all">{ficha.curriculo_nome_arquivo}</p>
            )}
          </div>
          <div className="flex gap-2">
            <a className="btn-secondary" href={`/api/arquivo?bucket=curriculos&path=${encodeURIComponent(ficha.curriculo_url)}`} target="_blank">Ver currículo</a>
            <a className="btn-secondary" href={`/api/arquivo?bucket=curriculos&path=${encodeURIComponent(ficha.curriculo_url)}&download=1`}>Baixar</a>
          </div>
        </div>
      )}

      {r && (
        <div className="card p-4 space-y-4 text-sm">
          <h3 className="font-bold text-base">Respostas da ficha</h3>
          <div className="grid sm:grid-cols-2 gap-x-6 gap-y-2">
            <p><span className="text-gray-500">Vaga:</span> {r.vaga_pretendida}</p>
            <p><span className="text-gray-500">Idade:</span> {r.idade}</p>
            <p><span className="text-gray-500">CPF:</span> {formatarCpf(r.cpf)}</p>
            <p><span className="text-gray-500">WhatsApp:</span> {formatarTelefone(r.whatsapp)}</p>
            <p><span className="text-gray-500">E-mail:</span> {r.email}</p>
            <p><span className="text-gray-500">Instagram:</span> {r.instagram || "—"}</p>
            <p><span className="text-gray-500">Estado civil:</span> {r.estado_civil}</p>
            <p><span className="text-gray-500">Camisa:</span> {r.tamanho_camisa}</p>
            <p className="sm:col-span-2"><span className="text-gray-500">Endereço:</span> {r.endereco}</p>
            <p><span className="text-gray-500">Filhos:</span> {r.tem_filhos ? `Sim, ${r.quantidade_filhos} (${r.idades_filhos})` : "Não"}</p>
            <p><span className="text-gray-500">Pessoas com quem mora:</span> {r.quantidade_pessoas_mora_junto ?? "Não informado"}</p>
            <p><span className="text-gray-500">Quem são:</span> {r.mora_com_quem || r.mora_com || "—"}</p>
            <p className="sm:col-span-2"><span className="text-gray-500">Emprego/ocupação dessas pessoas:</span> {r.emprego_ocupacao_pessoas_mora_junto || r.profissao_pessoas_mora_com || "—"}</p>
            <p><span className="text-gray-500">Trabalha atualmente:</span> {r.trabalha_atualmente ? `Sim — ${r.cargo_atual}` : "Não"}</p>
            <p><span className="text-gray-500">Disponibilidade p/ viajar:</span> {r.disponibilidade_viajar === "integral" ? "Integral" : r.disponibilidade_viajar === "parcial" ? "Parcial" : "Não tem"}</p>
            {r.disponibilidade_viajar_explicacao && <p className="sm:col-span-2"><span className="text-gray-500">Explicação:</span> {r.disponibilidade_viajar_explicacao}</p>}
            <p className="sm:col-span-2"><span className="text-gray-500">Conhecido no Grupo Eugênio:</span> {r.tem_conhecido_grupo ? `Sim — ${r.conhecido_nome} (${r.conhecido_relacao})` : "Não"}</p>
            <p className="sm:col-span-2"><span className="text-gray-500">Origem da vaga:</span> {r.origem_vaga}</p>
            <p className="sm:col-span-2">
              <span className="text-gray-500">Renda extra:</span>{" "}
              {r.renda_extra === "sim" ? `Sim — ${r.renda_extra_descricao || "sem descrição"}` : r.renda_extra === "nao" ? "Não" : r.renda_extra}
            </p>
            <p className="sm:col-span-2"><span className="text-gray-500">Formação:</span> {r.formacao}</p>
            <p className="sm:col-span-2"><span className="text-gray-500">Quer aprender:</span> {r.habilidades_quer_aprender}</p>
            <p><span className="text-gray-500">Internet em casa:</span> {r.internet_casa ? "Sim" : "Não"}</p>
            <p><span className="text-gray-500">Android / iOS:</span> {[r.celular_android && "Android", r.celular_ios && "iOS"].filter(Boolean).join(", ") || "Nenhum"}</p>
            <p className="sm:col-span-2"><span className="text-gray-500">Ferramentas:</span> {((r.ferramentas_json as string[]) || []).join(", ") || "—"}{r.ferramentas_outros ? ` · Outros: ${r.ferramentas_outros}` : ""}</p>
            <p className="sm:col-span-2"><span className="text-gray-500">Horas livres:</span> {((r.horas_livres_json as string[]) || []).join(", ") || "—"}</p>
          </div>
          <div className="border-t pt-3 space-y-2">
            <h4 className="font-semibold">Sobre você</h4>
            {PERGUNTAS_SOBRE_VOCE.map((p) => (
              <p key={p.key}><span className="text-gray-500">{p.label}</span><br />{sv[p.key] || "—"}</p>
            ))}
          </div>
        </div>
      )}

      <Observacoes entidadeTipo="ficha" entidadeId={ficha.id} observacoes={obs || []} podeEditar={acessoTotal} path={`/fichas/${ficha.id}`} />
    </div>
  );
}
