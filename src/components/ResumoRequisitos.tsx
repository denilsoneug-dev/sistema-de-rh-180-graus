import type { ResumoRequisitos as Resumo, RequisitoEstado } from "@/lib/constants";

// Classe do badge de pontuação por nível (elegante, sem exagero "gamificado").
function badgeClasse(pontos: number): string {
  if (pontos >= 4) return "bg-emerald-100 text-emerald-800 ring-emerald-600/15";
  if (pontos >= 3) return "bg-brand-100 text-brand-800 ring-brand-600/15";
  if (pontos >= 2) return "bg-amber-100 text-amber-800 ring-amber-600/15";
  return "bg-red-100 text-red-700 ring-red-600/15";
}

const ICONE: Record<RequisitoEstado, string> = { ok: "✓", atencao: "!", negativo: "✕" };
const COR_TEXTO: Record<RequisitoEstado, string> = {
  ok: "text-emerald-700",
  atencao: "text-amber-700",
  negativo: "text-slate-400",
};
const COR_PONTO: Record<RequisitoEstado, string> = {
  ok: "bg-emerald-500",
  atencao: "bg-amber-500",
  negativo: "bg-slate-300",
};

function Score({ pontos }: { pontos: number }) {
  return (
    <span className={`badge ${badgeClasse(pontos)}`} title="Requisitos principais atendidos: disponibilidade integral, notebook, veículo e CNH">
      ★ {pontos}/4 requisitos
    </span>
  );
}

export function ResumoRequisitos({
  resumo,
  variante = "compacto",
  pontos,
  semFichaMsg = "Requisitos não informados",
}: {
  resumo: Resumo | null;
  variante?: "compacto" | "detalhado";
  /** Pontuação para o badge quando o resumo completo não está disponível (retrocompat). */
  pontos?: number | null;
  semFichaMsg?: string;
}) {
  const score = resumo?.pontos ?? (pontos ?? null);

  // ---------- COMPACTO (cards e listas) ----------
  if (variante === "compacto") {
    if (score == null && !resumo) {
      return <span className="text-xs text-slate-400">{semFichaMsg}</span>;
    }
    return (
      <div className="flex flex-col items-start gap-1">
        {score != null && <Score pontos={score} />}
        {resumo && (
          <p className="text-xs text-slate-500 leading-snug">
            Viajar: {resumo.itens.disponibilidade.label.toLowerCase()} · Notebook: {resumo.itens.notebook.label.toLowerCase()} · Veículo: {resumo.itens.veiculo.label.toLowerCase()} · CNH: {resumo.itens.cnh.label.toLowerCase()}
          </p>
        )}
      </div>
    );
  }

  // ---------- DETALHADO (páginas individuais) ----------
  if (!resumo) {
    return (
      <div className="card p-4">
        <h3 className="font-bold mb-1">Requisitos principais</h3>
        <p className="text-sm text-slate-500">{semFichaMsg}</p>
      </div>
    );
  }

  const linhas: { rotulo: string; valor: string; estado: RequisitoEstado }[] = [
    { rotulo: "Disponibilidade para viajar", valor: resumo.itens.disponibilidade.label, estado: resumo.itens.disponibilidade.estado },
    { rotulo: "Notebook próprio", valor: resumo.itens.notebook.label, estado: resumo.itens.notebook.estado },
    { rotulo: "Veículo próprio", valor: resumo.itens.veiculo.label, estado: resumo.itens.veiculo.estado },
    { rotulo: "CNH", valor: resumo.itens.cnh.label, estado: resumo.itens.cnh.estado },
  ];

  const borda =
    resumo.estado === "forte" ? "border-l-emerald-500" : resumo.estado === "medio" ? "border-l-amber-500" : "border-l-red-500";

  return (
    <div className={`card p-4 border-l-4 ${borda}`}>
      <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
        <h3 className="font-bold">Requisitos principais</h3>
        <Score pontos={resumo.pontos} />
      </div>
      <ul className="grid gap-2 sm:grid-cols-2">
        {linhas.map((l) => (
          <li key={l.rotulo} className="flex items-center gap-2 text-sm">
            <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-bold text-white ${COR_PONTO[l.estado]}`}>
              {ICONE[l.estado]}
            </span>
            <span className="text-slate-500">{l.rotulo}:</span>
            <span className={`font-medium ${COR_TEXTO[l.estado]}`}>{l.valor}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
