-- =====================================================================
-- Novo status de candidato: treinamento_encerrado
-- =====================================================================
-- "Passou pelo treinamento, mas não foi aprovado para efetivação."
-- Separa conceitualmente de `rejeitado` (que é reprovação na seleção).
-- Mudança ADITIVA e não destrutiva: apenas adiciona um valor ao enum.
-- Nenhuma linha é alterada por esta migration.
--
-- Observações:
--  * `ADD VALUE IF NOT EXISTS` é idempotente (Postgres 12+).
--  * O novo valor não pode ser USADO na mesma transação em que é criado —
--    aqui só adicionamos, então é seguro.
--  * Rollback: Postgres não remove valor de enum diretamente. Se for
--    imprescindível reverter, é preciso recriar o tipo sem o valor
--    (garantindo que nenhuma linha o utilize). Deixar o valor sem uso é
--    inofensivo.

ALTER TYPE public.status_candidato ADD VALUE IF NOT EXISTS 'treinamento_encerrado';
