import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { limparCpf, formatarCpf } from "@/lib/cpf";
import { ETAPA_LABELS, STATUS_FICHA_LABELS, STATUS_EQUIPE_LABELS } from "@/lib/constants";

export const dynamic = "force-dynamic";

type Resultado = {
  tipo: string;
  nome: string;
  cpf: string | null;
  status: string;
  detalhe: string;
  href: string;
};

export default async function BuscaPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q: termo = "" } = await searchParams;
  const q = termo.trim();
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

    const vistos = new Set<string>();
    for (const f of [...(fichasResp || []), ...(fichas || [])]) {
      if (vistos.has(f.id)) continue;
      vistos.add(f.id);
      resultados.push({
        tipo: "Ficha",
        nome: f.nome_inicial,
        cpf: f.cpf,
        status: STATUS_FICHA_LABELS[f.status as string] || f.status,
        detalhe: "",
        href: `/fichas/${f.id}`,
      });
    }

    // Candidatos
    const { data: cands } = buscaCpf
      ? await supabase.from("candidatos").select("*").ilike("cpf", `%${cpfLimpo}%`)
      : await supabase.from("candidatos").select("*").ilike("nome", `%${q}%`);
    for (const c of cands || []) {
      resultados.push({
        tipo: "Candidato",
        nome: c.nome,
        cpf: c.cpf,
        status: ETAPA_LABELS[c.status as string] || c.status,
        detalhe: ["entrevista_online","entrevista_presencial","redacao_escrita","em_treinamento"].includes(c.status) ? `Etapa: ${ETAPA_LABELS[c.status as string]}` : "",
        href: `/candidatos/${c.id}`,
      });
    }

    // Equipe
    const { data: eq } = buscaCpf
      ? await supabase.from("equipe").select("*").ilike("cpf", `%${cpfLimpo}%`)
      : await supabase.from("equipe").select("*").ilike("nome", `%${q}%`);
    for (const m of eq || []) {
      resultados.push({
        tipo: "Equipe",
        nome: m.nome,
        cpf: m.cpf,
        status: STATUS_EQUIPE_LABELS[m.status as string] || m.status,
        detalhe: `Cargo: ${m.cargo}`,
        href: `/equipe/${m.id}`,
      });
    }
  }

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
                <p className="text-sm text-gray-500">{r.cpf ? `CPF ${formatarCpf(r.cpf)}` : "CPF não informado"}{r.detalhe ? ` · ${r.detalhe}` : ""}</p>
              </div>
              <div className="text-right">
                <span className="badge bg-brand-100 text-brand-800">{r.tipo}</span>
                <p className="text-sm text-gray-500 mt-1">{r.status}</p>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
