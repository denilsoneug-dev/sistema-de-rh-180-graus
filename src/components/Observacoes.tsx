import { criarObservacao, editarObservacao, apagarObservacao } from "@/app/actions/observacoes";
import { fmtDataHora } from "@/lib/constants";
import { ConfirmInline } from "@/components/ConfirmInline";

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
                <div className="flex items-center gap-3">
                  <details>
                    <summary className="cursor-pointer text-xs text-brand-700">editar</summary>
                    <form action={editarObservacao} className="mt-2 space-y-2 min-w-[240px] sm:min-w-[360px]">
                      <input type="hidden" name="id" value={o.id} />
                      <input type="hidden" name="path" value={path} />
                      <textarea name="texto" className="input min-h-[70px]" defaultValue={o.texto} required />
                      <button className="btn-secondary text-xs w-full sm:w-auto">Salvar edição</button>
                    </form>
                  </details>
                  <form action={apagarObservacao}>
                    <input type="hidden" name="id" value={o.id} />
                    <input type="hidden" name="path" value={path} />
                    <ConfirmInline />
                  </form>
                </div>
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
          <button className="btn-secondary text-sm w-full sm:w-auto">Adicionar observação</button>
        </form>
      )}
    </div>
  );
}
