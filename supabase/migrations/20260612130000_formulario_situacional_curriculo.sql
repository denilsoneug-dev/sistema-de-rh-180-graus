alter table public.ficha_respostas
  add column if not exists renda_extra_descricao text,
  add column if not exists quantidade_pessoas_mora_junto integer,
  add column if not exists mora_com_quem text,
  add column if not exists emprego_ocupacao_pessoas_mora_junto text;

alter table public.fichas
  add column if not exists curriculo_nome_arquivo text,
  add column if not exists curriculo_tipo_arquivo text,
  add column if not exists curriculo_tamanho integer;

update public.ficha_respostas
set
  mora_com_quem = coalesce(mora_com_quem, nullif(mora_com, '')),
  emprego_ocupacao_pessoas_mora_junto = coalesce(
    emprego_ocupacao_pessoas_mora_junto,
    nullif(profissao_pessoas_mora_com, '')
  )
where
  mora_com_quem is null
  or emprego_ocupacao_pessoas_mora_junto is null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'ficha_respostas_quantidade_pessoas_mora_junto_check'
  ) then
    alter table public.ficha_respostas
      add constraint ficha_respostas_quantidade_pessoas_mora_junto_check
      check (
        quantidade_pessoas_mora_junto is null
        or quantidade_pessoas_mora_junto >= 0
      );
  end if;
end $$;

