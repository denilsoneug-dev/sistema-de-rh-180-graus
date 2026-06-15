-- =====================================================================
-- Guardar o token da ficha em texto, para o link ficar sempre visível
-- no sistema (uso interno, acesso total).
-- =====================================================================
-- Mudança ADITIVA: adiciona coluna nullable. O hash (token_atual_hash)
-- continua existindo e sendo usado na busca pública. O token em texto é
-- apagado junto com o hash quando a ficha é enviada (link deixa de valer).

alter table public.fichas
  add column if not exists token_atual text;
