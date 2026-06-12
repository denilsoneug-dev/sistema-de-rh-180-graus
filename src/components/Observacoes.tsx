import { criarObservacao, editarObservacao, apagarObservacao } from "@/app/actions/observacoes";
import { fmtDataHora } from "@/lib/constants";
import { ConfirmSubmit } from "@/components/ConfirmSubmit";

type Obs = {
  id: string;
  texto: string;
  criado_por_nome: string | null;
  criado_em: string;
  editado_em: string | null;
};

export function Observacoes({
  entidadeTipo,
  entidadeId,
  observacoes,
  podeEditar,
  path,
}: {
  entidadeTipo: "ficha" | "candidato" | "equipe";
  entidadeId: string;
  observacoes: Obs[];
  podeEditar: boolean;
  path: string;
}) {
  return (
    <div className="card p-4">
      <h3 className="font-bold mb-3">Observações</h3>
      <div className="space-y-3">
        {observacoes.length === 0 && <p className="text-sm text-gray-400">Nenhuma observação.</p>}
        {observacoes.map((o) => (
          <div key={o.id} className="border-b border-gray-100 pb-3 last:border-0">
            <p className="text-sm whitespace-pre-wrap">{o.texto}</p>
            <div className="flex items-center justify-between mt-1">
              <p className="text-xs text-gray-400">
                {o.criado_por_nome || "—"} · {fmtDataHora(o.criado_em)}
                {o.editado_em && " · editada"}
              </p>
              {podeEditar && (
                <form action={apagarObservacao}>
                  <input type="hidden" name="id" value={o.id} />
                  <input type="hidden" name="path" value={path} />
                  <ConfirmSubmit mensagem="Apagar esta observação?" className="text-xs text-red-400 hover:text-red-600">
                    apagar
                  </ConfirmSubmit>
                </form>
              )}
            </div>
          </div>
        ))}
      </div>
      {podeEditar && (
        <form action={criarObservacao} className="mt-4 space-y-2">
          <input type="hidden" name="entidade_tipo" value={entidadeTipo} />
          <input type="hidden" name="entidade_id" value={entidadeId} />
          <input type="hidden" name="path" value={path} />
          <textarea name="texto" className="input min-h-[60px]" placeholder="Nova observação..." required />
          <button className="btn-secondary text-sm">Adicionar observação</button>
        </form>
      )}
    </div>
  );
}
