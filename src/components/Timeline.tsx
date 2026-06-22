import { fmtDataHora } from "@/lib/constants";

export type TimelineTom = "brand" | "emerald" | "red" | "amber" | "slate";

export type EventoTimeline = {
  ts: string;
  titulo: string;
  detalhe?: string | null;
  autor?: string | null;
  tom?: TimelineTom;
  link?: { href: string; label: string } | null;
};

const TOM_PONTO: Record<TimelineTom, string> = {
  brand: "bg-brand-500 ring-brand-100",
  emerald: "bg-emerald-500 ring-emerald-100",
  red: "bg-red-500 ring-red-100",
  amber: "bg-amber-500 ring-amber-100",
  slate: "bg-slate-400 ring-slate-100",
};

// Linha do tempo cronológica do candidato (ficha selecionada → criação →
// etapas → rejeição/efetivação). Recebe eventos já ordenados do mais antigo
// para o mais novo.
export function Timeline({ eventos }: { eventos: EventoTimeline[] }) {
  if (eventos.length === 0) {
    return <p className="text-sm text-slate-400">Nenhum evento registrado ainda.</p>;
  }
  return (
    <ol className="relative space-y-5">
      {/* linha vertical */}
      <span className="absolute left-[7px] top-1 bottom-1 w-px bg-slate-200" aria-hidden />
      {eventos.map((e, i) => (
        <li key={i} className="relative pl-7">
          <span
            className={`absolute left-0 top-1 h-[15px] w-[15px] rounded-full ring-4 ${TOM_PONTO[e.tom || "slate"]}`}
            aria-hidden
          />
          <p className="text-sm font-semibold text-slate-800">{e.titulo}</p>
          {e.detalhe && <p className="text-sm text-slate-600 whitespace-pre-line break-words">{e.detalhe}</p>}
          {e.link && (
            <a className="text-sm text-brand-700 underline" href={e.link.href} target="_blank" rel="noopener noreferrer">
              {e.link.label}
            </a>
          )}
          <p className="mt-0.5 text-xs text-slate-400">
            {fmtDataHora(e.ts)}
            {e.autor ? ` · ${e.autor}` : ""}
          </p>
        </li>
      ))}
    </ol>
  );
}
