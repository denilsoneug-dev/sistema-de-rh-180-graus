-- =====================================================================
-- LIMPEZA DE DADOS FAKE / TESTE — Recrutamento 180 Graus
-- =====================================================================
-- ATENÇÃO:
--   * NÃO execute este script sem revisar a PRÉVIA (Seção 1).
--   * O script roda dentro de uma TRANSAÇÃO que termina em ROLLBACK.
--     Nada é apagado de verdade até você TROCAR `ROLLBACK;` por `COMMIT;`
--     no final do arquivo.
--   * É IDEMPOTENTE: rodar de novo após o COMMIT não causa erro (os
--     filtros simplesmente não encontram mais nada).
--   * PRESERVA: perfis, configuracoes, audit_logs e qualquer dado real.
--   * Identifica "fake" por marcadores conhecidos do seed:
--       - e-mail terminando em "@exemplo.com"
--       - CPF começando com 400000000 ou 500000000
--     Ajuste os marcadores na CTE `fichas_fake` se o seu seed usar outros.
--   * Storage (currículos/redações) NÃO é apagado por SQL — veja a
--     Seção 3 para listar os paths e remover manualmente no painel.
-- =====================================================================

BEGIN;

-- ---------------------------------------------------------------------
-- SEÇÃO 1 — PRÉVIA (rode primeiro e confira as contagens)
-- ---------------------------------------------------------------------
WITH fichas_fake AS (
  SELECT f.id
  FROM public.fichas f
  LEFT JOIN public.ficha_respostas r ON r.ficha_id = f.id
  WHERE r.email ILIKE '%@exemplo.com'
     OR r.cpf ~ '^[45]00000000'
     OR f.cpf ~ '^[45]00000000'
),
equipe_fake AS (
  SELECT e.id
  FROM public.equipe e
  WHERE e.cpf ~ '^[45]00000000'
),
candidatos_fake AS (
  SELECT c.id
  FROM public.candidatos c
  WHERE c.ficha_id IN (SELECT id FROM fichas_fake)
     OR c.cpf ~ '^[45]00000000'
)
SELECT
  (SELECT count(*) FROM fichas_fake)                                              AS fichas,
  (SELECT count(*) FROM public.ficha_respostas WHERE ficha_id IN (SELECT id FROM fichas_fake)) AS ficha_respostas,
  (SELECT count(*) FROM candidatos_fake)                                          AS candidatos,
  (SELECT count(*) FROM public.candidato_etapas WHERE candidato_id IN (SELECT id FROM candidatos_fake)) AS candidato_etapas,
  (SELECT count(*) FROM equipe_fake)                                              AS equipe,
  (SELECT count(*) FROM public.dados_bancarios WHERE equipe_id IN (SELECT id FROM equipe_fake)) AS dados_bancarios,
  (SELECT count(*) FROM public.bonus_indicacao
     WHERE indicador_equipe_id IN (SELECT id FROM equipe_fake)
        OR indicado_equipe_id  IN (SELECT id FROM equipe_fake)
        OR candidato_origem_id IN (SELECT id FROM candidatos_fake))              AS bonus_indicacao,
  (SELECT count(*) FROM public.observacoes
     WHERE (entidade_tipo = 'ficha'     AND entidade_id IN (SELECT id FROM fichas_fake))
        OR (entidade_tipo = 'candidato' AND entidade_id IN (SELECT id FROM candidatos_fake))
        OR (entidade_tipo = 'equipe'    AND entidade_id IN (SELECT id FROM equipe_fake))) AS observacoes;

-- ---------------------------------------------------------------------
-- SEÇÃO 2 — EXCLUSÃO (ordem segura por FK; só efetiva no COMMIT)
-- ---------------------------------------------------------------------
-- Recalcula os conjuntos como tabelas temporárias para reuso e idempotência.
CREATE TEMP TABLE _fichas_fake ON COMMIT DROP AS
  SELECT f.id
  FROM public.fichas f
  LEFT JOIN public.ficha_respostas r ON r.ficha_id = f.id
  WHERE r.email ILIKE '%@exemplo.com'
     OR r.cpf ~ '^[45]00000000'
     OR f.cpf ~ '^[45]00000000';

CREATE TEMP TABLE _equipe_fake ON COMMIT DROP AS
  SELECT id FROM public.equipe WHERE cpf ~ '^[45]00000000';

CREATE TEMP TABLE _candidatos_fake ON COMMIT DROP AS
  SELECT id FROM public.candidatos
  WHERE ficha_id IN (SELECT id FROM _fichas_fake)
     OR cpf ~ '^[45]00000000';

-- 1) Filhos diretos
DELETE FROM public.bonus_indicacao
 WHERE indicador_equipe_id IN (SELECT id FROM _equipe_fake)
    OR indicado_equipe_id  IN (SELECT id FROM _equipe_fake)
    OR candidato_origem_id IN (SELECT id FROM _candidatos_fake);

DELETE FROM public.dados_bancarios
 WHERE equipe_id IN (SELECT id FROM _equipe_fake);

DELETE FROM public.candidato_etapas
 WHERE candidato_id IN (SELECT id FROM _candidatos_fake);

DELETE FROM public.observacoes
 WHERE (entidade_tipo = 'ficha'     AND entidade_id IN (SELECT id FROM _fichas_fake))
    OR (entidade_tipo = 'candidato' AND entidade_id IN (SELECT id FROM _candidatos_fake))
    OR (entidade_tipo = 'equipe'    AND entidade_id IN (SELECT id FROM _equipe_fake));

-- 2) Quebra referências circulares (candidatos <-> equipe) antes de apagar
UPDATE public.equipe    SET candidato_origem_id = NULL
 WHERE candidato_origem_id IN (SELECT id FROM _candidatos_fake);
UPDATE public.candidatos SET indicado_por_equipe_id = NULL
 WHERE indicado_por_equipe_id IN (SELECT id FROM _equipe_fake);

-- 3) Entidades principais
DELETE FROM public.candidatos WHERE id IN (SELECT id FROM _candidatos_fake);
DELETE FROM public.equipe     WHERE id IN (SELECT id FROM _equipe_fake);
DELETE FROM public.ficha_respostas WHERE ficha_id IN (SELECT id FROM _fichas_fake);
DELETE FROM public.fichas     WHERE id IN (SELECT id FROM _fichas_fake);

-- ---------------------------------------------------------------------
-- SEÇÃO 3 — PATHS DE STORAGE PARA REMOÇÃO MANUAL (rode antes do COMMIT)
-- ---------------------------------------------------------------------
-- Copie a saída e remova os arquivos no painel Supabase (Storage),
-- buckets "curriculos" e "redacoes". O SQL acima NÃO apaga storage.
--   SELECT 'curriculos' AS bucket, curriculo_url FROM public.fichas WHERE id IN (SELECT id FROM _fichas_fake) AND curriculo_url IS NOT NULL
--   UNION ALL
--   SELECT 'redacoes', arquivo_url FROM public.candidato_etapas WHERE candidato_id IN (SELECT id FROM _candidatos_fake) AND arquivo_url IS NOT NULL;
-- (Rode esta query ANTES de deletar as linhas, ou ajuste para capturar os paths em uma temp table.)

-- ---------------------------------------------------------------------
-- FINAL: por segurança, termina em ROLLBACK.
-- Para efetivar a limpeza, troque a linha abaixo por:  COMMIT;
-- ---------------------------------------------------------------------
ROLLBACK;
