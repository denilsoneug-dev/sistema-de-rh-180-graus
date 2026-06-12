import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getPerfil } from "@/lib/auth";
import { criarFichaPendente } from "@/app/actions/fichas";
import { formatarCpf } from "@/lib/cpf";
import { requisitosPrincipais, diasDesde, fmtData, STATUS_FICHA_LABELS } from "@/lib/constants";

export const dynamic = "force-dynamic";

const TABS = [
  { key: "pendente", label: "Pendentes" },
  { key: "recebida", label: "Recebidas" },
  { key: "arquivada", label: "Arquivadas" },
  { key: "rejeitada", label: "Rejeitadas" },
  { key: "expirada", label: "Expiradas" },
] as const;

export default async function FichasPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const { tab = "pendente" } = await searchParams;
  const perfil = await getPerfil();
  const acessoTotal = perfil?.papel === "acesso_total";
  const supabase = await createClient();

  const { data: fichas } = await supabase
    .from("fichas")
    .select("*, ficha_respostas(*)")
    .eq("status", tab)
    .order("criado_em", { ascending: false });

  // CPFs rejeitados anteriormente (para alertas)
  const { data: rejeitadas } = await supabase
    .from("fichas").select("cpf").eq("status", "rejeitada").not("cpf", "is", null);
  const cpfsRejeitados = new Set((rejeitadas || []).map((r) => r.cpf));

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <h1 className="text-xl font-bold">Fichas</h1>
        {acessoTotal && (
          <form action={criarFichaPendente} className="flex w-full sm:w-auto gap-2">
            <input name="nome" className="input !w-auto min-w-0 flex-1 sm:!w-56" placeholder="Nome do candidato" required />
            <button className="btn-primary whitespace-nowrap">Criar link de ficha</button>
          </form>
        )}
      </div>

      <div className="flex gap-1 overflow-x-auto border-b border-gray-200">
        {TABS.map((t) => (
          <Link key={t.key} href={`/fichas?tab=${t.key}`}
            className={`px-4 py-2 text-sm font-medium border-b-2 whitespace-nowrap ${tab === t.key ? "border-brand-600 text-brand-700" : "border-transparent text-gray-500"}`}>
            {t.label}
          </Link>
        ))}
      </div>

      <div className="space-y-3">
        {(fichas || []).length === 0 && (
          <p className="text-gray-400 text-sm py-8 text-center">Nenhuma ficha em {STATUS_FICHA_LABELS[tab]?.toLowerCase()}.</p>
        )}
        {(fichas || []).map((f) => {
          const r = Array.isArray(f.ficha_respostas) ? f.ficha_respostas[0] : f.ficha_respostas;
          const req = r ? requisitosPrincipais(r) : null;
          const cpfAlerta = f.cpf && cpfsRejeitados.has(f.cpf) && tab === "recebida";
          return (
            <Link key={f.id} href={`/fichas/${f.id}`} className="card p-4 block hover:border-brand-300">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div>
                  <p className="font-semibold">{r?.nome_completo || f.nome_inicial}</p>
                  <p className="text-sm text-gray-500">
                    {r ? `CPF ${formatarCpf(r.cpf)} · ${r.vaga_pretendida}` : "Aguardando preenchimento"}
                  </p>
                  {r && <p className="text-sm text-gray-500">WhatsApp: {r.whatsapp}</p>}
                </div>
                <div className="text-right text-sm space-y-1">
                  {req && (
                    <span className={`badge ${req.pontos >= 3 ? "bg-green-100 text-green-800" : req.pontos >= 2 ? "bg-yellow-100 text-yellow-800" : "bg-gray-100 text-gray-600"}`}>
                      Requisitos: {req.pontos}/4
                    </span>
                  )}
                  {tab === "recebida" && (
                    <p className={f.curriculo_url ? "text-green-600" : "text-red-500"}>
                      {f.curriculo_url ? "Com currículo" : "Sem currículo"}
                    </p>
                  )}
                  {f.ficha_enviada_em && (
                    <p className="text-gray-400">Enviada {fmtData(f.ficha_enviada_em)} · há {diasDesde(f.ficha_enviada_em)}d</p>
                  )}
                  {tab === "pendente" && f.link_expira_em && (
                    <p className="text-gray-400">Link expira {fmtData(f.link_expira_em)}</p>
                  )}
                </div>
              </div>
              {cpfAlerta && (
                <p className="mt-2 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-1.5">
                  ⚠️ Atenção: este CPF já teve uma ficha rejeitada anteriormente.
                </p>
              )}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
