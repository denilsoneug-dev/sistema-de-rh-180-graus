import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getPerfil } from "@/lib/auth";
import { formatarCpf, formatarTelefone } from "@/lib/cpf";
import { STATUS_EQUIPE_LABELS, fmtData } from "@/lib/constants";

export const dynamic = "force-dynamic";

const TABS = [
  { key: "ativos", label: "Ativos" },
  { key: "em_experiencia", label: "Em experiência" },
  { key: "afastado", label: "Afastados" },
  { key: "desligado", label: "Desligados" },
] as const;

export default async function EquipePage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const { tab = "ativos" } = await searchParams;
  const perfil = await getPerfil();
  const supabase = await createClient();

  let query = supabase.from("equipe").select("*").order("nome");
  query = tab === "ativos" ? query.eq("status", "ativo") : query.eq("status", tab);
  const { data: membros } = await query;

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
                <p className="text-sm text-gray-500">{m.cargo} · CPF {formatarCpf(m.cpf)} · {formatarTelefone(m.telefone)}</p>
              </div>
              <div className="text-right text-sm">
                <span className="badge bg-gray-100 text-gray-700">{STATUS_EQUIPE_LABELS[m.status as string]}</span>
                <p className="text-gray-400 mt-1">Entrada {fmtData(m.data_entrada)}</p>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
