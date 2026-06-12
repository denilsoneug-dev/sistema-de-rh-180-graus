import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { diasDesde, ETAPA_LABELS } from "@/lib/constants";

export const dynamic = "force-dynamic";

export default async function Dashboard() {
  const supabase = await createClient();

  const [{ data: fichas }, { data: candidatos }, { data: equipe }] = await Promise.all([
    supabase.from("fichas").select("id, status"),
    supabase.from("candidatos").select("id, nome, status, etapa_atual_desde"),
    supabase.from("equipe").select("id, status"),
  ]);

  const contar = (arr: { status: string }[] | null, s: string) => (arr || []).filter((x) => x.status === s).length;

  const ativos = (candidatos || []).filter((c) =>
    ["entrevista_online", "entrevista_presencial", "redacao_escrita", "em_treinamento"].includes(c.status)
  );

  const LIMITES: Record<string, number> = {
    entrevista_online: 7, entrevista_presencial: 7, redacao_escrita: 7, em_treinamento: 15,
  };
  const atrasados: Record<string, { nome: string; dias: number }[]> = {};
  for (const c of ativos) {
    const dias = diasDesde(c.etapa_atual_desde);
    if (dias > (LIMITES[c.status] || 999)) {
      (atrasados[c.status] ||= []).push({ nome: c.nome, dias });
    }
  }

  const cards = [
    { label: "Fichas pendentes", valor: contar(fichas, "pendente"), href: "/fichas?tab=pendente" },
    { label: "Fichas recebidas", valor: contar(fichas, "recebida"), href: "/fichas?tab=recebida" },
    { label: "Candidatos em processo", valor: ativos.length, href: "/candidatos" },
    { label: "Entrevista online", valor: contar(candidatos, "entrevista_online"), href: "/candidatos" },
    { label: "Entrevista presencial", valor: contar(candidatos, "entrevista_presencial"), href: "/candidatos" },
    { label: "Redação escrita", valor: contar(candidatos, "redacao_escrita"), href: "/candidatos" },
    { label: "Em treinamento", valor: contar(candidatos, "em_treinamento"), href: "/candidatos" },
    { label: "Equipe atual (ativos)", valor: contar(equipe, "ativo"), href: "/equipe" },
    { label: "Em experiência", valor: contar(equipe, "em_experiencia"), href: "/equipe?tab=em_experiencia" },
    { label: "Afastados", valor: contar(equipe, "afastado"), href: "/equipe?tab=afastado" },
    { label: "Desligados", valor: contar(equipe, "desligado"), href: "/equipe?tab=desligado" },
  ];

  const temAtrasos = Object.keys(atrasados).length > 0;

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold">Dashboard</h1>

      {temAtrasos && (
        <div className="card p-4 border-red-300 bg-red-50">
          <h2 className="font-bold text-red-800 mb-2">⚠️ Alertas de atraso</h2>
          <ul className="text-sm text-red-700 space-y-1">
            {Object.entries(atrasados).map(([etapa, lista]) => (
              <li key={etapa}>
                <Link href="/candidatos" className="underline">
                  {lista.length} candidato(s) parado(s) há mais de {etapa === "em_treinamento" ? 15 : 7} dias em {ETAPA_LABELS[etapa]?.toLowerCase()}
                </Link>
                <span className="text-red-500"> — {lista.map((l) => `${l.nome} (${l.dias}d)`).join(", ")}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        {cards.map((c) => (
          <Link key={c.label} href={c.href} className="card p-4 hover:border-brand-300">
            <p className="text-3xl font-bold text-brand-700">{c.valor}</p>
            <p className="text-sm text-gray-500 mt-1">{c.label}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
