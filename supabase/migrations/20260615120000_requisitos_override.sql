-- =====================================================================
-- Requisitos manuais (override) por candidato e por membro da equipe
-- =====================================================================
-- Permite que usuários com acesso_total editem os 4 requisitos principais
-- independentemente da ficha original. Colunas NULL = "não editado"
-- (o sistema continua derivando da ficha). Mudança ADITIVA e não destrutiva:
-- nenhuma coluna/linha existente é alterada ou removida.
-- RLS: as policies atuais de candidatos/equipe já controlam escrita
-- (acesso_total). Não há alteração de policy nem de dados.

-- Candidatos
alter table public.candidatos
  add column if not exists req_disponibilidade text,
  add column if not exists req_notebook boolean,
  add column if not exists req_veiculo boolean,
  add column if not exists req_cnh boolean,
  add column if not exists req_cnh_categoria text;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'candidatos_req_disponibilidade_check') then
    alter table public.candidatos
      add constraint candidatos_req_disponibilidade_check
      check (req_disponibilidade is null or req_disponibilidade in ('integral','parcial','nao_tenho'));
  end if;
end $$;

-- Equipe
alter table public.equipe
  add column if not exists req_disponibilidade text,
  add column if not exists req_notebook boolean,
  add column if not exists req_veiculo boolean,
  add column if not exists req_cnh boolean,
  add column if not exists req_cnh_categoria text;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'equipe_req_disponibilidade_check') then
    alter table public.equipe
      add constraint equipe_req_disponibilidade_check
      check (req_disponibilidade is null or req_disponibilidade in ('integral','parcial','nao_tenho'));
  end if;
end $$;
