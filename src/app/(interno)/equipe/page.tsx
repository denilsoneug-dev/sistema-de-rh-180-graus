import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getPerfil } from "@/lib/auth";
import { formatarTelefone, cpfPorPapel } from "@/lib/cpf";
import { STATUS_EQUIPE_LABELS, fmtData } from "@/lib/constants";
import { mapResumosPorCandidatos, mapResumosPorEquipe } from "@/lib/requisitos";
import { ResumoRequisitos } from "@/components/ResumoRequisitos";
import { EquipeEmTreinamento, type PessoaEmTreinamento } from "@/components/EquipeEmTreinamento";

export const dynamic = "force-dynamic";

const TABS = [
  { key: "ativos", label: "Ativos" },
  { key: "em_experiencia", label: "Em experiência" },
  { key: "em_treinamento", label: "Em treinamento" },
  { key: "afastado", label: "Afastados" },
  { key: "desligado", label: "Desligados" },
] as const;

export default async function EquipePage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const { tab = "ativos" } = await searchParams;
  const perfil = await getPerfil();
  const acessoTotal = perfil?.papel === "acesso_total";
  const supabase = await createClient();

  if (tab === "em_treinamento") {
    const { data: candidatos } = await supabase
      .from("candidatos")
      .select("*")
      .eq("status", "em_treinamento")
      .order("nome");
    const lista = candidatos || [];
    const ids = lista.map((c) => c.id);
    const indicadorIds = [...new Set(lista.map((c) => c.indicado_por_equipe_id).filter((id): id is string => !!id))];
    const fichaIds = [...new Set(lista.map((c) => c.ficha_id).filter((id): id is string => !!id))];

    const [{ data: etapas }, { data: indicadores }, { data: respostasIndicacao }, resumos] = await Promise.all([
      ids.length > 0
        ? supabase.from("candidato_etapas").select("candidato_id, data, criado_em").in("candidato_id", ids).eq("tipo_etapa", "treinamento").order("data", { ascending: true })
        : Promise.resolve({ data: [] }),
      indicadorIds.length > 0
        ? supabase.from("equipe").select("id, nome").in("id", indicadorIds)
        : Promise.resolve({ data: [] }),
      fichaIds.length > 0
        ? supabase.from("ficha_respostas").select("ficha_id, tem_conhecido_grupo, conhecido_nome").in("ficha_id", fichaIds)
        : Promise.resolve({ data: [] }),
      mapResumosPorCandidatos(supabase, lista),
    ]);

    const inicioPorCandidato = new Map<string, string>();
    for (const etapa of etapas || []) {
      if (!inicioPorCandidato.has(etapa.candidato_id)) {
        inicioPorCandidato.set(etapa.candidato_id, etapa.data || etapa.criado_em);
      }
    }
    const nomeIndicador = new Map((indicadores || []).map((i) => [i.id, i.nome]));
    const indicacaoFicha = new Map(
      (respostasIndicacao || [])
        .filter((r) => r.tem_conhecido_grupo && r.conhecido_nome)
        .map((r) => [r.ficha_id, r.conhecido_nome]),
    );
    const pessoas: PessoaEmTreinamento[] = lista.map((c) => ({
      id: c.id,
      nome: c.nome,
      cpf: c.cpf,
      telefone: c.telefone,
      vaga_pretendida: c.vaga_pretendida,
      inicio_treinamento: inicioPorCandidato.get(c.id) || c.etapa_atual_desde,
      indicador_nome: c.indicado_por_equipe_id
        ? nomeIndicador.get(c.indicado_por_equipe_id) || null
        : (c.ficha_id ? indicacaoFicha.get(c.ficha_id) || null : null),
      resumo: resumos.get(c.id) ?? null,
    }));

    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <h1 className="text-xl font-bold">Equipe Atual</h1>
            <p className="text-sm text-gray-500">Pessoas em treinamento aparecem aqui sem criar vínculo definitivo na equipe.</p>
          </div>
          {acessoTotal && <Link href="/equipe/nova" className="btn-primary">Cadastrar pessoa</Link>}
        </div>
        <div className="flex gap-1 border-b border-gray-200 overflow-x-auto">
          {TABS.map((t) => (
            <Link key={t.key} href={`/equipe?tab=${t.key}`}
              className={`px-4 py-2 text-sm font-medium border-b-2 whitespace-nowrap ${tab === t.key ? "border-brand-600 text-brand-700" : "border-transparent text-gray-500"}`}>
              {t.label}
            </Link>
          ))}
        </div>
        <EquipeEmTreinamento pessoas={pessoas} acessoTotal={acessoTotal} />
      </div>
    );
  }

  let query = supabase.from("equipe").select("*").order("nome");
  query = tab === "ativos" ? query.eq("status", "ativo") : query.eq("status", tab);
  const { data: membros } = await query;
  const resumos = await mapResumosPorEquipe(supabase, membros || []);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-xl font-bold">Equipe Atual</h1>
        {perfil?.papel === "acesso_total" && (
          <Link href="/equipe/nova" className="btn-primary">Cadastrar pessoa</Link>
        )}
      </div>
      <div className="flex gap-1 border-b border-gray-200 overflow-x-auto">
        {TABS.map((t) => (
          <Link key={t.key} href={`/equipe?tab=${t.key}`}
            className={`px-4 py-2 text-sm font-medium border-b-2 whitespace-nowrap ${tab === t.key ? "border-brand-600 text-brand-700" : "border-transparent text-gray-500"}`}>
            {t.label}
          </Link>
        ))}
      </div>
      <div className="space-y-3">
        {(membros || []).length === 0 && <p className="text-gray-400 text-sm py-8 text-center">Ninguém neste status.</p>}
        {(membros || []).map((m) => (
          <Link key={m.id} href={`/equipe/${m.id}`} className="card p-4 block hover:border-brand-300">
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div>
                <p className="font-semibold">{m.nome}</p>
                <p className="text-sm text-gray-500">{m.cargo} · CPF {cpfPorPapel(m.cpf, acessoTotal)} · {formatarTelefone(m.telefone)}</p>
              </div>
              <div className="text-right text-sm">
                <span className="badge bg-gray-100 text-gray-700">{STATUS_EQUIPE_LABELS[m.status as string]}</span>
                <p className="text-gray-400 mt-1">Entrada {fmtData(m.data_entrada)}</p>
              </div>
            </div>
            <div className="mt-3 border-t border-slate-100 pt-3">
              <ResumoRequisitos
                variante="compacto"
                resumo={resumos.get(m.id) ?? null}
                semFichaMsg="Cadastro direto — requisitos não informados"
              />
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
