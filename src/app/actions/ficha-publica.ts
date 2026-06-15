"use server";

import { createHash } from "crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { logAudit } from "@/lib/audit";
import { limparCpf, validarCpf, limparTelefone } from "@/lib/cpf";
import { extensaoCurriculo, validarCurriculoArquivo } from "@/lib/curriculo";

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export type FichaPublica = {
  ok: boolean;
  motivo?: "nao_encontrada" | "expirada" | "ja_enviada";
  fichaId?: string;
  nome?: string;
};

export async function buscarFichaPorToken(token: string): Promise<FichaPublica> {
  if (!token || token.length < 32) return { ok: false, motivo: "nao_encontrada" };
  const admin = createAdminClient();
  const { data: ficha } = await admin
    .from("fichas")
    .select("id, nome_inicial, status, link_expira_em, ficha_enviada_em")
    .eq("token_atual_hash", hashToken(token))
    .single();
  if (!ficha) return { ok: false, motivo: "nao_encontrada" };
  if (ficha.status === "recebida" || ficha.status === "selecionada" || ficha.ficha_enviada_em)
    return { ok: false, motivo: "ja_enviada" };
  if (ficha.status !== "pendente") return { ok: false, motivo: "nao_encontrada" };
  if (ficha.link_expira_em && new Date(ficha.link_expira_em) < new Date()) {
    await admin.from("fichas").update({ status: "expirada" }).eq("id", ficha.id);
    return { ok: false, motivo: "expirada" };
  }
  return { ok: true, fichaId: ficha.id, nome: ficha.nome_inicial };
}

export async function enviarFichaPublica(token: string, formData: FormData): Promise<{ ok: boolean; erro?: string }> {
  const admin = createAdminClient();
  const { data: ficha } = await admin
    .from("fichas")
    .select("id, status, link_expira_em, ficha_enviada_em")
    .eq("token_atual_hash", hashToken(token))
    .single();

  if (!ficha) return { ok: false, erro: "Link inválido." };
  if (ficha.ficha_enviada_em || ficha.status !== "pendente")
    return { ok: false, erro: "Esta ficha já foi enviada." };
  if (ficha.link_expira_em && new Date(ficha.link_expira_em) < new Date()) {
    await admin.from("fichas").update({ status: "expirada" }).eq("id", ficha.id);
    return { ok: false, erro: "Este link expirou. Peça um novo link ao recrutamento." };
  }

  const cpf = limparCpf(String(formData.get("cpf") || ""));
  if (!validarCpf(cpf)) return { ok: false, erro: "CPF inválido. Confira os números digitados." };

  const get = (k: string) => String(formData.get(k) || "").trim();
  const getBool = (k: string) => formData.get(k) === "sim" || formData.get(k) === "on";
  const getArr = (k: string) => formData.getAll(k).map(String);

  const temFilhos = get("tem_filhos") === "sim";
  const trabalha = get("trabalha_atualmente") === "sim";
  const temConhecido = get("tem_conhecido_grupo") === "sim";
  const dispViajar = get("disponibilidade_viajar");
  const temCnh = getBool("tem_cnh");
  const ferramentas = getArr("ferramentas");
  const rendaExtra = get("renda_extra");
  const rendaExtraDescricao = get("renda_extra_descricao");
  const quantidadeMoradiaTexto = get("quantidade_pessoas_mora_junto");
  const quantidadeMoradia = Number(quantidadeMoradiaTexto);
  const moraComQuem = get("mora_com_quem");
  const ocupacaoMoradia = get("emprego_ocupacao_pessoas_mora_junto");

  if (!quantidadeMoradiaTexto || !Number.isInteger(quantidadeMoradia) || quantidadeMoradia < 0) {
    return { ok: false, erro: "Informe uma quantidade válida de pessoas com quem mora." };
  }
  if (quantidadeMoradia > 0 && (!moraComQuem || !ocupacaoMoradia)) {
    return { ok: false, erro: "Informe quem mora com você e o emprego/ocupação dessas pessoas." };
  }
  if (rendaExtra !== "sim" && rendaExtra !== "nao") {
    return { ok: false, erro: "Responda se faz alguma atividade para obter renda extra." };
  }
  if (rendaExtra === "sim" && !rendaExtraDescricao) {
    return { ok: false, erro: "Informe qual atividade você faz para obter renda extra." };
  }

  const sobreVoce: Record<string, string> = {};
  for (const k of ["no_futuro","pensam_que_sou","sabem_que_sou","ex_chefe","tira_do_serio","valores_lider","valores_proprios","proximas_conquistas","tempo_conquistas","pontos_positivos","pontos_melhoria","ultimo_livro","frase_define","motivo_escolher"]) {
    sobreVoce[k] = get(`sv_${k}`);
    if (!sobreVoce[k]) return { ok: false, erro: "Preencha todas as perguntas da etapa Sobre você." };
  }

  const cv = formData.get("curriculo");
  if (!(cv instanceof File) || cv.size <= 0) {
    return { ok: false, erro: "Anexe seu currículo em PDF, DOC ou DOCX." };
  }
  const erroCurriculo = validarCurriculoArquivo(cv);
  if (erroCurriculo) return { ok: false, erro: erroCurriculo };

  const extensao = extensaoCurriculo(cv.name);
  const curriculo_url = `${ficha.id}/curriculo-${Date.now()}.${extensao}`;
  const { error: upErr } = await admin.storage.from("curriculos").upload(curriculo_url, cv, {
    contentType: cv.type,
    upsert: false,
  });
  if (upErr) return { ok: false, erro: "Falha ao enviar o currículo. Tente novamente." };

  const respostas = {
    ficha_id: ficha.id,
    vaga_pretendida: get("vaga_pretendida") || "Assistente de produção",
    nome_completo: get("nome_completo"),
    idade: parseInt(get("idade"), 10),
    endereco: get("endereco"),
    whatsapp: limparTelefone(get("whatsapp")),
    cpf,
    tamanho_camisa: get("tamanho_camisa"),
    email: get("email"),
    instagram: get("instagram") || null,
    estado_civil: get("estado_civil"),
    tem_filhos: temFilhos,
    quantidade_filhos: temFilhos ? parseInt(get("quantidade_filhos") || "0", 10) : null,
    idades_filhos: temFilhos ? get("idades_filhos") : null,
    quantidade_pessoas_mora_junto: quantidadeMoradia,
    mora_com_quem: quantidadeMoradia > 0 ? moraComQuem : null,
    emprego_ocupacao_pessoas_mora_junto: quantidadeMoradia > 0 ? ocupacaoMoradia : null,
    // Mantém as colunas legadas preenchidas enquanto relatórios antigos ainda as consultam.
    mora_com: quantidadeMoradia > 0 ? moraComQuem : "Mora sozinho(a)",
    profissao_pessoas_mora_com: quantidadeMoradia > 0 ? ocupacaoMoradia : "Não se aplica",
    trabalha_atualmente: trabalha,
    cargo_atual: trabalha ? get("cargo_atual") : null,
    disponibilidade_viajar: dispViajar === "integral" ? "integral" : dispViajar === "parcial" ? "parcial" : "nao_tenho",
    disponibilidade_viajar_explicacao: dispViajar !== "integral" ? get("disponibilidade_viajar_explicacao") : null,
    tem_conhecido_grupo: temConhecido,
    conhecido_nome: temConhecido ? get("conhecido_nome") : null,
    conhecido_relacao: temConhecido ? get("conhecido_relacao") : null,
    origem_vaga: get("origem_vaga"),
    renda_extra: rendaExtra,
    renda_extra_descricao: rendaExtra === "sim" ? rendaExtraDescricao : null,
    formacao: get("formacao"),
    habilidades_quer_aprender: get("habilidades_quer_aprender"),
    moto_propria: getBool("moto_propria"),
    carro_proprio: getBool("carro_proprio"),
    notebook_proprio: getBool("notebook_proprio"),
    internet_casa: getBool("internet_casa"),
    celular_android: getBool("celular_android"),
    celular_ios: getBool("celular_ios"),
    tem_cnh: temCnh,
    cnh_categoria: temCnh ? get("cnh_categoria") : null,
    ferramentas_json: ferramentas,
    ferramentas_outros: ferramentas.includes("Outros") ? get("ferramentas_outros") : null,
    horas_livres_json: getArr("horas_livres"),
    respostas_sobre_voce_json: sobreVoce,
  };

  const { error } = await admin.from("ficha_respostas").insert(respostas);
  if (error) {
    console.error(error);
    await admin.storage.from("curriculos").remove([curriculo_url]);
    return { ok: false, erro: "Erro ao salvar a ficha. Tente novamente." };
  }

  const { error: fichaError } = await admin.from("fichas").update({
    status: "recebida",
    ficha_enviada_em: new Date().toISOString(),
    curriculo_url,
    curriculo_nome_arquivo: cv.name,
    curriculo_tipo_arquivo: cv.type,
    curriculo_tamanho: cv.size,
    cpf,
    token_atual_hash: null, // link expira após envio
    token_atual: null,
  }).eq("id", ficha.id);
  if (fichaError) {
    console.error(fichaError);
    await admin.from("ficha_respostas").delete().eq("ficha_id", ficha.id);
    await admin.storage.from("curriculos").remove([curriculo_url]);
    return { ok: false, erro: "Erro ao finalizar o envio da ficha. Tente novamente." };
  }

  await logAudit({ acao: "ficha_enviada_pelo_candidato", entidade_tipo: "ficha", entidade_id: ficha.id });
  return { ok: true };
}
