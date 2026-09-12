-- ======================================================================
-- A terceira marca: Revitta Derma.
--
-- A lista de marcas do sistema passa a sair daqui, e não de nomes
-- escritos no código do front — então acrescentar a quarta é uma linha
-- nesta tabela, e mais nada.
--
-- `painel_marcas` deixou de exigir url e chave: uma marca pode existir na
-- Central sem painel de números próprio. A Revitta Derma está nascendo; o
-- painel do Lovable é de quem já roda.
-- ======================================================================

alter table public.painel_marcas alter column url drop not null;
alter table public.painel_marcas alter column chave_publica drop not null;

insert into public.brands (nome, slug, ativo)
values ('Revitta Derma', 'revitta-derma', true)
on conflict (slug) do update set nome = excluded.nome, ativo = true;

-- a ficha da marca, por enquanto só para pendurar a pasta do Drive
insert into public.painel_marcas (marca, url, chave_publica, ativo)
values ('Revitta Derma', null, null, true),
       ('VermeFree',     null, null, true)
on conflict (marca) do nothing;

-- quem já tem conta passa a enxergar a marca nova
insert into public.profile_brands (profile_id, brand_id)
select p.id, b.id from public.profiles p cross join public.brands b
where b.slug = 'revitta-derma' and p.ativo
on conflict do nothing;

-- e quem ainda vai criar conta: o convite já leva as três
update public.equipe_convites c
set marcas = (select array_agg(b.id) from public.brands b where b.ativo)
where cardinality(c.marcas) = 2;
