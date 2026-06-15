import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getPerfil } from "@/lib/auth";
import { limparCpf, cpfPorPapel } from "@/lib/cpf";
import { ETAPA_LABELS, STATUS_FICHA_LABELS, STATUS_EQUIPE_LABELS, type ResumoRequisitos as ResumoTipo } from "@/lib/constants";
import { mapResumosPorFicha, mapResumosPorCandidatos, mapResumosPorEquipe } from "@/lib/requisitos";
import { ResumoRequisitos } from "@/components/ResumoRequisitos";
import { apresentacaoBuscaCandidato } from "@/lib/equipe-treinamento";

export const dynamic = "force-dynamic";

type Resultado = {
  tipo: string;
  nome: string;
  cpf: string | null;
  status: string;
  detalhe: string;
  href: string;
  resumo?: ResumoTipo | null;
};

export default async function BuscaPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q: termo = "" } = await searchParams;
  const q = termo.trim();
  const perfil = await getPerfil();
  const acessoTotal = perfil?.papel === "acesso_total";
  const supabase = await createClient();
  const resultados: Resultado[] = [];

  if (q) {
    const cpfLimpo = limparCpf(q);
    const buscaCpf = cpfLimpo.length >= 3 && /^\d+$/.test(cpfLimpo) && limparCpf(q).length === q.replace(/[.\-\s]/g, "").length;

    // Fichas (via respostas) + pendentes por nome inicial
    const fq = supabase.from("fichas").select("id, nome_inicial, status, cpf, ficha_respostas(nome_completo, cpf)");
    const { data: fichas } = buscaCpf
      ? await fq.or(`cpf.ilike.%${cpfLimpo}%`)
      : await fq.ilike("nome_inicial", `%${q}%`);

    let fichasResp: typeof fichas = [];
    if (!buscaCpf) {
      const { data } = await supabase.from("ficha_respostas")
        .select("ficha_id, nome_completo, cpf, fichas(id, nome_inicial, status, cpf)")
        .ilike("nome_completo", `%${q}%`);
      fichasResp = (data || []).map((r) => {
        const f = r.fichas as unknown as { id: string; nome_inicial: string; status: string; cpf: string | null };
        return { id: f.id, nome_inicial: r.nome_completo, status: f.status, cpf: r.cpf, ficha_respostas: [] };
      });
    } else {
      const { data } = await supabase.from("ficha_respostas")
        .select("ficha_id, nome_completo, cpf, fichas(id, nome_inicial, status, cpf)")
        .ilike("cpf", `%${cpfLimpo}%`);
      fichasResp = (data || []).map((r) => {
        const f = r.fichas as unknown as { id: string; nome_inicial: string; status: string; cpf: string | null };
        return { id: f.id, nome_inicial: r.nome_completo, status: f.status, cpf: r.cpf, ficha_respostas: [] };
      });
    }

    const fichasCombinadas = [...(fichasResp || []), ...(fichas || [])];
    const resumosFicha = await mapResumosPorFicha(supabase, fichasCombinadas.map((f) => f.id));
    const vistos = new Set<string>();
    for (const f of fichasCombinadas) {
      if (vistos.has(f.id)) continue;
      vistos.add(f.id);
      resultados.push({
        tipo: "Ficha",
        nome: f.nome_inicial,
        cpf: f.cpf,
        status: STATUS_FICHA_LABELS[f.status as string] || f.status,
        detalhe: "",
        href: `/fichas/${f.id}`,
        resumo: resumosFicha.get(f.id) ?? null,
      });
    }

    // Candidatos
    const { data: cands } = buscaCpf
      ? await supabase.from("candidatos").select("*").ilike("cpf", `%${cpfLimpo}%`)
      : await supabase.from("candidatos").select("*").ilike("nome", `%${q}%`);
    const resumosCand = await mapResumosPorCandidatos(supabase, cands || []);
    const candidatosTreinamentoIds = new Set<string>();
    const cpfsTreinamento = new Set<string>();
    for (const c of cands || []) {
      const apresentacao = apresentacaoBuscaCandidato(c.status, c.vaga_pretendida);
      if (c.status === "em_treinamento") {
        candidatosTreinamentoIds.add(c.id);
        if (c.cpf) cpfsTreinamento.add(limparCpf(c.cpf));
      }
      resultados.push({
        tipo: apresentacao.tipo,
        nome: c.nome,
        cpf: c.cpf,
        status: apresentacao.status || ETAPA_LABELS[c.status as string] || c.status,
        detalhe: apresentacao.detalhe === "em_processo" ? `Etapa: ${ETAPA_LABELS[c.status as string]}` : apresentacao.detalhe,
        href: `/candidatos/${c.id}`,
        resumo: resumosCand.get(c.id) ?? null,
      });
    }

    // Equipe
    const { data: eq } = buscaCpf
      ? await supabase.from("equipe").select("*").ilike("cpf", `%${cpfLimpo}%`)
      : await supabase.from("equipe").select("*").ilike("nome", `%${q}%`);
    const resumosEquipe = await mapResumosPorEquipe(supabase, eq || []);
    for (const m of eq || []) {
      if (
        (m.candidato_origem_id && candidatosTreinamentoIds.has(m.candidato_origem_id)) ||
        (m.cpf && cpfsTreinamento.has(limparCpf(m.cpf)))
      ) continue;
      resultados.push({
        tipo: "Equipe",
        nome: m.nome,
        cpf: m.cpf,
        status: STATUS_EQUIPE_LABELS[m.status as string] || m.status,
        detalhe: `Cargo: ${m.cargo}`,
        href: `/equipe/${m.id}`,
        resumo: resumosEquipe.get(m.id) ?? null,
      });
    }
  }

  // Mostra o estado mais avançado primeiro (Equipe > Candidato > Ficha original).
  const prioridade = (tipo: string) => (tipo === "Equipe" ? 0 : tipo === "Candidato" ? 1 : 2);
  resultados.sort((a, b) => prioridade(a.tipo) - prioridade(b.tipo));

  return (
    <div className="space-y-4 max-w-3xl">
      <h1 className="text-xl font-bold">Busca</h1>
      <form action="/busca" method="get" className="flex gap-2">
        <input name="q" defaultValue={q} className="input min-w-0 flex-1" placeholder="Nome ou CPF (com ou sem pontuação)" autoFocus />
        <button className="btn-primary">Buscar</button>
      </form>

      {q && (
        <p className="text-sm text-gray-500">{resultados.length} resultado(s) para “{q}”</p>
      )}

      <div className="space-y-3">
        {resultados.map((r, i) => (
          <Link key={i} href={r.href} className="card p-4 block hover:border-brand-300">
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div>
                <p className="font-semibold">{r.nome}</p>
                <p className="text-sm text-gray-500">{r.cpf ? `CPF ${cpfPorPapel(r.cpf, acessoTotal)}` : "CPF não informado"}{r.detalhe ? ` · ${r.detalhe}` : ""}</p>
              </div>
              <div className="text-right">
                <span className="badge bg-brand-100 text-brand-800">{r.tipo}</span>
                <p className="text-[11px] uppercase tracking-wide text-slate-400 mt-1">
                  {r.tipo === "Ficha" ? "Documento original" : "Estado atual"}
                </p>
                <p className="text-sm text-gray-500">{r.status}</p>
              </div>
            </div>
            {r.resumo && (
              <div className="mt-3 border-t border-slate-100 pt-3">
                <ResumoRequisitos variante="compacto" resumo={r.resumo} />
              </div>
            )}
          </Link>
        ))}
      </div>
    </div>
  );
}
