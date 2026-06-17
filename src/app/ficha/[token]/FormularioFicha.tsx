"use client";

import { useId, useRef, useState } from "react";
import { enviarFichaPublica } from "@/app/actions/ficha-publica";
import { validarCpf, formatarCpf, limparCpf } from "@/lib/cpf";
import { FERRAMENTAS, HORAS_LIVRES, PERGUNTAS_SOBRE_VOCE } from "@/lib/constants";
import { CURRICULO_ACCEPT, validarCurriculoArquivo } from "@/lib/curriculo";
import { Logo } from "@/components/Logo";

const TOTAL_ETAPAS = 7;

type Dados = Record<string, string>;


// Componentes fora do FormularioFicha para não serem recriados a cada render
// (recriar a cada render fazia o input perder o foco a cada letra digitada)
function SimNao({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex gap-2">
      {["sim", "nao"].map((op) => (
        <button key={op} type="button"
          className={`flex-1 rounded-lg border-2 py-3 font-semibold ${value === op ? "border-brand-600 bg-brand-50 text-brand-700" : "border-gray-200 bg-white text-gray-600"}`}
          onClick={() => onChange(op)}>
          {op === "sim" ? "Sim" : "Não"}
        </button>
      ))}
    </div>
  );
}

function Campo({ label, value, onChange, tipo = "text", placeholder = "" }: {
  label: string; value: string; onChange: (v: string) => void; tipo?: string; placeholder?: string;
}) {
  const id = useId();
  return (
    <div>
      <label className="label" htmlFor={id}>{label}</label>
      <input id={id} className="input" type={tipo} placeholder={placeholder} value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

function Area({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  const id = useId();
  return (
    <div>
      <label className="label" htmlFor={id}>{label}</label>
      <textarea id={id} className="input min-h-[80px]" value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

export function FormularioFicha({ token, nome }: { token: string; nome: string }) {
  const [etapa, setEtapa] = useState(1);
  const [d, setD] = useState<Dados>({
    vaga_pretendida: "Assistente de produção",
    nome_completo: nome,
  });
  const [ferramentas, setFerramentas] = useState<string[]>([]);
  const [horasLivres, setHorasLivres] = useState<string[]>([]);
  const [curriculo, setCurriculo] = useState<File | null>(null);
  const curriculoInput = useRef<HTMLInputElement>(null);
  const [erro, setErro] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [enviado, setEnviado] = useState(false);

  const set = (k: string, v: string) => setD((p) => ({ ...p, [k]: v }));
  const v = (k: string) => d[k] || "";

  function toggle(list: string[], setList: (l: string[]) => void, item: string) {
    setList(list.includes(item) ? list.filter((i) => i !== item) : [...list, item]);
  }

  function validarEtapa(): string {
    if (etapa === 1) {
      for (const [k, label] of [["vaga_pretendida","Vaga pretendida"],["nome_completo","Nome completo"],["idade","Idade"],["endereco","Endereço"],["whatsapp","WhatsApp"],["cpf","CPF"],["tamanho_camisa","Tamanho de camisa"],["email","E-mail"],["estado_civil","Estado civil"]] as const) {
        if (!v(k).trim()) return `Preencha: ${label}`;
      }
      if (!validarCpf(v("cpf"))) return "CPF inválido. Confira os números.";
      const idade = parseInt(v("idade"), 10);
      if (!idade || idade < 14 || idade > 99) return "Informe uma idade válida.";
    }
    if (etapa === 2) {
      if (!v("tem_filhos")) return "Responda se tem filhos.";
      if (v("tem_filhos") === "sim" && (!v("quantidade_filhos") || !v("idades_filhos"))) return "Informe quantos filhos e as idades.";
      if (!v("quantidade_pessoas_mora_junto")) return "Informe com quantas pessoas você mora.";
      const quantidadePessoas = Number(v("quantidade_pessoas_mora_junto"));
      if (!Number.isInteger(quantidadePessoas) || quantidadePessoas < 0) return "Informe uma quantidade válida de pessoas.";
      if (quantidadePessoas > 0 && !v("mora_com_quem").trim()) return "Preencha quem são as pessoas que moram com você.";
      if (quantidadePessoas > 0 && !v("emprego_ocupacao_pessoas_mora_junto").trim()) return "Preencha o emprego/ocupação dessas pessoas.";
      if (!v("trabalha_atualmente")) return "Responda se trabalha atualmente.";
      if (v("trabalha_atualmente") === "sim" && !v("cargo_atual").trim()) return "Informe o cargo que exerce.";
    }
    if (etapa === 3) {
      if (!v("disponibilidade_viajar")) return "Responda sobre disponibilidade para viajar.";
      if (v("disponibilidade_viajar") !== "integral" && !v("disponibilidade_viajar_explicacao").trim()) return "Explique sua disponibilidade.";
      if (!v("tem_conhecido_grupo")) return "Responda se tem conhecido no Grupo Eugênio.";
      if (v("tem_conhecido_grupo") === "sim" && (!v("conhecido_nome").trim() || !v("conhecido_relacao").trim())) return "Informe o nome e a relação com a pessoa.";
      if (!v("origem_vaga").trim()) return "Informe onde conheceu a vaga.";
      if (!v("renda_extra")) return "Responda se faz alguma atividade para obter renda extra.";
      if (v("renda_extra") === "sim" && !v("renda_extra_descricao").trim()) return "Informe qual atividade você faz para obter renda extra.";
    }
    if (etapa === 4) {
      if (!v("formacao").trim()) return "Preencha sua formação.";
      if (!v("habilidades_quer_aprender").trim()) return "Preencha quais habilidades gostaria de aprender.";
    }
    if (etapa === 5) {
      if (v("tem_cnh") === "sim" && !v("cnh_categoria").trim()) return "Informe a categoria da CNH.";
      if (ferramentas.includes("Outros") && !v("ferramentas_outros").trim()) return "Informe quais outras ferramentas.";
    }
    if (etapa === 6) {
      for (const p of PERGUNTAS_SOBRE_VOCE) {
        if (!v(`sv_${p.key}`).trim()) return `Preencha: ${p.label}`;
      }
    }
    if (etapa === 7 && !curriculo) return "Anexe seu currículo em PDF, DOC ou DOCX.";
    return "";
  }

  function alterarQuantidadeMoradia(valor: string) {
    if (!/^\d*$/.test(valor)) return;
    setD((anterior) => ({
      ...anterior,
      quantidade_pessoas_mora_junto: valor,
      ...(valor === "0" || valor === "" ? {
        mora_com_quem: "",
        emprego_ocupacao_pessoas_mora_junto: "",
      } : {}),
    }));
  }

  function alterarRendaExtra(valor: string) {
    setD((anterior) => ({
      ...anterior,
      renda_extra: valor,
      ...(valor === "nao" ? { renda_extra_descricao: "" } : {}),
    }));
  }

  function selecionarCurriculo(arquivo: File | null) {
    if (!arquivo) return;
    const erroArquivo = validarCurriculoArquivo(arquivo);
    if (erroArquivo) {
      setCurriculo(null);
      setErro(erroArquivo);
      if (curriculoInput.current) curriculoInput.current.value = "";
      return;
    }
    setCurriculo(arquivo);
    setErro("");
  }

  function removerCurriculo() {
    setCurriculo(null);
    setErro("");
    if (curriculoInput.current) curriculoInput.current.value = "";
  }

  function proxima() {
    const e = validarEtapa();
    if (e) { setErro(e); return; }
    setErro("");
    setEtapa((x) => Math.min(x + 1, TOTAL_ETAPAS));
    window.scrollTo({ top: 0 });
  }

  async function enviar() {
    const erroValidacao = validarEtapa();
    if (erroValidacao) {
      setErro(erroValidacao);
      return;
    }
    setErro("");
    setEnviando(true);
    const fd = new FormData();
    for (const [k, val] of Object.entries(d)) {
      if (k === "renda_extra_descricao" && v("renda_extra") !== "sim") continue;
      if (
        (k === "mora_com_quem" || k === "emprego_ocupacao_pessoas_mora_junto")
        && Number(v("quantidade_pessoas_mora_junto")) === 0
      ) continue;
      fd.set(k, val);
    }
    for (const f of ferramentas) fd.append("ferramentas", f);
    for (const h of horasLivres) fd.append("horas_livres", h);
    if (curriculo) fd.set("curriculo", curriculo);
    const res = await enviarFichaPublica(token, fd);
    if (!res.ok) {
      setErro(res.erro || "Erro ao enviar.");
      setEnviando(false);
      return;
    }
    setEnviado(true);
  }

  if (enviado) {
    return (
      <main className="min-h-screen flex items-center justify-center p-4">
        <div className="card max-w-md w-full p-8 text-center animate-scale-in">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-100 text-3xl">✅</div>
          <h1 className="font-display text-xl font-extrabold mb-2 text-slate-900">Ficha enviada!</h1>
          <p className="text-slate-600">Obrigado, {v("nome_completo").split(" ")[0]}. O recrutamento do 180graus recebeu sua ficha e vai entrar em contato.</p>
          <div className="mt-5 flex justify-center"><Logo size={34} /></div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen pb-10">
      <div className="glass border-b border-slate-200/70 sticky top-0 z-10">
        <div className="max-w-lg mx-auto px-4 py-3">
          <div className="flex items-center justify-between mb-2.5">
            <Logo size={34} showWordmark={false} />
            <div className="text-right leading-tight">
              <span className="block font-display text-sm font-bold text-brand-800">Ficha Cadastral</span>
              <span className="text-xs text-slate-500">Etapa {etapa} de {TOTAL_ETAPAS}</span>
            </div>
          </div>
          <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{ width: `${(etapa / TOTAL_ETAPAS) * 100}%`, backgroundImage: "linear-gradient(90deg,#2d7bf0,#1a66dc,#f97316)" }}
            />
          </div>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 py-6 space-y-4">
        {etapa === 1 && (
          <>
            <h2 className="text-lg font-bold">Dados pessoais e vaga</h2>
            <Campo label="Vaga pretendida"  value={v("vaga_pretendida")} onChange={(x) => set("vaga_pretendida", x)} />
            <Campo label="Nome completo"  value={v("nome_completo")} onChange={(x) => set("nome_completo", x)} />
            <Campo label="Idade" tipo="number"  value={v("idade")} onChange={(x) => set("idade", x)} />
            <Campo label="Endereço"  value={v("endereco")} onChange={(x) => set("endereco", x)} />
            <Campo label="WhatsApp" tipo="tel" placeholder="(00) 00000-0000"  value={v("whatsapp")} onChange={(x) => set("whatsapp", x)} />
            <div>
              <label className="label">CPF</label>
              <input className="input" inputMode="numeric" placeholder="000.000.000-00"
                value={formatarCpf(v("cpf")) || v("cpf")}
                onChange={(e) => set("cpf", limparCpf(e.target.value))} />
              {v("cpf").length === 11 && !validarCpf(v("cpf")) && (
                <p className="text-sm text-red-600 mt-1">CPF inválido</p>
              )}
            </div>
            <div>
              <label className="label">Tamanho de camisa</label>
              <select className="input" value={v("tamanho_camisa")} onChange={(e) => set("tamanho_camisa", e.target.value)}>
                <option value="">Selecione</option>
                {["PP","P","M","G","GG","XG"].map((t) => <option key={t}>{t}</option>)}
              </select>
            </div>
            <Campo label="E-mail" tipo="email"  value={v("email")} onChange={(x) => set("email", x)} />
            <Campo label="Instagram (opcional)" placeholder="@seuperfil"  value={v("instagram")} onChange={(x) => set("instagram", x)} />
            <div>
              <label className="label">Estado civil</label>
              <select className="input" value={v("estado_civil")} onChange={(e) => set("estado_civil", e.target.value)}>
                <option value="">Selecione</option>
                {["Solteiro(a)","Casado(a)","União estável","Divorciado(a)","Viúvo(a)"].map((t) => <option key={t}>{t}</option>)}
              </select>
            </div>
          </>
        )}

        {etapa === 2 && (
          <>
            <h2 className="text-lg font-bold">Família, moradia e trabalho atual</h2>
            <div>
              <label className="label" htmlFor="quantidade-pessoas-moradia">Você mora com quantas pessoas, tirando você?</label>
              <input
                id="quantidade-pessoas-moradia"
                className="input"
                type="number"
                inputMode="numeric"
                min="0"
                step="1"
                required
                value={v("quantidade_pessoas_mora_junto")}
                onChange={(e) => alterarQuantidadeMoradia(e.target.value)}
              />
            </div>
            {Number(v("quantidade_pessoas_mora_junto")) > 0 && (
              <div className="conditional-field space-y-4 border-l-2 border-brand-200 pl-3">
                <Campo label="Quem são essas pessoas?" value={v("mora_com_quem")} onChange={(x) => set("mora_com_quem", x)} />
                <Campo label="Qual o emprego/ocupação dessas pessoas?" value={v("emprego_ocupacao_pessoas_mora_junto")} onChange={(x) => set("emprego_ocupacao_pessoas_mora_junto", x)} />
              </div>
            )}
            <div>
              <label className="label">Tem filhos?</label>
              <SimNao value={v("tem_filhos")} onChange={(x) => set("tem_filhos", x)} />
            </div>
            {v("tem_filhos") === "sim" && (
              <>
                <Campo label="Quantos filhos?" tipo="number"  value={v("quantidade_filhos")} onChange={(x) => set("quantidade_filhos", x)} />
                <Campo label="Idade(s) dos filhos" placeholder="Ex.: 3 e 7 anos"  value={v("idades_filhos")} onChange={(x) => set("idades_filhos", x)} />
              </>
            )}
            <div>
              <label className="label">Trabalha atualmente?</label>
              <SimNao value={v("trabalha_atualmente")} onChange={(x) => set("trabalha_atualmente", x)} />
            </div>
            {v("trabalha_atualmente") === "sim" && <Campo label="Cargo que exerce"  value={v("cargo_atual")} onChange={(x) => set("cargo_atual", x)} />}
          </>
        )}

        {etapa === 3 && (
          <>
            <h2 className="text-lg font-bold">Disponibilidade e informações adicionais</h2>
            <div>
              <label className="label">Disponibilidade para viajar a trabalho?</label>
              <div className="space-y-2">
                {[["integral","Integral"],["parcial","Parcial"],["nao_tenho","Não tenho disponibilidade"]].map(([val, label]) => (
                  <button key={val} type="button"
                    className={`w-full rounded-lg border-2 py-3 font-semibold ${v("disponibilidade_viajar") === val ? "border-brand-600 bg-brand-50 text-brand-700" : "border-gray-200 bg-white text-gray-600"}`}
                    onClick={() => set("disponibilidade_viajar", val)}>
                    {label}
                  </button>
                ))}
              </div>
            </div>
            {(v("disponibilidade_viajar") === "parcial" || v("disponibilidade_viajar") === "nao_tenho") && (
              <Area label="Explique sua disponibilidade" value={v("disponibilidade_viajar_explicacao")} onChange={(x) => set("disponibilidade_viajar_explicacao", x)} />
            )}
            <div>
              <label className="label">Você tem algum parente ou conhecido no Grupo Eugênio?</label>
              <SimNao value={v("tem_conhecido_grupo")} onChange={(x) => set("tem_conhecido_grupo", x)} />
            </div>
            {v("tem_conhecido_grupo") === "sim" && (
              <>
                <Campo label="Nome da pessoa"  value={v("conhecido_nome")} onChange={(x) => set("conhecido_nome", x)} />
                <Campo label="Relação com a pessoa" placeholder="Ex.: amigo, primo, vizinho"  value={v("conhecido_relacao")} onChange={(x) => set("conhecido_relacao", x)} />
              </>
            )}
            <Campo label="Onde você teve conhecimento dessa vaga?"  value={v("origem_vaga")} onChange={(x) => set("origem_vaga", x)} />
            <div>
              <label className="label">Faz alguma atividade para obter renda extra?</label>
              <SimNao value={v("renda_extra")} onChange={alterarRendaExtra} />
            </div>
            {v("renda_extra") === "sim" && (
              <div className="conditional-field border-l-2 border-brand-200 pl-3">
                <Area label="Qual atividade você faz para obter renda extra?" value={v("renda_extra_descricao")} onChange={(x) => set("renda_extra_descricao", x)} />
              </div>
            )}
          </>
        )}

        {etapa === 4 && (
          <>
            <h2 className="text-lg font-bold">Escolaridade</h2>
            <Area label="Formação" value={v("formacao")} onChange={(x) => set("formacao", x)} />
            <Area label="Quais outras habilidades gostaria de aprender?" value={v("habilidades_quer_aprender")} onChange={(x) => set("habilidades_quer_aprender", x)} />
          </>
        )}

        {etapa === 5 && (
          <>
            <h2 className="text-lg font-bold">Habilidades, equipamentos e ferramentas</h2>
            <p className="text-sm text-gray-500">Marque o que você possui:</p>
            <div className="space-y-2">
              {[["moto_propria","Moto própria"],["carro_proprio","Carro próprio"],["notebook_proprio","Notebook próprio"],["internet_casa","Internet em casa"],["celular_android","Celular Android"],["celular_ios","Celular iOS"],["tem_cnh","CNH"]].map(([campo, label]) => (
                <button key={campo} type="button"
                  className={`w-full rounded-lg border-2 py-3 px-4 text-left font-medium flex justify-between ${v(campo) === "sim" ? "border-brand-600 bg-brand-50 text-brand-700" : "border-gray-200 bg-white text-gray-600"}`}
                  onClick={() => set(campo, v(campo) === "sim" ? "" : "sim")}>
                  {label} <span>{v(campo) === "sim" ? "✓" : ""}</span>
                </button>
              ))}
            </div>
            {v("tem_cnh") === "sim" && (
              <div>
                <label className="label">Categoria da CNH</label>
                <select className="input" value={v("cnh_categoria")} onChange={(e) => set("cnh_categoria", e.target.value)}>
                  <option value="">Selecione</option>
                  {["A","B","AB","C","D","E"].map((c) => <option key={c}>{c}</option>)}
                </select>
              </div>
            )}
            <p className="text-sm text-gray-500 pt-2">Ferramentas que você utiliza bem:</p>
            <div className="grid grid-cols-2 gap-2">
              {FERRAMENTAS.map((f) => (
                <button key={f} type="button"
                  className={`rounded-lg border-2 py-2.5 px-3 text-sm font-medium text-left ${ferramentas.includes(f) ? "border-brand-600 bg-brand-50 text-brand-700" : "border-gray-200 bg-white text-gray-600"}`}
                  onClick={() => toggle(ferramentas, setFerramentas, f)}>
                  {f}
                </button>
              ))}
            </div>
            {ferramentas.includes("Outros") && <Campo label="Quais outros?"  value={v("ferramentas_outros")} onChange={(x) => set("ferramentas_outros", x)} />}
          </>
        )}

        {etapa === 6 && (
          <>
            <h2 className="text-lg font-bold">Sobre você</h2>
            <div>
              <label className="label">Nas horas livres eu gosto de:</label>
              <div className="space-y-2">
                {HORAS_LIVRES.map((h) => (
                  <button key={h} type="button"
                    className={`w-full rounded-lg border-2 py-2.5 px-3 text-sm font-medium text-left ${horasLivres.includes(h) ? "border-brand-600 bg-brand-50 text-brand-700" : "border-gray-200 bg-white text-gray-600"}`}
                    onClick={() => toggle(horasLivres, setHorasLivres, h)}>
                    {h}
                  </button>
                ))}
              </div>
            </div>
            {PERGUNTAS_SOBRE_VOCE.map((p) => (
              <Area key={p.key} label={p.label} value={v(`sv_${p.key}`)} onChange={(x) => set(`sv_${p.key}`, x)} />
            ))}
          </>
        )}

        {etapa === 7 && (
          <>
            <h2 className="text-lg font-bold">Currículo e revisão final</h2>
            <div className="card p-4 border-brand-200 bg-brand-50/50">
              <label className="label font-semibold" htmlFor="curriculo">Anexe seu currículo</label>
              <p className="text-sm text-gray-600 mb-3">Arquivo obrigatório em PDF, DOC ou DOCX, com até 10MB.</p>
              <input
                ref={curriculoInput}
                id="curriculo"
                type="file"
                accept={CURRICULO_ACCEPT}
                className="sr-only"
                onChange={(e) => selecionarCurriculo(e.target.files?.[0] || null)}
              />
              <div className="flex flex-col sm:flex-row gap-2">
                <label htmlFor="curriculo" className="btn-secondary cursor-pointer text-center">
                  {curriculo ? "Substituir arquivo" : "Selecionar arquivo"}
                </label>
                {curriculo && (
                  <button type="button" className="btn-secondary" onClick={removerCurriculo}>Remover arquivo</button>
                )}
              </div>
              {curriculo && (
                <p className="text-sm text-green-700 mt-3 break-all" aria-live="polite">✓ {curriculo.name}</p>
              )}
            </div>
            <div className="card p-4 text-sm space-y-1">
              <p className="font-semibold mb-2">Confira seus dados:</p>
              <p><span className="text-gray-500">Nome:</span> {v("nome_completo")}</p>
              <p><span className="text-gray-500">Vaga:</span> {v("vaga_pretendida")}</p>
              <p><span className="text-gray-500">CPF:</span> {formatarCpf(v("cpf"))}</p>
              <p><span className="text-gray-500">WhatsApp:</span> {v("whatsapp")}</p>
              <p><span className="text-gray-500">E-mail:</span> {v("email")}</p>
              <p><span className="text-gray-500">Currículo:</span> {curriculo ? "Anexado" : "Não anexado"}</p>
            </div>
          </>
        )}

        {erro && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg p-3">{erro}</p>}

        <div className="flex gap-2 pt-2">
          {etapa > 1 && (
            <button type="button" className="btn-secondary flex-1" onClick={() => { setErro(""); setEtapa(etapa - 1); window.scrollTo({ top: 0 }); }}>
              Voltar
            </button>
          )}
          {etapa < TOTAL_ETAPAS ? (
            <button type="button" className="btn-primary flex-1" onClick={proxima}>Continuar</button>
          ) : (
            <button type="button" className="btn-primary flex-1" disabled={enviando} onClick={enviar}>
              {enviando ? "Enviando..." : "Enviar ficha"}
            </button>
          )}
        </div>
      </div>
    </main>
  );
}
