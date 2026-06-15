import type { RequisitosOverride } from "@/lib/constants";

type ValoresOverride = NonNullable<RequisitosOverride>;

function triValue(v: boolean | null | undefined): string {
  return v === true ? "sim" : v === false ? "nao" : "";
}

// Formulário de edição manual dos requisitos (somente acesso total).
// Campos em "Usar da ficha" ("") gravam NULL -> o sistema volta a derivar da ficha.
export function EditarRequisitos({
  action,
  valores,
}: {
  action: (formData: FormData) => void | Promise<void>;
  valores: ValoresOverride;
}) {
  return (
    <details className="card p-4">
      <summary className="cursor-pointer font-bold">Editar requisitos (manual)</summary>
      <p className="mt-1 text-xs text-slate-500">
        Deixe em “Usar da ficha” para manter o valor original. O que for definido aqui passa a valer no sistema.
      </p>
      <form action={action} className="mt-3 grid gap-3 sm:grid-cols-2">
        <div>
          <label className="label">Disponibilidade para viajar</label>
          <select name="req_disponibilidade" defaultValue={valores.req_disponibilidade ?? ""} className="input">
            <option value="">Usar da ficha</option>
            <option value="integral">Integral</option>
            <option value="parcial">Parcial</option>
            <option value="nao_tenho">Não tem</option>
          </select>
        </div>
        <div>
          <label className="label">Notebook próprio</label>
          <select name="req_notebook" defaultValue={triValue(valores.req_notebook)} className="input">
            <option value="">Usar da ficha</option>
            <option value="sim">Sim</option>
            <option value="nao">Não</option>
          </select>
        </div>
        <div>
          <label className="label">Veículo próprio</label>
          <select name="req_veiculo" defaultValue={triValue(valores.req_veiculo)} className="input">
            <option value="">Usar da ficha</option>
            <option value="sim">Sim</option>
            <option value="nao">Não</option>
          </select>
        </div>
        <div>
          <label className="label">CNH</label>
          <select name="req_cnh" defaultValue={triValue(valores.req_cnh)} className="input">
            <option value="">Usar da ficha</option>
            <option value="sim">Sim</option>
            <option value="nao">Não</option>
          </select>
        </div>
        <div className="sm:col-span-2">
          <label className="label">Categoria da CNH (opcional)</label>
          <input name="req_cnh_categoria" defaultValue={valores.req_cnh_categoria ?? ""} className="input" placeholder="Ex.: B" />
        </div>
        <div className="sm:col-span-2">
          <button className="btn-primary w-full sm:w-auto">Salvar requisitos</button>
        </div>
      </form>
    </details>
  );
}
