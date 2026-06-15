import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { diasDesde, ETAPA_LABELS } from "@/lib/constants";
import { IconFichas, IconCandidatos, IconEquipe } from "@/components/icons";
import { calcularContadoresOperacionais, candidatoEstaEmProcesso } from "@/lib/equipe-treinamento";

export const dynamic = "force-dynamic";

type Tom = "brand" | "accent" | "emerald" | "amber" | "slate";

const TOM_CLASSES: Record<Tom, { chip: string; valor: string; bar: string }> = {
  brand: { chip: "bg-brand-100 text-brand-700", valor: "text-brand-700", bar: "bg-brand-500" },
  accent: { chip: "bg-accent-100 text-accent-600", valor: "text-accent-600", bar: "bg-accent-500" },
  emerald: { chip: "bg-emerald-100 text-emerald-700", valor: "text-emerald-700", bar: "bg-emerald-500" },
  amber: { chip: "bg-amber-100 text-amber-700", valor: "text-amber-700", bar: "bg-amber-500" },
  slate: { chip: "bg-slate-100 text-slate-600", valor: "text-slate-700", bar: "bg-slate-400" },
};

export default async function Dashboard() {
  const supabase = await createClient();

  const [{ data: fichas }, { data: candidatos }, { data: equipe }] = await Promise.all([
    supabase.from("fichas").select("id, status"),
    supabase.from("candidatos").select("id, nome, status, etapa_atual_desde"),
    supabase.from("equipe").select("id, status"),
  ]);

  const contar = (arr: { status: string }[] | null, s: string) => (arr || []).filter((x) => x.status === s).length;
  const contadores = calcularContadoresOperacionais(candidatos || [], equipe || []);

  const ativos = (candidatos || []).filter((c) => candidatoEstaEmProcesso(c.status));

  const LIMITES: Record<string, number> = {
    entrevista_online: 7, entrevista_presencial: 7, redacao_escrita: 7,
  };
  const atrasados: Record<string, { nome: string; dias: number }[]> = {};
  for (const c of ativos) {
    const dias = diasDesde(c.etapa_atual_desde);
    if (dias > (LIMITES[c.status] || 999)) {
      (atrasados[c.status] ||= []).push({ nome: c.nome, dias });
    }
  }

  const grupos: { titulo: string; Icon: (p: React.SVGProps<SVGSVGElement>) => React.JSX.Element; cards: { label: string; valor: number; href: string; tom: Tom }[] }[] = [
    {
      titulo: "Fichas",
      Icon: IconFichas,
      cards: [
        { label: "Fichas pendentes", valor: contar(fichas, "pendente"), href: "/fichas?tab=pendente", tom: "amber" },
        { label: "Fichas recebidas", valor: contar(fichas, "recebida"), href: "/fichas?tab=recebida", tom: "brand" },
      ],
    },
    {
      titulo: "Processo seletivo",
      Icon: IconCandidatos,
      cards: [
        { label: "Em processo", valor: contadores.candidatosEmProcesso, href: "/candidatos", tom: "brand" },
        { label: "Entrevista online", valor: contar(candidatos, "entrevista_online"), href: "/candidatos", tom: "accent" },
        { label: "Entrevista presencial", valor: contar(candidatos, "entrevista_presencial"), href: "/candidatos", tom: "accent" },
        { label: "Redação escrita", valor: contar(candidatos, "redacao_escrita"), href: "/candidatos", tom: "accent" },
      ],
    },
    {
      titulo: "Equipe",
      Icon: IconEquipe,
      cards: [
        { label: "Equipe atual (ativos)", valor: contadores.ativosDefinitivos, href: "/equipe", tom: "emerald" },
        { label: "Em experiência", valor: contar(equipe, "em_experiencia"), href: "/equipe?tab=em_experiencia", tom: "amber" },
        { label: "Em treinamento", valor: contadores.emTreinamento, href: "/equipe?tab=em_treinamento", tom: "brand" },
        { label: "Afastados", valor: contar(equipe, "afastado"), href: "/equipe?tab=afastado", tom: "slate" },
        { label: "Desligados", valor: contar(equipe, "desligado"), href: "/equipe?tab=desligado", tom: "slate" },
      ],
    },
  ];

  const temAtrasos = Object.keys(atrasados).length > 0;
  let n = 0;

  return (
    <div className="space-y-8">
      <div className="animate-fade-up">
        <h1 className="font-display text-2xl font-extrabold tracking-tight text-slate-900">
          Olá, bem-vindo de volta 👋
        </h1>
        <p className="text-sm text-slate-500 mt-1">Visão geral do recrutamento e da equipe do 180 Graus.</p>
      </div>

      {temAtrasos && (
        <div className="card animate-scale-in overflow-hidden border-red-200">
          <div className="flex items-start gap-3 bg-red-50 p-4">
            <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-red-100 text-red-600 text-lg">⚠️</span>
            <div className="min-w-0">
              <h2 className="font-bold text-red-800">Alertas de atraso</h2>
              <ul className="mt-1 text-sm text-red-700 space-y-1">
                {Object.entries(atrasados).map(([etapa, lista]) => (
                  <li key={etapa}>
                    <Link href="/candidatos" className="font-semibold underline decoration-red-300 underline-offset-2 hover:decoration-red-500">
                      {lista.length} candidato(s) parado(s) há mais de 7 dias em {ETAPA_LABELS[etapa]?.toLowerCase()}
                    </Link>
                    <span className="text-red-500"> — {lista.map((l) => `${l.nome} (${l.dias}d)`).join(", ")}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      {grupos.map((g) => (
        <section key={g.titulo} className="space-y-3">
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
              <g.Icon className="h-4 w-4" />
            </span>
            <h2 className="font-display text-sm font-bold uppercase tracking-wider text-slate-500">{g.titulo}</h2>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {g.cards.map((c) => {
              const tom = TOM_CLASSES[c.tom];
              const delay = (n++ % 12) * 45;
              return (
                <Link
                  key={c.label}
                  href={c.href}
                  style={{ animationDelay: `${delay}ms` }}
                  className="card card-hover group relative overflow-hidden p-4 animate-fade-up"
                >
                  <span className={`absolute inset-x-0 top-0 h-1 ${tom.bar} opacity-70`} />
                  <p className={`font-display text-3xl font-extrabold tabular-nums ${tom.valor}`}>{c.valor}</p>
                  <p className="mt-1 text-sm text-slate-500">{c.label}</p>
                  <span className="absolute bottom-3 right-3 text-slate-300 transition-all duration-200 group-hover:translate-x-0.5 group-hover:text-brand-400">→</span>
                </Link>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
