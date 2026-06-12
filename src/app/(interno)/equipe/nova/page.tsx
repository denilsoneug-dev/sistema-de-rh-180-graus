import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getPerfil } from "@/lib/auth";
import { cadastrarEquipe } from "@/app/actions/equipe";

export const dynamic = "force-dynamic";

export default async function NovaEquipePage() {
  const perfil = await getPerfil();
  if (perfil?.papel !== "acesso_total") redirect("/equipe");

  const supabase = await createClient();
  const { data: equipe } = await supabase.from("equipe").select("id, nome").in("status", ["ativo", "em_experiencia"]).order("nome");

  return (
    <div className="max-w-2xl space-y-4">
      <h1 className="text-xl font-bold">Cadastrar pessoa na Equipe Atual</h1>
      <p className="text-sm text-gray-500">Cadastro direto, sem processo seletivo. Não gera bônus de indicação.</p>
      <form action={cadastrarEquipe} className="card p-4 space-y-3">
        <div className="grid sm:grid-cols-2 gap-3">
          <div><label className="label">Nome *</label><input name="nome" className="input" required /></div>
          <div><label className="label">CPF *</label><input name="cpf" className="input" required inputMode="numeric" /></div>
          <div><label className="label">Telefone *</label><input name="telefone" className="input" required /></div>
          <div><label className="label">Cargo *</label><input name="cargo" className="input" required /></div>
          <div><label className="label">Salário (R$) *</label><input name="salario" type="number" step="0.01" className="input" required /></div>
          <div><label className="label">Data de entrada *</label><input name="data_entrada" type="date" className="input" required /></div>
          <div>
            <label className="label">Status</label>
            <select name="status" className="input">
              <option value="ativo">Ativo</option>
              <option value="em_experiencia">Em experiência</option>
              <option value="afastado">Afastado</option>
            </select>
          </div>
          <div>
            <label className="label">Quem indicou (opcional)</label>
            <select name="indicado_por" className="input">
              <option value="">Ninguém</option>
              {(equipe || []).map((e) => <option key={e.id} value={e.id}>{e.nome}</option>)}
            </select>
          </div>
        </div>
        <div><label className="label">Observações</label><textarea name="observacoes" className="input min-h-[60px]" /></div>
        <details className="text-sm">
          <summary className="cursor-pointer font-medium">Dados bancários (opcional)</summary>
          <div className="grid sm:grid-cols-2 gap-3 mt-3">
            <div><label className="label">Banco</label><input name="banco" className="input" /></div>
            <div><label className="label">Agência</label><input name="agencia" className="input" /></div>
            <div><label className="label">Conta</label><input name="conta" className="input" /></div>
            <div>
              <label className="label">Tipo de conta</label>
              <select name="tipo_conta" className="input">
                <option value="">Selecione</option>
                <option>Corrente</option>
                <option>Poupança</option>
                <option>Salário</option>
              </select>
            </div>
            <div><label className="label">Nome do titular</label><input name="nome_titular" className="input" /></div>
            <div><label className="label">CPF do titular</label><input name="cpf_titular" className="input" /></div>
          </div>
        </details>
        <button className="btn-primary">Cadastrar</button>
      </form>
    </div>
  );
}
