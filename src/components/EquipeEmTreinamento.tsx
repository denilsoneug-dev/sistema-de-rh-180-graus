import Link from "next/link";
import { cpfPorPapel, formatarTelefone } from "@/lib/cpf";
import { fmtData, type ResumoRequisitos as ResumoTipo } from "@/lib/constants";
import { ResumoRequisitos } from "@/components/ResumoRequisitos";

export type PessoaEmTreinamento = {
  id: string;
  nome: string;
  cpf: string | null;
  telefone: string | null;
  vaga_pretendida: string | null;
  inicio_treinamento: string | null;
  indicador_nome: string | null;
  resumo: ResumoTipo | null;
};

export function EquipeEmTreinamento({
  pessoas,
  acessoTotal,
}: {
  pessoas: PessoaEmTreinamento[];
  acessoTotal: boolean;
}) {
  if (pessoas.length === 0) {
    return <p className="text-gray-400 text-sm py-8 text-center">Ninguém neste status.</p>;
  }

  return (
    <div className="space-y-3">
      {pessoas.map((pessoa) => (
        <article key={pessoa.id} data-testid="treinamento-card" className="card p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <p className="font-semibold break-words">{pessoa.nome}</p>
              <p className="text-sm text-gray-500 break-words">
                {pessoa.vaga_pretendida || "Cargo não informado"} · CPF {cpfPorPapel(pessoa.cpf, acessoTotal)}
              </p>
              <p className="text-sm text-gray-500">{formatarTelefone(pessoa.telefone) || "Telefone não informado"}</p>
            </div>
            <div className="sm:text-right text-sm shrink-0">
              <span className="badge bg-blue-100 text-blue-800">Em treinamento</span>
              <p className="text-gray-400 mt-1">Início {fmtData(pessoa.inicio_treinamento)}</p>
            </div>
          </div>

          <div className="mt-3 border-t border-slate-100 pt-3 space-y-3">
            <p className="text-sm text-gray-600 break-words">
              <span className="font-medium text-gray-700">Quem indicou:</span>{" "}
              {pessoa.indicador_nome || "Sem indicação informada"}
            </p>
            <ResumoRequisitos variante="compacto" resumo={pessoa.resumo} />
            <Link href={`/candidatos/${pessoa.id}`} className="btn-secondary inline-flex w-full justify-center sm:w-auto">
              Ver detalhes
            </Link>
          </div>
        </article>
      ))}
    </div>
  );
}
