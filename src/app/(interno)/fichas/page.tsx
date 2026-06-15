import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getPerfil } from "@/lib/auth";
import { criarFichaPendente } from "@/app/actions/fichas";
import { STATUS_FICHA_LABELS, requisitosPrincipais, resumoRequisitos } from "@/lib/constants";
import { FichaPainel, statusRecrutamentoValido } from "@/lib/rh";
import { PainelFichas } from "@/components/PainelFichas";

export const dynamic = "force-dynamic";

const TABS = [
  { key: "recebida", label: "Recebidas" },
  { key: "pendente", label: "Pendentes" },
  { key: "selecionada", label: "Selecionadas" },
  { key: "arquivada", label: "Arquivadas" },
  { key: "rejeitada", label: "Rejeitadas" },
  { key: "expirada", label: "Expiradas" },
] as const;

export default async function FichasPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const { tab = "recebida" } = await searchParams;
  const perfil = await getPerfil();
  const acessoTotal = perfil?.papel === "acesso_total";
  const supabase = await createClient();

  const { data: fichas } = await supabase
    .from("fichas")
    .select("*, ficha_respostas(*)")
    .eq("status", tab)
    .order("ficha_enviada_em", { ascending: false, nullsFirst: false })
    .order("criado_em", { ascending: false });

  const itens: FichaPainel[] = (fichas || []).map((ficha) => {
    const resposta = Array.isArray(ficha.ficha_respostas) ? ficha.ficha_respostas[0] : ficha.ficha_respostas;
    const status = statusRecrutamentoValido(ficha.status_recrutamento)
      ? ficha.status_recrutamento
      : "nova_ficha";
    return {
      id: ficha.id,
      nome: resposta?.nome_completo || ficha.nome_inicial,
      idade: resposta?.idade ?? null,
      telefone: resposta?.whatsapp || "",
      email: resposta?.email || "",
      statusRecrutamento: status,
      statusFicha: ficha.status,
      enviadaEm: ficha.ficha_enviada_em,
      curriculoUrl: ficha.curriculo_url,
      requisitos: resposta ? requisitosPrincipais(resposta).pontos : 0,
      resumoReq: resumoRequisitos(resposta),
    };
  });

  // Em "Selecionadas": mostra o estado atual (a ficha já virou candidato/treinamento/equipe).
  if (tab === "selecionada" && itens.length > 0) {
    const ids = itens.map((i) => i.id);
    const { data: cands } = await supabase.from("candidatos").select("ficha_id, status").in("ficha_id", ids);
    const LABEL: Record<string, string> = {
      entrevista_online: "Em processo (seleção)",
      entrevista_presencial: "Em processo (seleção)",
      redacao_escrita: "Em processo (seleção)",
      em_treinamento: "Em treinamento (Equipe)",
      efetivado: "Contratado(a) — na Equipe",
      rejeitado: "Rejeitado(a) no processo",
      treinamento_encerrado: "Treinamento encerrado",
    };
    const estado = new Map<string, string>();
    for (const c of cands || []) {
      if (c.ficha_id) estado.set(c.ficha_id as string, LABEL[c.status as string] || c.status);
    }
    for (const it of itens) it.estadoAtual = estado.get(it.id) ?? "Aguardando conversão";
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold">Painel de fichas</h1>
          <p className="text-sm text-gray-500">Análise inicial dos candidatos pelo RH.</p>
        </div>
        {acessoTotal && (
          <form action={criarFichaPendente} className="flex w-full gap-2 sm:w-auto">
            <input name="nome" className="input !w-auto min-w-0 flex-1 sm:!w-56" placeholder="Nome do candidato" required />
            <button className="btn-primary whitespace-nowrap">Criar link</button>
          </form>
        )}
      </div>

      <nav className="flex gap-1 overflow-x-auto border-b border-gray-200" aria-label="Situação das fichas">
        {TABS.map((item) => (
          <Link key={item.key} href={`/fichas?tab=${item.key}`}
            className={`whitespace-nowrap border-b-2 px-4 py-2 text-sm font-medium ${tab === item.key ? "border-brand-600 text-brand-700" : "border-transparent text-gray-500"}`}>
            {item.label}
          </Link>
        ))}
      </nav>

      <div className="flex items-center justify-between gap-2">
        <h2 className="font-semibold">{STATUS_FICHA_LABELS[tab] || tab}</h2>
        <span className="text-sm text-gray-400">Mais recentes primeiro</span>
      </div>
      <PainelFichas fichas={itens} podeEditar={acessoTotal} />
    </div>
  );
}
