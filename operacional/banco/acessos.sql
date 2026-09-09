-- ======================================================================
-- Quem entra na Central: a lista de convites e o gatilho que monta o
-- perfil na primeira entrada. Aplicado no banco da Central
-- (sjkuysdmixfzeerxuudn) em 09/09/2026.
--
-- A estrutura de profiles/areas/brands/profile_brands e as funções
-- app.sou_admin() e afins vêm da Etapa 1 e não estão repetidas aqui.
-- ======================================================================

create table if not exists public.equipe_convites (
  email          text primary key,
  nome           text not null,
  nome_clickup   text,
  cargo          text,
  papel          public.papel_usuario not null default 'membro',
  area_id        uuid references public.areas(id) on delete set null,
  marcas         uuid[] not null default '{}',
  observacao     text,
  criado_em      timestamptz not null default now(),
  criado_por     uuid references auth.users(id) on delete set null,
  atualizado_em  timestamptz not null default now()
);

alter table public.equipe_convites enable row level security;

create policy equipe_convites_leitura on public.equipe_convites
  for select using (app.estou_ativo() and not app.eh_externo());

create policy equipe_convites_admin on public.equipe_convites
  for all using (app.sou_admin()) with check (app.sou_admin());

create or replace function app.convite_atualizado() returns trigger
language plpgsql as $$
begin
  new.email := lower(trim(new.email));
  new.atualizado_em := now();
  return new;
end $$;

create trigger convite_atualizado before insert or update on public.equipe_convites
  for each row execute function app.convite_atualizado();

-- ---------------------------------------------------------------------
-- O gatilho da conta nova consulta a lista: quem está nela entra
-- liberado, com papel, area e marcas; quem nao esta, entra bloqueado.
-- ---------------------------------------------------------------------
create or replace function app.ao_criar_usuario() returns trigger
language plpgsql security definer set search_path to 'public', 'pg_temp'
as $$
declare
  primeiro boolean;
  novo_id  uuid := new.id;
  c        public.equipe_convites%rowtype;
begin
  select not exists (select 1 from public.profiles) into primeiro;
  select * into c from public.equipe_convites where email = lower(trim(new.email));

  insert into public.profiles (id, nome, email, foto_url, papel, ativo, area_id, cargo)
  values (
    novo_id,
    coalesce(nullif(trim(c.nome), ''),
             nullif(trim(new.raw_user_meta_data->>'nome'), ''),
             nullif(trim(new.raw_user_meta_data->>'full_name'), ''),
             split_part(new.email, '@', 1)),
    new.email,
    new.raw_user_meta_data->>'avatar_url',
    case when primeiro then 'admin'
         when c.email is not null then c.papel
         else 'membro' end::public.papel_usuario,
    primeiro or c.email is not null,
    c.area_id,
    nullif(trim(c.cargo), '')
  )
  on conflict (id) do nothing;

  if primeiro then
    insert into public.profile_brands (profile_id, brand_id)
    select novo_id, b.id from public.brands b where b.ativo
    on conflict do nothing;
  elsif c.email is not null then
    insert into public.profile_brands (profile_id, brand_id)
    select novo_id, b.id from public.brands b
     where b.ativo and (cardinality(c.marcas) = 0 or b.id = any (c.marcas))
    on conflict do nothing;
  end if;

  return new;
end $$;

-- ---------------------------------------------------------------------
-- O estado da operacao so para quem esta liberado. Antes bastava estar
-- logado: as linhas de dono nulo sao compartilhadas, e a regra nao
-- olhava se a pessoa tinha acesso.
-- ---------------------------------------------------------------------
drop policy if exists operacional_estado_leitura   on public.operacional_estado;
drop policy if exists operacional_estado_insercao  on public.operacional_estado;
drop policy if exists operacional_estado_alteracao on public.operacional_estado;

create policy operacional_estado_leitura on public.operacional_estado
  for select using (
    app.estou_ativo() and not app.eh_externo()
    and (dono is null or dono = (select auth.uid()))
  );

create policy operacional_estado_insercao on public.operacional_estado
  for insert with check (
    app.estou_ativo() and not app.eh_externo()
    and (dono is null or dono = (select auth.uid()))
  );

create policy operacional_estado_alteracao on public.operacional_estado
  for update using (
    app.estou_ativo() and not app.eh_externo()
    and (dono is null or dono = (select auth.uid()))
  ) with check (
    app.estou_ativo() and not app.eh_externo()
    and (dono is null or dono = (select auth.uid()))
  );
