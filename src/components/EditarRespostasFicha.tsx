"use client";

import { FERRAMENTAS, HORAS_LIVRES, PERGUNTAS_SOBRE_VOCE } from "@/lib/constants";

type Respostas = Record<string, unknown> | null | undefined;

function txt(r: Respostas, k: string): string {
  const v = r?.[k];
  return v == null ? "" : String(v);
}
function boolSel(r: Respostas, k: string): string {
  const v = r?.[k];
  return v === true ? "sim" : v === false ? "nao" : "";
}
function arr(r: Respostas, k: string): string[] {
  const v = r?.[k];
  return Array.isArray(v) ? v.map(String) : [];
}

const BOOLS: { name: string; label: string }[] = [
  { name: "trabalha_atualmente", label: "Trabalha atualmente" },
  { name: "notebook_proprio", label: "Notebook próprio" },
  { name: "moto_propria", label: "Moto própria" },
  { name: "carro_proprio", label: "Carro próprio" },
  { name: "tem_cnh", label: "Tem CNH" },
  { name: "internet_casa", label: "Internet em casa" },
  { name: "celular_android", label: "Celular Android" },
  { name: "celular_ios", label: "Celular iOS" },
];

// Edição completa das respostas da ficha — somente acesso total.
export function EditarRespostasFicha({
  action,
  respostas,
}: {
  action: (formData: FormData) => void | Promise<void>;
  respostas: Respostas;
}) {
  const r = respostas;
  const sv = (r?.respostas_sobre_voce_json as Record<string, string>) || {};
  const ferramentas = arr(r, "ferramentas_json");
  const horas = arr(r, "horas_livres_json");

  return (
    <details className="card p-4">
      <summary className="cursor-pointer font-bold">Editar respostas da ficha</summary>
      <p className="mt-1 text-xs text-slate-500">Edição completa das respostas (somente acesso total). As alterações ficam registradas no histórico.</p>
      <form action={action} className="mt-3 space-y-5">
        {/* Dados pessoais */}
        <fieldset className="space-y-3">
          <legend className="text-sm font-semibold text-slate-700">Dados pessoais</legend>
          <div className="grid gap-3 sm:grid-cols-2">
            <div><label className="label">Nome completo</label><input name="nome_completo" defaultValue={txt(r, "nome_completo")} className="input" /></div>
            <div><label className="label">Vaga pretendida</label><input name="vaga_pretendida" defaultValue={txt(r, "vaga_pretendida")} className="input" /></div>
            <div><label className="label">Idade</label><input name="idade" type="number" defaultValue={txt(r, "idade")} className="input" /></div>
            <div><label className="label">CPF</label><input name="cpf" defaultValue={txt(r, "cpf")} className="input" /></div>
            <div><label className="label">Telefone (WhatsApp)</label><input name="whatsapp" defaultValue={txt(r, "whatsapp")} className="input" /></div>
            <div><label className="label">E-mail</label><input name="email" defaultValue={txt(r, "email")} className="input" /></div>
            <div><label className="label">Instagram</label><input name="instagram" defaultValue={txt(r, "instagram")} className="input" /></div>
            <div><label className="label">Estado civil</label><input name="estado_civil" defaultValue={txt(r, "estado_civil")} className="input" /></div>
            <div><label className="label">Tamanho da camisa</label><input name="tamanho_camisa" defaultValue={txt(r, "tamanho_camisa")} className="input" /></div>
            <div className="sm:col-span-2"><label className="label">Endereço</label><input name="endereco" defaultValue={txt(r, "endereco")} className="input" /></div>
          </div>
        </fieldset>

        {/* Moradia */}
        <fieldset className="space-y-3">
          <legend className="text-sm font-semibold text-slate-700">Moradia</legend>
          <div className="grid gap-3 sm:grid-cols-2">
            <div><label className="label">Qtd. de pessoas em casa</label><input name="quantidade_pessoas_mora_junto" type="number" defaultValue={txt(r, "quantidade_pessoas_mora_junto")} className="input" /></div>
            <div><label className="label">Quem são</label><input name="mora_com_quem" defaultValue={txt(r, "mora_com_quem")} className="input" /></div>
            <div className="sm:col-span-2"><label className="label">Emprego/ocupação de quem mora junto</label><input name="emprego_ocupacao_pessoas_mora_junto" defaultValue={txt(r, "emprego_ocupacao_pessoas_mora_junto")} className="input" /></div>
          </div>
        </fieldset>

        {/* Disponibilidade e renda */}
        <fieldset className="space-y-3">
          <legend className="text-sm font-semibold text-slate-700">Disponibilidade e renda</legend>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="label">Disponibilidade para viajar</label>
              <select name="disponibilidade_viajar" defaultValue={txt(r, "disponibilidade_viajar")} className="input">
                <option value="integral">Integral</option>
                <option value="parcial">Parcial</option>
                <option value="nao_tenho">Não tem</option>
              </select>
            </div>
            <div><label className="label">Cargo atual</label><input name="cargo_atual" defaultValue={txt(r, "cargo_atual")} className="input" /></div>
            <div className="sm:col-span-2"><label className="label">Explicação da disponibilidade</label><input name="disponibilidade_viajar_explicacao" defaultValue={txt(r, "disponibilidade_viajar_explicacao")} className="input" /></div>
            <div>
              <label className="label">Renda extra</label>
              <select name="renda_extra" defaultValue={txt(r, "renda_extra")} className="input">
                <option value="">—</option>
                <option value="sim">Sim</option>
                <option value="nao">Não</option>
              </select>
            </div>
            <div><label className="label">Atividade de renda extra</label><input name="renda_extra_descricao" defaultValue={txt(r, "renda_extra_descricao")} className="input" /></div>
          </div>
        </fieldset>

        {/* Recursos / requisitos */}
        <fieldset className="space-y-3">
          <legend className="text-sm font-semibold text-slate-700">Recursos e requisitos</legend>
          <div className="grid gap-3 sm:grid-cols-2">
            {BOOLS.map((b) => (
              <div key={b.name}>
                <label className="label">{b.label}</label>
                <select name={b.name} defaultValue={boolSel(r, b.name)} className="input">
                  <option value="">—</option>
                  <option value="sim">Sim</option>
                  <option value="nao">Não</option>
                </select>
              </div>
            ))}
            <div className="sm:col-span-2"><label className="label">Categoria da CNH</label><input name="cnh_categoria" defaultValue={txt(r, "cnh_categoria")} className="input" placeholder="Ex.: B" /></div>
          </div>
        </fieldset>

        {/* Formação */}
        <fieldset className="space-y-3">
          <legend className="text-sm font-semibold text-slate-700">Formação e ferramentas</legend>
          <div><label className="label">Formação</label><input name="formacao" defaultValue={txt(r, "formacao")} className="input" /></div>
          <div><label className="label">Habilidades que quer aprender</label><input name="habilidades_quer_aprender" defaultValue={txt(r, "habilidades_quer_aprender")} className="input" /></div>
          <div>
            <label className="label">Ferramentas que domina</label>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {FERRAMENTAS.map((f) => (
                <label key={f} className="flex items-center gap-2 text-sm">
                  <input type="checkbox" name="ferramentas" value={f} defaultChecked={ferramentas.includes(f)} /> {f}
                </label>
              ))}
            </div>
          </div>
          <div><label className="label">Outras ferramentas</label><input name="ferramentas_outros" defaultValue={txt(r, "ferramentas_outros")} className="input" /></div>
          <div>
            <label className="label">O que faz nas horas livres</label>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {HORAS_LIVRES.map((h) => (
                <label key={h} className="flex items-center gap-2 text-sm">
                  <input type="checkbox" name="horas_livres" value={h} defaultChecked={horas.includes(h)} /> {h}
                </label>
              ))}
            </div>
          </div>
        </fieldset>

        {/* Respostas abertas */}
        <fieldset className="space-y-3">
          <legend className="text-sm font-semibold text-slate-700">Respostas abertas</legend>
          {PERGUNTAS_SOBRE_VOCE.map((p) => (
            <div key={p.key}>
              <label className="label">{p.label}</label>
              <textarea name={`sv_${p.key}`} defaultValue={sv[p.key] || ""} className="input min-h-[48px]" />
            </div>
          ))}
        </fieldset>

        <button className="btn-primary w-full sm:w-auto">Salvar respostas</button>
      </form>
    </details>
  );
}
