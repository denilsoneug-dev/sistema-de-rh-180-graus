alter table public.fichas
  add column if not exists status_recrutamento text;

update public.fichas
set status_recrutamento = case
  when status = 'rejeitada' then 'reprovado'
  when status = 'selecionada' then 'chamado_entrevista'
  else 'nova_ficha'
end
where status_recrutamento is null;

alter table public.fichas
  alter column status_recrutamento set default 'nova_ficha',
  alter column status_recrutamento set not null;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'fichas_status_recrutamento_check'
  ) then
    alter table public.fichas
      add constraint fichas_status_recrutamento_check
      check (status_recrutamento in (
        'nova_ficha',
        'em_analise',
        'chamado_entrevista',
        'entrevista_marcada',
        'aprovado',
        'reprovado',
        'banco_de_talentos'
      ));
  end if;
end $$;

create index if not exists fichas_status_recrutamento_idx
  on public.fichas (status_recrutamento, ficha_enviada_em desc);
