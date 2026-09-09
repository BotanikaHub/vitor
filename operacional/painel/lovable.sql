-- ======================================================================
-- Central ↔ Painel (Botanika Analytics, Lovable Cloud)
--
-- O banco do painel só abre para service_role: nenhuma tabela tem
-- política para anon nem para authenticated. A Central não tem (nem
-- deve ter) a chave de serviço dele. Então a porta é outra: funções
-- SECURITY DEFINER que devolvem cada tela já calculada, e que só
-- respondem quando recebem o token que a Central guarda. O hash do
-- token fica em app_config; o token em si, na base da Central.
--
-- Cada função é a tradução fiel do que o app do Lovable calcula em
-- TypeScript (dashboard.functions.ts, vendas.functions.ts, ...). Onde
-- o app já tinha uma função SQL (recompra, ranking_produtos,
-- ranking_dias, card_reembolso, get_ig_realizado_range), ela é
-- reaproveitada — a conta é a mesma, o número bate.
-- ======================================================================

-- ---------- a tranca ----------
create or replace function public.central_ok(p_token text) returns boolean
language sql stable security definer set search_path = public, extensions as $$
  select exists (
    select 1 from public.app_config
    where key = 'central_token_sha256'
      and value->>'hash' = encode(extensions.digest(coalesce(p_token, ''), 'sha256'), 'hex'));
$$;
revoke all on function public.central_ok(text) from public;
grant execute on function public.central_ok(text) to anon, authenticated, service_role;

create or replace function public.central_fmt(v numeric, u text) returns text
language sql immutable as $$
  select case when u = 'R$' then 'R$ ' || replace(to_char(round(v), 'FM999G999G999'), ',', '.')
              when u = '%' then replace(round(v, 1)::text, '.', ',') || '%'
              when u = 'x' then replace(round(v, 2)::text, '.', ',') || 'x'
              else replace(to_char(round(v), 'FM999G999G999'), ',', '.') end;
$$;

-- ---------- saúde: prova que a ponte está de pé, sem abrir dado ----------
create or replace function public.central_saude(p_token text) returns jsonb
language plpgsql stable security definer set search_path = public, extensions as $$
begin
  if not public.central_ok(p_token) then
    return jsonb_build_object('ok', false, 'motivo', 'token');
  end if;
  return jsonb_build_object('ok', true,
    'ultimo_pedido', (select max(updated_at) from shopify_orders),
    'meta_sync', (select value->>'at' from app_config where key = 'meta_last_sync'),
    'agora', now());
end $$;
revoke all on function public.central_saude(text) from public;
grant execute on function public.central_saude(text) to anon, authenticated, service_role;

-- ======================================================================
-- Visão / Vendas: um período (p_de..p_ate) mais o contexto do mês.
-- ======================================================================
create or replace function public.central_visao(p_token text, p_de date, p_ate date) returns jsonb
language plpgsql stable security definer set search_path = public, extensions as $$
declare
  hoje date := (now() at time zone 'America/Sao_Paulo')::date;
  m_ini date := date_trunc('month', hoje)::date;
  m_fim date := (date_trunc('month', hoje) + interval '1 month - 1 day')::date;
  dias int := extract(day from m_fim);
  dia_hoje int := extract(day from hoje);
  eh_mes boolean := (p_de = m_ini and p_ate = m_fim);
  dur int := (p_ate - p_de) + 1;
  a_de date; a_ate date;
  periodo jsonb; anterior jsonb; bloco_mes jsonb; produtos jsonb; serie jsonb; fontes jsonb;
  m1 numeric := 0; m2 numeric := 0; m3 numeric := 0; ativa int := 1; meta numeric; realizado numeric;
  fat_anterior numeric; ped_anterior int;
  cli jsonb; reemb jsonb;
begin
  if not public.central_ok(p_token) then raise exception 'token' using errcode = '28000'; end if;

  -- período anterior: mesma duração; no mês, o mês passado até o mesmo dia
  if eh_mes then
    a_de := (m_ini - interval '1 month')::date;
    a_ate := least((a_de + interval '1 month - 1 day')::date, a_de + (least(hoje, p_ate) - m_ini));
  else
    a_ate := p_de - 1; a_de := a_ate - (dur - 1);
  end if;

  -- ---------- o período ----------
  with p as (
    select *, total - refunded_amount as liq from shopify_orders
    where is_test = false and dia between p_de and p_ate),
  pp as (select * from p where financial_status in ('paid','partially_refunded')),
  itens as (
    select oi.sku, coalesce(nullif(trim(oi.nome_produto),''), oi.sku, '—') nome, oi.quantidade, oi.preco
    from shopify_order_items oi join pp on pp.id = oi.order_id),
  fonte as (
    select coalesce(source_category, 'Outros') canal, sum(liq) faturamento, count(*) pedidos
    from pp group by 1)
  select jsonb_build_object(
    'faturamento', coalesce((select sum(liq) from pp), 0),
    'pedidos', (select count(*) from pp),
    'pedidos_totais', (select count(*) from p),
    'ticket', coalesce((select sum(liq) / nullif(count(*), 0) from pp), 0),
    'unidades', coalesce((select sum(quantidade) from itens), 0),
    'itens_por_pedido', coalesce((select sum(quantidade)::numeric / nullif((select count(*) from pp), 0) from itens), 0),
    'faturamento_hoje', coalesce((select sum(total - refunded_amount) from shopify_orders
        where is_test = false and dia = hoje and financial_status in ('paid','partially_refunded')), 0),
    'faturamento_ontem', coalesce((select sum(total - refunded_amount) from shopify_orders
        where is_test = false and dia = hoje - 1 and financial_status in ('paid','partially_refunded')), 0),
    'status', jsonb_build_object(
      'aprovados', (select count(*) from pp),
      'pendentes', (select count(*) from p where financial_status in ('pending','authorized','partially_paid')),
      'reembolsados', (select count(*) from p where financial_status in ('refunded','voided')),
      'taxa_aprovacao', coalesce((select count(*) from pp)::numeric * 100 / nullif((select count(*) from p), 0), 0),
      'pagamentos', coalesce((select jsonb_agg(jsonb_build_object('nome', nome, 'qtd', qtd) order by qtd desc)
        from (select coalesce(nullif(trim(payment_method),''),'—') nome, count(*) qtd from pp group by 1 limit 6) x), '[]'::jsonb)),
    'fontes', coalesce((select jsonb_agg(jsonb_build_object('canal', canal, 'faturamento', faturamento, 'pedidos', pedidos,
        'pct', faturamento * 100 / nullif((select sum(faturamento) from fonte), 0)) order by faturamento desc) from fonte), '[]'::jsonb),
    'grupos', jsonb_build_object(
      'pago', coalesce((select sum(faturamento) from fonte where canal in ('Meta','Google')), 0),
      'organico', coalesce((select sum(faturamento) from fonte where canal not in ('Meta','Google')), 0)),
    'frete_gratis', jsonb_build_object(
      'pedidos', (select count(*) from pp where total >= 349),
      'pct', coalesce((select count(*) filter (where total >= 349)::numeric * 100 / nullif(count(*), 0) from pp), 0)),
    'cupom', jsonb_build_object(
      'faturamento', coalesce((select sum(liq) from pp where nullif(trim(discount_code),'') is not null), 0),
      'pct', coalesce((select sum(liq) filter (where nullif(trim(discount_code),'') is not null) * 100 / nullif(sum(liq), 0) from pp), 0)),
    'lucro', (
      with r as (
        select i.sku, i.nome, sum(i.preco * i.quantidade) fat, sum(i.quantidade) un,
               (select custo_unitario from produtos_cogs c where c.sku = i.sku and c.custo_unitario > 0 limit 1) custo
        from itens i group by i.sku, i.nome)
      select jsonb_build_object(
        'valor', case when sum(fat) filter (where custo is not null) > 0
                      then sum(fat - custo * un) filter (where custo is not null) else null end,
        'margem', case when sum(fat) filter (where custo is not null) > 0
                       then sum(fat - custo * un) filter (where custo is not null) / sum(fat) filter (where custo is not null) else null end,
        'receita_coberta', coalesce(sum(fat) filter (where custo is not null), 0),
        'produtos_sem_custo', count(*) filter (where custo is null and un > 0),
        'parcial', count(*) filter (where custo is null and un > 0) > 0)
      from r)
  ) into periodo;

  -- ---------- produtos (ranking do período, com custo por SKU) ----------
  select coalesce(jsonb_agg(jsonb_build_object(
      'nome', r.nome, 'sku', r.sku, 'faturamento', r.faturamento, 'unidades', r.unidades,
      'lucro', case when c.custo_unitario > 0 then r.faturamento - c.custo_unitario * r.unidades end,
      'margem', case when c.custo_unitario > 0 and r.faturamento > 0
                     then (r.faturamento - c.custo_unitario * r.unidades) / r.faturamento end)
    order by r.faturamento desc), '[]'::jsonb)
  into produtos
  from public.ranking_produtos(p_de, p_ate) r
  left join produtos_cogs c on c.sku = r.sku and c.custo_unitario > 0;

  -- ---------- série diária, densa ----------
  select coalesce(jsonb_agg(jsonb_build_object('dia', d, 'faturamento', coalesce(rd.faturamento, 0),
      'pedidos', coalesce(rd.pedidos, 0)) order by d), '[]'::jsonb)
  into serie
  from generate_series(p_de, p_ate, interval '1 day') g(d)
  left join public.ranking_dias(p_de, p_ate) rd on rd.dia = g.d::date;

  -- ---------- clientes novos × recorrentes, e reembolso ----------
  with pp as (
    select cliente_hash from shopify_orders
    where is_test = false and dia between p_de and p_ate
      and financial_status in ('paid','partially_refunded') and nullif(trim(cliente_hash),'') is not null),
  antes as (
    select distinct cliente_hash from shopify_orders
    where is_test = false and dia < p_de and financial_status in ('paid','partially_refunded'))
  select jsonb_build_object(
    'pedidos_novos', count(*) filter (where a.cliente_hash is null),
    'pct_novo', coalesce(count(*) filter (where a.cliente_hash is null)::numeric * 100 / nullif(count(*), 0), 0),
    'pct_recorrente', coalesce(count(*) filter (where a.cliente_hash is not null)::numeric * 100 / nullif(count(*), 0), 0))
  into cli from pp left join antes a on a.cliente_hash = pp.cliente_hash;

  select jsonb_build_object('total', coalesce(reembolso_total, 0), 'pedidos', coalesce(pedidos_reembolsados, 0),
    'taxa', coalesce(taxa_reembolso_pct, 0), 'faturamento_bruto', coalesce(faturamento_bruto, 0))
  into reemb from public.card_reembolso(p_de, p_ate);

  -- ---------- o período anterior, para os deltas ----------
  with pp as (
    select total - refunded_amount liq from shopify_orders
    where is_test = false and dia between a_de and a_ate and financial_status in ('paid','partially_refunded'))
  select jsonb_build_object(
    'de', a_de, 'ate', a_ate,
    'rotulo', case when eh_mes then 'vs mês passado' else 'vs período anterior' end,
    'faturamento', coalesce(sum(liq), 0), 'pedidos', count(*),
    'ticket', coalesce(sum(liq) / nullif(count(*), 0), 0),
    'unidades', coalesce((select sum(oi.quantidade) from shopify_order_items oi join shopify_orders o on o.id = oi.order_id
        where o.is_test = false and o.dia between a_de and a_ate and o.financial_status in ('paid','partially_refunded')), 0),
    'recompra', coalesce((select taxa_recompra_pct from public.recompra(a_de, a_ate)), 0))
  into anterior from pp;

  -- ---------- o mês: meta, ritmo, projeção, dia a dia ----------
  select coalesce(meta1, 0), coalesce(meta2, 0), coalesce(meta3, 0), coalesce(meta_ativa, 1)
  into m1, m2, m3, ativa
  from metas_mensais where ano = extract(year from hoje) and mes = extract(month from hoje);
  meta := coalesce((array[m1, m2, m3])[ativa], 0);
  select coalesce(sum(total - refunded_amount), 0) into realizado from shopify_orders
  where is_test = false and dia between m_ini and m_fim and financial_status in ('paid','partially_refunded');

  select jsonb_build_object(
    'ano', extract(year from hoje), 'mes', extract(month from hoje), 'inicio', m_ini, 'fim', m_fim,
    'dias', dias, 'dia_hoje', dia_hoje, 'hoje', hoje,
    'meta1', m1, 'meta2', m2, 'meta3', m3, 'meta_ativa', ativa, 'meta', meta,
    'realizado', realizado,
    'pct', case when meta > 0 then realizado * 100 / meta else 0 end,
    'gap', meta - realizado,
    'meta_diaria', case when dias > 0 then meta / dias else 0 end,
    'esperado_ate_hoje', case when dias > 0 then meta / dias * dia_hoje else 0 end,
    'projecao', case when dia_hoje > 0 then realizado / dia_hoje * dias else 0 end,
    'ritmo', (select coalesce(jsonb_agg(jsonb_build_object('nome', n, 'total', t,
        'esperado', t * dia_hoje / dias, 'gap', realizado - t * dia_hoje / dias, 'dentro', realizado >= t * dia_hoje / dias)
        order by n), '[]'::jsonb)
      from (values ('Meta 1', m1), ('Meta 2', m2), ('Meta 3', m3)) v(n, t) where t > 0),
    'por_dia', coalesce((select jsonb_object_agg(dia, faturamento) from public.ranking_dias(m_ini, m_fim)), '{}'::jsonb),
    'anterior', (with x as (
        select total - refunded_amount liq from shopify_orders
        where is_test = false and financial_status in ('paid','partially_refunded')
          and dia between (m_ini - interval '1 month')::date
                      and least(((m_ini - interval '1 month') + interval '1 month - 1 day')::date,
                                (m_ini - interval '1 month')::date + (dia_hoje - 1)))
      select jsonb_build_object('faturamento', coalesce(sum(liq), 0), 'pedidos', count(*)) from x)
  ) into bloco_mes;

  return jsonb_build_object(
    'periodo', jsonb_build_object('de', p_de, 'ate', p_ate, 'eh_mes', eh_mes, 'dias', dur),
    'hoje', hoje,
    'atualizado_em', (select max(updated_at) from shopify_orders),
    'visao', periodo,
    'produtos', produtos,
    'serie', serie,
    'clientes', cli,
    'reembolso', reemb,
    'recompra', (select jsonb_build_object('taxa', coalesce(taxa_recompra_pct, 0),
        'recompradores', coalesce(recompradores, 0), 'clientes', coalesce(clientes_periodo, 0))
      from public.recompra(p_de, p_ate)),
    'recompra_mes', (select jsonb_build_object('taxa', coalesce(taxa_recompra_pct, 0),
        'recompradores', coalesce(recompradores, 0), 'clientes', coalesce(clientes_periodo, 0))
      from public.recompra(m_ini, m_fim)),
    'anterior', anterior,
    'mes', bloco_mes,
    'reconciliacao', (select value from app_config where key = 'shopify_reconciliacao'));
end $$;
revoke all on function public.central_visao(text, date, date) from public;
grant execute on function public.central_visao(text, date, date) to anon, authenticated, service_role;

-- ======================================================================
-- Tráfego: Meta Ads no período, atribuição real pelo Shopify, criativos
-- e o gerenciador (campanha → conjunto → anúncio).
-- ======================================================================
create or replace function public.central_trafego(p_token text, p_de date, p_ate date) returns jsonb
language plpgsql stable security definer set search_path = public, extensions as $$
declare
  hoje date := (now() at time zone 'America/Sao_Paulo')::date;
  m_ini date := date_trunc('month', hoje)::date;
  m_fim date := (date_trunc('month', hoje) + interval '1 month - 1 day')::date;
  dias int := extract(day from m_fim);
  dia_hoje int := extract(day from hoje);
  eh_mes boolean := (p_de = m_ini and p_ate = m_fim);
  dur int := (p_ate - p_de) + 1;
  a_de date; a_ate date;
  kpis jsonb; ant jsonb; serie jsonb; criativos jsonb; ger jsonb; margem numeric; breakeven numeric;
  meta_mensal numeric; realizado_mes numeric;
begin
  if not public.central_ok(p_token) then raise exception 'token' using errcode = '28000'; end if;
  if eh_mes then
    a_de := (m_ini - interval '1 month')::date;
    a_ate := least((a_de + interval '1 month - 1 day')::date, a_de + (least(hoje, p_ate) - m_ini));
  else
    a_ate := p_de - 1; a_de := a_ate - (dur - 1);
  end if;

  -- margem média ponderada (90 dias) → ROAS de equilíbrio
  with pr as (select * from public.ranking_produtos(hoje - 89, hoje))
  select case when sum(pr.faturamento) filter (where c.custo_unitario > 0) > 0
              then (sum(pr.faturamento) filter (where c.custo_unitario > 0)
                    - sum(c.custo_unitario * pr.unidades) filter (where c.custo_unitario > 0))
                   / sum(pr.faturamento) filter (where c.custo_unitario > 0) end
  into margem from pr left join produtos_cogs c on c.sku = pr.sku and c.custo_unitario > 0;
  breakeven := case when margem > 0 then 1 / margem end;

  -- kpis do período e do anterior
  select jsonb_build_object(
    'investimento', coalesce((select sum(spend) from campaign_insights_daily where date between p_de and p_ate), 0),
    'conversoes', coalesce((select sum(conversions) from campaign_insights_daily where date between p_de and p_ate and upper(coalesce(objective,'')) = 'OUTCOME_SALES'), 0),
    'receita_meta', coalesce((select sum(revenue) from campaign_insights_daily where date between p_de and p_ate and upper(coalesce(objective,'')) = 'OUTCOME_SALES'), 0),
    'faturamento_atribuido', coalesce((select sum(total - refunded_amount) from shopify_orders where is_test = false and dia between p_de and p_ate and financial_status in ('paid','partially_refunded') and source_category = 'Meta'), 0),
    'pedidos_atribuidos', (select count(*) from shopify_orders where is_test = false and dia between p_de and p_ate and financial_status in ('paid','partially_refunded') and source_category = 'Meta'),
    'faturamento_total', coalesce((select sum(total - refunded_amount) from shopify_orders where is_test = false and dia between p_de and p_ate and financial_status in ('paid','partially_refunded')), 0),
    'pedidos_total', (select count(*) from shopify_orders where is_test = false and dia between p_de and p_ate and financial_status in ('paid','partially_refunded')))
  into kpis;
  select jsonb_build_object(
    'investimento', coalesce((select sum(spend) from campaign_insights_daily where date between a_de and a_ate), 0),
    'conversoes', coalesce((select sum(conversions) from campaign_insights_daily where date between a_de and a_ate and upper(coalesce(objective,'')) = 'OUTCOME_SALES'), 0),
    'receita_meta', coalesce((select sum(revenue) from campaign_insights_daily where date between a_de and a_ate and upper(coalesce(objective,'')) = 'OUTCOME_SALES'), 0),
    'faturamento_atribuido', coalesce((select sum(total - refunded_amount) from shopify_orders where is_test = false and dia between a_de and a_ate and financial_status in ('paid','partially_refunded') and source_category = 'Meta'), 0),
    'pedidos_atribuidos', (select count(*) from shopify_orders where is_test = false and dia between a_de and a_ate and financial_status in ('paid','partially_refunded') and source_category = 'Meta'),
    'de', a_de, 'ate', a_ate, 'rotulo', case when eh_mes then 'vs mês passado' else 'vs período anterior' end)
  into ant;

  -- série diária: gasto × faturamento atribuído
  with g as (select date d, sum(spend) gasto from campaign_insights_daily where date between p_de and p_ate group by 1),
       f as (select dia d, sum(total - refunded_amount) fat from shopify_orders where is_test = false and dia between p_de and p_ate
             and financial_status in ('paid','partially_refunded') and source_category = 'Meta' group by 1)
  select coalesce(jsonb_agg(jsonb_build_object('dia', s.d, 'gasto', coalesce(g.gasto, 0), 'faturamento', coalesce(f.fat, 0)) order by s.d), '[]'::jsonb)
  into serie from generate_series(p_de, p_ate, interval '1 day') s(d)
  left join g on g.d = s.d::date left join f on f.d = s.d::date;

  -- criativos
  with a as (
    select ad_id, max(ad_name) ad_name, max(thumbnail_url) thumb, sum(spend) spend, sum(conversions) conv, sum(revenue) revenue
    from ad_insights_daily where date between p_de and p_ate group by ad_id)
  select coalesce(jsonb_agg(jsonb_build_object('ad_id', ad_id, 'nome', ad_name, 'thumb', thumb, 'gasto', spend,
      'conversoes', conv, 'receita', revenue,
      'roas', case when spend > 0 then revenue / spend else 0 end,
      'cpa', case when conv > 0 then spend / conv else 0 end) order by spend desc), '[]'::jsonb)
  into criativos from a;

  -- gerenciador: campanha → conjuntos → anúncios, com vendas reais pelo id na UTM
  with vc as (
    select substring(utm_campaign from '(\d{6,})$') cid, count(*) ped, sum(total - refunded_amount) fat
    from shopify_orders where is_test = false and dia between p_de and p_ate and financial_status in ('paid','partially_refunded')
      and utm_campaign ~ '\d{6,}$' group by 1),
  va as (
    select substring(utm_medium from '(\d{6,})$') aid, count(*) ped, sum(total - refunded_amount) fat
    from shopify_orders where is_test = false and dia between p_de and p_ate and financial_status in ('paid','partially_refunded')
      and utm_medium ~ '\d{6,}$' group by 1),
  ads as (
    select adset_id, ad_id, max(ad_name) nome, max(thumbnail_url) thumb, sum(spend) gasto, sum(impressions) imp,
           sum(inline_link_clicks) cliques, sum(lp_views) lp, sum(checkouts) ck, sum(reach) reach, sum(conversions) conv
    from ad_insights_daily where date between p_de and p_ate group by adset_id, ad_id),
  sets as (
    select campaign_id, adset_id, max(adset_name) nome, sum(spend) gasto, sum(impressions) imp,
           sum(inline_link_clicks) cliques, sum(lp_views) lp, sum(checkouts) ck, sum(reach) reach, sum(conversions) conv
    from adset_insights_daily where date between p_de and p_ate group by campaign_id, adset_id),
  camps as (
    select campaign_id, max(campaign_name) nome, max(status) status, sum(spend) gasto, sum(impressions) imp,
           sum(inline_link_clicks) cliques, sum(lp_views) lp, sum(checkouts) ck, sum(reach) reach, sum(conversions) conv
    from campaign_insights_daily where date between p_de and p_ate group by campaign_id)
  select coalesce(jsonb_agg(jsonb_build_object(
      'id', c.campaign_id, 'nome', c.nome, 'status', c.status, 'gasto', c.gasto, 'impressoes', c.imp, 'cliques', c.cliques,
      'lp_views', c.lp, 'checkouts', c.ck, 'reach', c.reach, 'conv_meta', c.conv,
      'vendas_reais', coalesce(vc.ped, 0), 'faturamento_real', coalesce(vc.fat, 0),
      'filhos', (select coalesce(jsonb_agg(jsonb_build_object(
          'id', s.adset_id, 'nome', s.nome, 'gasto', s.gasto, 'impressoes', s.imp, 'cliques', s.cliques,
          'lp_views', s.lp, 'checkouts', s.ck, 'reach', s.reach, 'conv_meta', s.conv,
          'vendas_reais', coalesce(va.ped, 0), 'faturamento_real', coalesce(va.fat, 0),
          'filhos', (select coalesce(jsonb_agg(jsonb_build_object(
              'id', a.ad_id, 'nome', a.nome, 'thumb', a.thumb, 'gasto', a.gasto, 'impressoes', a.imp, 'cliques', a.cliques,
              'lp_views', a.lp, 'checkouts', a.ck, 'reach', a.reach, 'conv_meta', a.conv) order by a.gasto desc), '[]'::jsonb)
            from ads a where a.adset_id = s.adset_id)) order by s.gasto desc), '[]'::jsonb)
        from sets s left join va on va.aid = s.adset_id where s.campaign_id = c.campaign_id))
    order by c.gasto desc), '[]'::jsonb)
  into ger from camps c left join vc on vc.cid = c.campaign_id;

  -- meta do setor (mês corrente)
  select coalesce(meta_valor, 0) into meta_mensal from metas_kpi
  where periodo = 'mensal' and ano = extract(year from hoje) and periodo_num = extract(month from hoje)
    and escopo = 'trafego' and metrica = 'faturamento_atribuido' limit 1;
  select coalesce(sum(total - refunded_amount), 0) into realizado_mes from shopify_orders
  where is_test = false and dia between m_ini and m_fim and financial_status in ('paid','partially_refunded') and source_category = 'Meta';

  return jsonb_build_object(
    'periodo', jsonb_build_object('de', p_de, 'ate', p_ate, 'eh_mes', eh_mes),
    'kpis', kpis, 'anterior', ant, 'serie', serie, 'criativos', criativos, 'gerenciador', ger,
    'breakeven', jsonb_build_object('roas', breakeven, 'margem', margem),
    'roas_alvo', coalesce(breakeven * 2, 3.0),
    'meta_sync', (select value->>'at' from app_config where key = 'meta_last_sync'),
    'meta', jsonb_build_object('mensal', coalesce(meta_mensal, 0), 'realizado', realizado_mes,
      'esperado_ate_hoje', coalesce(meta_mensal, 0) / dias * dia_hoje,
      'pct', case when coalesce(meta_mensal, 0) > 0 then realizado_mes * 100 / meta_mensal else 0 end));
end $$;
revoke all on function public.central_trafego(text, date, date) from public;
grant execute on function public.central_trafego(text, date, date) to anon, authenticated, service_role;

-- ======================================================================
-- Realizados automáticos de um intervalo, por chave escopo|canal|metrica.
-- Tradução de computeRealizadosRange (metas-setor-auto.server.ts).
-- ======================================================================
-- O Instagram vem de fora, por rede. Cada ida custava perto de meio segundo,
-- e a tela de Setores e metas pede o mês inteiro mais cada semana dele — dez
-- idas numa requisição só, e o banco cortava por tempo esgotado antes de
-- responder ("canceling statement due to statement timeout"). A resposta
-- agora fica guardada por meia hora: a primeira ida paga, as outras leem
-- daqui. Se o Instagram cair, vale o último que veio, mesmo velho.
create table if not exists public.central_ig_cache (
  de date not null,
  ate date not null,
  j jsonb not null,
  em timestamptz not null default now(),
  primary key (de, ate)
);
alter table public.central_ig_cache enable row level security;
revoke all on table public.central_ig_cache from anon, authenticated;

create or replace function public.central_ig_seguro(p_de date, p_ate date) returns jsonb
language plpgsql security definer set search_path = public, extensions, vault as $$
declare
  guardado jsonb;
  novo jsonb;
begin
  select j into guardado from public.central_ig_cache
   where de = p_de and ate = p_ate and em > now() - interval '30 minutes';
  if guardado is not null then return guardado; end if;

  novo := coalesce(public.get_ig_realizado_range(p_de, p_ate), '{}'::jsonb);

  insert into public.central_ig_cache (de, ate, j, em) values (p_de, p_ate, novo, now())
  on conflict (de, ate) do update set j = excluded.j, em = excluded.em;

  return novo;
exception when others then
  select j into guardado from public.central_ig_cache where de = p_de and ate = p_ate;
  return coalesce(guardado, '{}'::jsonb);
end $$;
revoke all on function public.central_ig_seguro(date, date) from public;

create or replace function public.central_realizados(p_de date, p_ate date) returns jsonb
language sql security definer set search_path = public, extensions as $$
  with pp as (
    select id, dia, total - refunded_amount liq, discount_code, utm_source, utm_medium, source_category, cliente_hash
    from shopify_orders where is_test = false and dia between p_de and p_ate and financial_status in ('paid','partially_refunded')),
  ads as (select coalesce(sum(spend),0) spend, coalesce(sum(impressions),0) impr,
                 coalesce(sum(inline_link_clicks),0) cliques, coalesce(sum(lp_views),0) lpv,
                 coalesce(sum(checkouts),0) chk,
                 case when coalesce(sum(impressions),0) > 0
                      then sum(frequency * impressions) / sum(impressions) else 0 end freq
          from campaign_insights_daily where date between p_de and p_ate),
  inv as (select spend v from ads),
  sess as (select coalesce(sum(sessions), 0) v, coalesce(sum(checkouts), 0) chk
           from kpi_sessions_diarias where dia between p_de and p_ate),
  seg as (select followers f from instagram_snapshots where dia <= p_ate order by dia desc limit 1),
  cup as (select upper(codigo) c, coalesce(percentual,0) pct from cupons_acompanhados where tipo = 'influencer'),
  inf as (select p.*, cup.pct from pp p join cup on cup.c = upper(trim(coalesce(p.discount_code,'')))),
  prim as (select cliente_hash, min(dia) primeiro from shopify_orders
           where is_test = false and financial_status in ('paid','partially_refunded') and cliente_hash is not null and dia <= p_ate group by 1),
  ig as (select public.central_ig_seguro(p_de, p_ate) j),
  proxy as (select not exists (select 1 from pp where lower(coalesce(utm_source,'')) ~ 'instagram|(^|[^a-z])ig([^a-z]|$)|insta') v),
  -- o Instagram orgânico, separado por onde o link estava
  bio as (select coalesce(sum(liq),0) v, count(*) n from pp
          where lower(coalesce(utm_source,'')) ~ 'insta' and lower(coalesce(utm_medium,'')) ~ '^bio|link.?bio'),
  sto as (select coalesce(sum(liq),0) v, count(*) n from pp
          where lower(coalesce(utm_source,'')) ~ 'insta' and lower(coalesce(utm_medium,'')) ~ 'stor'),
  liv as (select coalesce(sum(liq),0) v, count(*) n from pp
          where lower(coalesce(utm_source,'')) ~ 'insta' and lower(coalesce(utm_medium,'')) ~ 'live'),
  -- pedidos por canal de automação, para a conversão por disparo
  pe as (select
      count(*) filter (where lower(coalesce(utm_source,'')) ~ 'whatsapp_api|wa_api') api,
      count(*) filter (where lower(coalesce(utm_source,'')) ~ 'whatsapp_org|grupos|whatsapp' and lower(coalesce(utm_source,'')) !~ 'whatsapp_api|wa_api') grupos,
      count(*) filter (where lower(coalesce(utm_source,'')) !~ 'whatsapp'
        and (lower(coalesce(utm_source,'')) ~ 'email|active' or lower(coalesce(utm_medium,'')) ~ 'email')) email
    from pp)
  select jsonb_build_object(
    -- ---------- geral ----------
    'geral||faturamento_mes', coalesce((select sum(liq) from pp), 0),
    'geral||pedidos', (select count(*) from pp),
    'geral||ticket_medio', coalesce((select sum(liq) / nullif(count(*), 0) from pp), 0),
    'geral||conversao', case when (select v from sess) > 0 then (select count(*) from pp)::numeric * 100 / (select v from sess) else 0 end,
    'geral||taxa_recompra', coalesce((select taxa_recompra_pct from public.recompra(p_de, p_ate)), 0),
    'geral||sessoes', (select v from sess),
    -- o número que amarra tráfego ao resultado: quanto custou cada pedido, contando tudo
    'geral||cac', case when (select count(*) from pp) > 0 then (select spend from ads) / (select count(*) from pp) else 0 end,
    -- ---------- tráfego ----------
    'trafego||faturamento_atribuido', coalesce((select sum(liq) from pp where source_category = 'Meta'), 0),
    'trafego||investimento', (select v from inv),
    'trafego||roas_alvo', case when (select v from inv) > 0 then coalesce((select sum(liq) from pp where source_category = 'Meta'), 0) / (select v from inv) else 0 end,
    'trafego||cpa_alvo', case when (select count(*) from pp where source_category = 'Meta') > 0 then (select v from inv) / (select count(*) from pp where source_category = 'Meta') else 0 end,
    'trafego||impressoes', (select impr from ads),
    'trafego||cliques', (select cliques from ads),
    'trafego||ctr', case when (select impr from ads) > 0 then (select cliques from ads)::numeric * 100 / (select impr from ads) else 0 end,
    'trafego||cpc', case when (select cliques from ads) > 0 then (select spend from ads) / (select cliques from ads) else 0 end,
    'trafego||cpm', case when (select impr from ads) > 0 then (select spend from ads) * 1000 / (select impr from ads) else 0 end,
    'trafego||frequencia', (select freq from ads),
    'trafego||lp_views', (select lpv from ads),
    'trafego||checkouts_ads', (select chk from ads),
    -- do clique à página: onde o anúncio perde gente
    'trafego||clique_para_lp', case when (select cliques from ads) > 0 then (select lpv from ads)::numeric * 100 / (select cliques from ads) else 0 end,
    -- ---------- site ----------
    'site||sessoes', (select v from sess),
    'site||checkouts_iniciados', (select chk from sess),
    'site||taxa_checkout', case when (select v from sess) > 0 then (select chk from sess)::numeric * 100 / (select v from sess) else 0 end,
    'site||conclusao_checkout', case when (select chk from sess) > 0 then (select count(*) from pp)::numeric * 100 / (select chk from sess) else 0 end,
    'site||conversao', case when (select v from sess) > 0 then (select count(*) from pp)::numeric * 100 / (select v from sess) else 0 end,
    'site||receita_por_sessao', case when (select v from sess) > 0 then coalesce((select sum(liq) from pp), 0) / (select v from sess) else 0 end,
    -- ---------- influenciadores ----------
    'influenciadores||faturamento_influencer', coalesce((select sum(liq) from inf), 0),
    'influenciadores||influencers_ativos', (select count(distinct upper(trim(discount_code))) from inf),
    'influenciadores||pct_clientes_novos', coalesce((select count(*) filter (where pr.primeiro = i.dia)::numeric * 100 / nullif(count(*), 0)
        from inf i left join prim pr on pr.cliente_hash = i.cliente_hash), 0),
    'influenciadores||fat_por_influencer', coalesce((select sum(liq) from inf), 0)
      / nullif((select count(distinct upper(trim(discount_code))) from inf), 0),
    'influenciadores||comissao', coalesce((select sum(liq * pct / 100) from inf), 0),
    'influenciadores||roi', case when coalesce((select sum(liq * pct / 100) from inf), 0) > 0
      then coalesce((select sum(liq) from inf), 0) / (select sum(liq * pct / 100) from inf) else 0 end,
    -- ---------- social media ----------
    'social_media||visualizacoes', coalesce(((select j from ig)->>'views')::numeric, 0),
    'social_media||interacoes', coalesce(((select j from ig)->>'interacoes')::numeric, 0),
    'social_media||cliques_link', coalesce(((select j from ig)->>'cliques')::numeric, 0),
    'social_media||seguidores_liquidos', coalesce(((select j from ig)->>'seguidores_liquidos')::numeric, 0),
    'social_media||seguidores', coalesce((select f from seg), 0),
    'social_media||taxa_clique', case when coalesce(((select j from ig)->>'views')::numeric, 0) > 0
      then coalesce(((select j from ig)->>'cliques')::numeric, 0) * 100 / ((select j from ig)->>'views')::numeric else 0 end,
    'social_media||vendas_link', coalesce((select sum(liq) from pp, proxy
        where case when proxy.v then source_category = 'Orgânico' and nullif(trim(discount_code),'') is null
                   else lower(coalesce(utm_source,'')) ~ 'instagram|(^|[^a-z])ig([^a-z]|$)|insta' end), 0),
    'social_media||vendas_bio', (select v from bio),
    'social_media||vendas_stories', (select v from sto),
    'social_media||vendas_live', (select v from liv),
    -- ---------- automações ----------
    'automacoes|whatsapp_api|faturamento', coalesce((select sum(liq) from pp where lower(coalesce(utm_source,'')) ~ 'whatsapp_api|wa_api'), 0),
    'automacoes|grupos|faturamento', coalesce((select sum(liq) from pp where lower(coalesce(utm_source,'')) ~ 'whatsapp_org|grupos'
        and lower(coalesce(utm_source,'')) !~ 'whatsapp_api|wa_api'), 0),
    'automacoes|email|faturamento', coalesce((select sum(liq) from pp where lower(coalesce(utm_source,'')) !~ 'whatsapp'
        and (lower(coalesce(utm_source,'')) ~ 'email|active' or lower(coalesce(utm_medium,'')) ~ 'email')), 0),
    'automacoes|whatsapp_api|pedidos', (select api from pe),
    'automacoes|grupos|pedidos', (select grupos from pe),
    'automacoes|email|pedidos', (select email from pe));
$$;
revoke all on function public.central_realizados(date, date) from public;

-- ======================================================================
-- Setores e metas: o mês inteiro, com metas mensais, manuais, semanais,
-- realizados automáticos do mês e de cada semana (seg–dom, recortada).
-- ======================================================================
create or replace function public.central_setores(p_token text, p_ano int, p_mes int,
  p_de date default null, p_ate date default null) returns jsonb
language plpgsql security definer set search_path = public, extensions set statement_timeout = '25s' as $$
declare
  hoje date := (now() at time zone 'America/Sao_Paulo')::date;
  m_ini date := make_date(p_ano, p_mes, 1);
  m_fim date := (m_ini + interval '1 month - 1 day')::date;
  dias int := extract(day from m_fim);
  ate date := least(hoje, m_fim);
  semanas jsonb := '[]'::jsonb;
  ini date; fim date; n int := 1;
  realizado_mes jsonb;
  seg date := hoje - (extract(isodow from hoje)::int - 1);
  per_de date := least(coalesce(p_de, m_ini), coalesce(p_ate, ate));
  per_ate date := least(greatest(coalesce(p_ate, ate), per_de), hoje);
begin
  if not public.central_ok(p_token) then raise exception 'token' using errcode = '28000'; end if;

  realizado_mes := case when hoje < m_ini then '{}'::jsonb else public.central_realizados(m_ini, ate) end;

  ini := m_ini;
  while ini <= m_fim loop
    fim := least(m_fim, ini + (7 - extract(isodow from ini)::int));
    semanas := semanas || jsonb_build_object(
      'n', n, 'inicio', ini, 'fim', fim, 'dias', fim - ini + 1,
      'em_andamento', fim >= hoje, 'futura', ini > hoje,
      'realizados', case when ini > hoje then '{}'::jsonb else public.central_realizados(ini, least(fim, hoje)) end,
      'metas', coalesce((select jsonb_object_agg(escopo || '|' || coalesce(canal,'') || '|' || metrica, meta_valor)
        from metas_kpi where periodo = 'semanal' and ano = extract(year from ini)
          and periodo_num = (to_char(ini - (extract(isodow from ini)::int - 1), 'YYYYMMDD'))::int), '{}'::jsonb));
    ini := fim + 1; n := n + 1;
  end loop;

  return jsonb_build_object(
    'ano', p_ano, 'mes', p_mes, 'hoje', hoje, 'inicio', m_ini, 'fim', m_fim, 'dias', dias,
    'dia_hoje', case when hoje < m_ini then 0 when hoje > m_fim then dias else extract(day from hoje) end,
    'metas', coalesce((select jsonb_object_agg(escopo || '|' || coalesce(canal,'') || '|' || metrica,
        jsonb_build_object('valor', meta_valor, 'unidade', unidade))
      from metas_kpi where periodo = 'mensal' and ano = p_ano and periodo_num = p_mes), '{}'::jsonb),
    'manuais', coalesce((select jsonb_object_agg(escopo || '|' || coalesce(canal,'') || '|' || metrica, valor)
      from valores_setor where periodo = 'mensal' and ano = p_ano and periodo_num = p_mes), '{}'::jsonb),
    'meta_geral', (select jsonb_build_object('meta1', meta1, 'meta2', meta2, 'meta3', meta3, 'meta_ativa', meta_ativa)
      from metas_mensais where ano = p_ano and mes = p_mes),
    'historico_metas', coalesce((select jsonb_agg(jsonb_build_object('ano', ano, 'mes', mes, 'meta1', meta1, 'meta2', meta2,
        'meta3', meta3, 'meta_ativa', meta_ativa) order by ano desc, mes desc) from metas_mensais), '[]'::jsonb),
    'realizados', realizado_mes,
    -- o mesmo cálculo no recorte que a pessoa escolheu na tela: hoje, ontem,
    -- 3 dias, 7 dias, 30 dias ou um período à mão. É o que deixa cada setor
    -- ver o próprio resultado no filtro dele, e não só no mês fechado.
    'periodo', jsonb_build_object('de', per_de, 'ate', per_ate, 'dias', per_ate - per_de + 1),
    'realizado_periodo', case when per_ate < per_de then '{}'::jsonb
      else public.central_realizados(per_de, per_ate) end,
    'semanas', semanas,
    'sessoes', (select jsonb_build_object('ultima', max(dia), 'dias', hoje - max(dia)) from kpi_sessions_diarias),
    -- As quatro semanas anteriores, só as datas. A média de cada métrica nelas
    -- custava quatro leituras inteiras a mais por carregamento, e nenhuma tela
    -- usava o número. Quando alguma usar, vira função à parte, pedida só ali.
    'sugestao', jsonb_build_object('semanas', (select jsonb_agg(jsonb_build_object(
        'de', seg - 7 * (i + 1), 'ate', seg - 7 * i - 1) order by i) from generate_series(0, 3) i)));
end $$;
revoke all on function public.central_setores(text, int, int, date, date) from public;
grant execute on function public.central_setores(text, int, int, date, date) to anon, authenticated, service_role;
drop function if exists public.central_setores(text, int, int);

-- ======================================================================
-- Um setor, no período: o que a página dele mostra.
-- ======================================================================
create or replace function public.central_setor(p_token text, p_setor text, p_de date, p_ate date) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare
  hoje date := (now() at time zone 'America/Sao_Paulo')::date;
  m_ini date := date_trunc('month', hoje)::date;
  m_fim date := (date_trunc('month', hoje) + interval '1 month - 1 day')::date;
  seg date := hoje - (extract(isodow from hoje)::int - 1);
  r jsonb := '{}'::jsonb;
begin
  if not public.central_ok(p_token) then raise exception 'token' using errcode = '28000'; end if;

  r := jsonb_build_object('setor', p_setor, 'de', p_de, 'ate', p_ate, 'hoje', hoje,
    'metas', coalesce((select jsonb_object_agg(coalesce(canal,'') || '|' || metrica, meta_valor) from metas_kpi
      where periodo = 'mensal' and ano = extract(year from hoje) and periodo_num = extract(month from hoje) and escopo = p_setor), '{}'::jsonb),
    'realizado_periodo', public.central_realizados(p_de, p_ate),
    'realizado_mes', public.central_realizados(m_ini, least(hoje, m_fim)));

  if p_setor = 'influenciadores' then
    r := r || (with cup as (select upper(codigo) c, nome, tipo, percentual from cupons_acompanhados),
      pp as (select o.*, o.total - o.refunded_amount liq, cup.nome inf, cup.tipo, cup.percentual perc from shopify_orders o
             join cup on cup.c = upper(trim(coalesce(o.discount_code,'')))
             where o.is_test = false and o.dia between p_de and p_ate and o.financial_status in ('paid','partially_refunded')),
      prim as (select cliente_hash, min(dia) primeiro, count(*) n from shopify_orders
               where is_test = false and financial_status in ('paid','partially_refunded') and cliente_hash is not null group by 1),
      rec as (select p.*, (pr.primeiro = p.dia) novo, pr.n n_cli from pp p left join prim pr on pr.cliente_hash = p.cliente_hash),
      t14 as (select cup.nome inf, sum(case when o.dia >= hoje - 6 then o.total - o.refunded_amount else 0 end) recente,
                     sum(case when o.dia < hoje - 6 then o.total - o.refunded_amount else 0 end) anterior
              from shopify_orders o join cup on cup.c = upper(trim(coalesce(o.discount_code,'')))
              where cup.tipo = 'influencer' and o.is_test = false and o.dia between hoje - 13 and hoje
                and o.financial_status in ('paid','partially_refunded') group by 1)
      select jsonb_build_object(
        'ranking', coalesce((select jsonb_agg(x order by (x->>'faturamento')::numeric desc) from (
          select jsonb_build_object('nome', inf, 'codigos', string_agg(distinct upper(trim(discount_code)), ' + '),
            'vendas', count(*), 'faturamento', sum(liq), 'ticket', sum(liq) / count(*),
            'pct_novos', count(*) filter (where novo)::numeric * 100 / count(*),
            'recompra_publico', count(distinct cliente_hash) filter (where n_cli >= 2)::numeric * 100 / nullif(count(distinct cliente_hash), 0),
            'desconto', sum(case when perc > 0 and perc < 100 then liq * perc / (100 - perc) else 0 end),
            'tendencia', (select case when anterior = 0 and recente > 0 then 'up'
                when (recente - anterior) / greatest(anterior, 1) > 0.1 then 'up'
                when (recente - anterior) / greatest(anterior, 1) < -0.1 then 'down' else 'flat' end
              from t14 where t14.inf = rec.inf)) x
          from rec where tipo = 'influencer' group by inf) q), '[]'::jsonb),
        'outros', coalesce((select jsonb_agg(jsonb_build_object('nome', inf, 'tipo', tipo, 'vendas', n, 'faturamento', f) order by f desc)
          from (select inf, tipo, count(*) n, sum(liq) f from pp where tipo <> 'influencer' group by inf, tipo) o), '[]'::jsonb),
        'aquisicao', (select jsonb_build_object('novos', coalesce(sum(liq) filter (where novo), 0),
          'recorrentes', coalesce(sum(liq) filter (where not coalesce(novo, false)), 0),
          'desconto', coalesce(sum(case when perc > 0 and perc < 100 then liq * perc / (100 - perc) else 0 end), 0))
          from rec where tipo = 'influencer'),
        'serie', coalesce((select jsonb_agg(jsonb_build_object('dia', dia, 'faturamento', f) order by dia)
          from (select dia, sum(liq) f from pp where tipo = 'influencer' group by dia) s), '[]'::jsonb),
        'kpis', (select jsonb_build_object('faturamento', coalesce(sum(liq), 0), 'vendas', count(*),
          'ticket', coalesce(sum(liq) / nullif(count(*), 0), 0), 'ativos', count(distinct inf)) from pp where tipo = 'influencer')));
  end if;

  if p_setor = 'automacoes' then
    r := r || (with pp as (
        select dia, total - refunded_amount liq, cliente_hash,
          case when lower(coalesce(utm_source,'')) ~ 'whatsapp_api|wa_api' then 'whatsapp_api'
               when lower(coalesce(utm_source,'')) ~ 'whatsapp_org|grupos' then 'grupos'
               when lower(coalesce(utm_source,'')) ~ 'email|active' or lower(coalesce(utm_medium,'')) ~ 'email' then 'email' end canal
        from shopify_orders where is_test = false and financial_status in ('paid','partially_refunded')
          and dia between least(p_de, m_ini, seg - 56) and greatest(p_ate, m_fim, hoje)),
      disp as (select canal, to_date(periodo_num::text, 'YYYYMMDD') segunda, valor from valores_setor
               where escopo = 'automacoes' and metrica = 'disparos' and periodo = 'semana')
      select jsonb_build_object('canais', coalesce((select jsonb_agg(jsonb_build_object(
          'canal', c,
          'fat_mes', coalesce((select sum(liq) from pp where canal = c and dia between m_ini and m_fim), 0),
          'fat_periodo', coalesce((select sum(liq) from pp where canal = c and dia between p_de and p_ate), 0),
          'fat_semana', coalesce((select sum(liq) from pp where canal = c and dia between seg and seg + 6), 0),
          'fat_semana_anterior', coalesce((select sum(liq) from pp where canal = c and dia between seg - 7 and seg - 1), 0),
          'disparos_semana', coalesce((select valor from disp where canal = c and segunda = seg), 0),
          'disparos_semana_anterior', coalesce((select valor from disp where canal = c and segunda = seg - 7), 0),
          'disparos_mes', coalesce((select sum(valor) from disp where canal = c and segunda between m_ini - 6 and m_fim), 0),
          'melhor_dia', (select jsonb_build_object('dia', dia, 'valor', sum(liq)) from pp where canal = c and dia between m_ini and m_fim group by dia order by sum(liq) desc limit 1),
          'spark', (select coalesce(jsonb_agg(coalesce((select sum(liq) from pp where canal = c and dia between seg - 7 * i and seg - 7 * i + 6), 0) order by i desc), '[]'::jsonb)
                    from generate_series(0, 7) i)))
        from unnest(array['email','whatsapp_api','grupos']) c), '[]'::jsonb),
        'contribuicao_pct', (select coalesce(sum(liq) filter (where canal is not null) * 100 / nullif(sum(liq), 0), 0) from pp where dia between p_de and p_ate)));
  end if;

  if p_setor = 'social_media' then
    r := r || jsonb_build_object(
      'historico', coalesce((select jsonb_agg(jsonb_build_object('semana', semana, 'views', views, 'reach', reach,
          'interacoes', total_interactions, 'cliques', website_clicks, 'seguidores_liquidos', seguidores_liquidos) order by semana desc)
        from (select * from instagram_insights_semanal order by semana desc limit 12) h), '[]'::jsonb),
      'insights_periodo', public.central_ig_seguro(p_de, p_ate),
      'top_posts', (select value from app_config where key = 'instagram_top_posts'),
      'instagram', (select value from app_config where key = 'instagram_basic'));
    r := r || (with pp as (select o.*, o.total - o.refunded_amount liq from shopify_orders o where o.is_test = false
        and o.dia between p_de and p_ate and o.financial_status in ('paid','partially_refunded')),
      proxy as (select not exists (select 1 from pp where lower(coalesce(utm_source,'')) ~ 'instagram|(^|[^a-z])ig([^a-z]|$)|insta') v),
      soc as (select pp.* from pp, proxy where case when proxy.v then source_category = 'Orgânico' and nullif(trim(discount_code),'') is null
              else lower(coalesce(utm_source,'')) ~ 'instagram|(^|[^a-z])ig([^a-z]|$)|insta' end)
      select jsonb_build_object('usar_proxy', (select v from proxy),
        'vendas_link', jsonb_build_object('faturamento', coalesce((select sum(liq) from soc), 0), 'pedidos', (select count(*) from soc),
          'pct_do_total', coalesce((select sum(liq) from soc) * 100 / nullif((select sum(liq) from pp), 0), 0)),
        'split', coalesce((select jsonb_agg(jsonb_build_object('chave', k, 'faturamento', f, 'pedidos', n)) from (
          select case when lower(coalesce(utm_medium,'')) ~ 'live' then 'live'
                      when lower(coalesce(utm_source,'')) ~ 'igshopping|shopping' then 'shopping'
                      when lower(coalesce(utm_medium,'')) ~ 'stor' then 'stories' else 'bio' end k, sum(liq) f, count(*) n from soc group by 1) s), '[]'::jsonb),
        'produtos', coalesce((select jsonb_agg(jsonb_build_object('nome', nome, 'faturamento', f, 'unidades', u) order by f desc) from (
          select coalesce(nullif(trim(oi.nome_produto),''), oi.sku, '—') nome, sum(oi.preco * oi.quantidade) f, sum(oi.quantidade) u
          from shopify_order_items oi join soc on soc.id = oi.order_id group by 1 order by 2 desc limit 8) p), '[]'::jsonb),
        'serie', coalesce((select jsonb_agg(jsonb_build_object('dia', d, 'faturamento', coalesce((select sum(liq) from soc where dia = d::date), 0)) order by d)
          from generate_series(p_de, p_ate, interval '1 day') g(d)), '[]'::jsonb)));
  end if;

  if p_setor = 'atendimento' then
    r := r || jsonb_build_object(
      'historico', coalesce((select jsonb_agg(jsonb_build_object('semana', semana, 'volume', volume, 'tempo', tempo_resposta_min,
          'csat', csat, 'motivos', motivos) order by semana desc) from (select * from atendimento_metricas order by semana desc limit 20) h), '[]'::jsonb),
      'reembolso', (select jsonb_build_object('total', coalesce(reembolso_total, 0), 'pedidos', coalesce(pedidos_reembolsados, 0),
        'taxa', coalesce(taxa_reembolso_pct, 0), 'faturamento_bruto', coalesce(faturamento_bruto, 0)) from public.card_reembolso(p_de, p_ate)),
      'top_reembolsados', coalesce((select jsonb_agg(jsonb_build_object('nome', nome, 'valor', valor_reembolsado, 'unidades', unidades))
        from public.top_produtos_reembolsados(p_de, p_ate)), '[]'::jsonb));
  end if;

  return r;
end $$;
revoke all on function public.central_setor(text, text, date, date) from public;
grant execute on function public.central_setor(text, text, date, date) to anon, authenticated, service_role;

-- ======================================================================
-- Estoque: cobertura, ruptura, reposição, kits.
-- ======================================================================
create or replace function public.central_estoque(p_token text) returns jsonb
language plpgsql stable security definer set search_path = public, extensions as $$
declare
  hoje date := (now() at time zone 'America/Sao_Paulo')::date;
  cfg jsonb; critico int; alerta int; lead int; alvo int; excesso int;
begin
  if not public.central_ok(p_token) then raise exception 'token' using errcode = '28000'; end if;
  select value into cfg from app_config where key = 'estoque_thresholds';
  critico := coalesce((cfg->>'critico_dias')::int, 7);
  alerta  := coalesce((cfg->>'alerta_dias')::int, 15);
  lead    := coalesce((cfg->>'lead_time_dias')::int, 20);
  alvo    := coalesce((cfg->>'cobertura_alvo_dias')::int, 30);
  excesso := coalesce((cfg->>'excesso_dias')::int, 90);

  return (with r14 as (select sku, sum(unidades) un, sum(faturamento) fat from public.ranking_produtos(hoje - 13, hoje) where sku is not null group by 1),
    r7 as (select sku, sum(unidades) un from public.ranking_produtos(hoje - 6, hoje) where sku is not null group by 1),
    r7p as (select sku, sum(unidades) un from public.ranking_produtos(hoje - 13, hoje - 7) where sku is not null group by 1),
    it as (
      select p.sku, coalesce(p.nome_produto, p.sku) nome, p.estoque_atual estoque, p.atualizado_em,
        coalesce(r14.un, 0) / 14.0 vel,
        case when coalesce(r14.un, 0) > 0 then r14.fat / r14.un else 0 end preco,
        case when coalesce(r14.un, 0) > 0 then p.estoque_atual / (r14.un / 14.0) end cobertura,
        coalesce(r7.un, 0) / 7.0 va, coalesce(r7p.un, 0) / 7.0 vb,
        (select custo_unitario from produtos_cogs c where c.sku = p.sku and c.custo_unitario > 0 limit 1) custo
      from produtos_estoque p left join r14 on r14.sku = p.sku left join r7 on r7.sku = p.sku left join r7p on r7p.sku = p.sku),
    it2 as (
      select *, case when cobertura is null then 'sem_giro' when cobertura < critico then 'critico'
                     when cobertura < alerta then 'alerta' when cobertura > excesso then 'excesso' else 'ok' end status,
        case when va = 0 and vb = 0 then null when vb = 0 then 'subindo'
             when (va - vb) / vb > 0.1 then 'subindo' when (va - vb) / vb < -0.1 then 'caindo' else 'estavel' end tendencia
      from it),
    it3 as (
      select *, case when status in ('critico','alerta') then greatest(0, ceil(vel * (alvo + lead) - estoque)) else 0 end repor,
        case when status = 'excesso' then greatest(0, round(estoque - vel * excesso)) else 0 end excesso_un
      from it2)
    select jsonb_build_object(
      'itens', coalesce((select jsonb_agg(jsonb_build_object('sku', sku, 'nome', nome, 'estoque', estoque, 'atualizado_em', atualizado_em,
          'velocidade', vel, 'preco', preco, 'cobertura', cobertura,
          'ruptura_em', case when cobertura is not null then hoje + greatest(0, round(cobertura))::int end,
          'status', status, 'tendencia', tendencia, 'risco_dia', vel * preco, 'repor', repor, 'excesso', excesso_un,
          'custo', custo, 'capital', case when custo is not null then estoque * custo end)
        order by cobertura nulls last, nome) from it3), '[]'::jsonb),
      'config', jsonb_build_object('critico_dias', critico, 'alerta_dias', alerta, 'lead_time_dias', lead, 'cobertura_alvo_dias', alvo, 'excesso_dias', excesso),
      'kpis', (select jsonb_build_object(
        'ruptura', count(*) filter (where status = 'critico'), 'alerta', count(*) filter (where status = 'alerta'),
        'excesso', count(*) filter (where status = 'excesso'), 'excesso_unidades', coalesce(sum(excesso_un), 0),
        'produtos', count(*), 'unidades', coalesce(sum(estoque), 0), 'esgotados', count(*) filter (where estoque <= 0),
        'baixo', count(*) filter (where cobertura is not null and cobertura <= alerta),
        'primeira_ruptura', min(cobertura), 'capital', sum(estoque * custo) filter (where custo is not null),
        'sem_custo', count(*) filter (where custo is null)) from it3),
      'kits', coalesce((select jsonb_agg(jsonb_build_object('sku', 'kitimu', 'nome', 'Kit Imunidade',
          'componentes', (select jsonb_agg(jsonb_build_object('sku', sku, 'nome', nome, 'cobertura', cobertura, 'estoque', estoque) order by cobertura nulls last)
            from it3 where sku in ('80.1.9','80.1.3','80.1.2'))))), '[]'::jsonb),
      'sync_em', (select max(atualizado_em) from produtos_estoque)));
end $$;
revoke all on function public.central_estoque(text) from public;
grant execute on function public.central_estoque(text) to anon, authenticated, service_role;

-- ======================================================================
-- Cupons: os acompanhados, com vendas no período.
-- ======================================================================
create or replace function public.central_cupons(p_token text, p_de date, p_ate date) returns jsonb
language plpgsql stable security definer set search_path = public, extensions as $$
begin
  if not public.central_ok(p_token) then raise exception 'token' using errcode = '28000'; end if;
  return (with cup as (select upper(codigo) c, codigo, nome, tipo, percentual from cupons_acompanhados),
    pp as (select o.total - o.refunded_amount liq, cup.nome, cup.tipo, upper(trim(o.discount_code)) cod from shopify_orders o
           join cup on cup.c = upper(trim(coalesce(o.discount_code,'')))
           where o.is_test = false and o.dia between p_de and p_ate and o.financial_status in ('paid','partially_refunded'))
    select jsonb_build_object(
      'cadastro', coalesce((select jsonb_agg(jsonb_build_object('codigo', codigo, 'nome', nome, 'tipo', tipo, 'percentual', percentual) order by nome) from cup), '[]'::jsonb),
      'agrupados', coalesce((select jsonb_agg(jsonb_build_object('nome', nome, 'tipo', tipo, 'vendas', n, 'faturamento', f, 'codigos', cods) order by f desc)
        from (select nome, tipo, count(*) n, sum(liq) f, jsonb_agg(distinct cod) cods from pp group by nome, tipo) g), '[]'::jsonb)));
end $$;
revoke all on function public.central_cupons(text, date, date) from public;
grant execute on function public.central_cupons(text, date, date) to anon, authenticated, service_role;

-- ======================================================================
-- Alertas: as quatro regras de alertas.server.ts.
-- ======================================================================
create or replace function public.central_alertas(p_token text) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare
  hoje date := (now() at time zone 'America/Sao_Paulo')::date;
  m_ini date := date_trunc('month', hoje)::date;
  m_fim date := (date_trunc('month', hoje) + interval '1 month - 1 day')::date;
  dias int := extract(day from m_fim);
  dia_hoje int := extract(day from hoje);
  fracao numeric := dia_hoje::numeric / dias;
  out jsonb := '[]'::jsonb;
  cfg jsonb; critico int; alerta int;
  real_mes jsonb; ontem numeric; media numeric; inv numeric; roas numeric; breakeven numeric; margem numeric;
  m record;
begin
  if not public.central_ok(p_token) then raise exception 'token' using errcode = '28000'; end if;
  select value into cfg from app_config where key = 'estoque_thresholds';
  critico := coalesce((cfg->>'critico_dias')::int, 7); alerta := coalesce((cfg->>'alerta_dias')::int, 15);

  out := out || coalesce((with r as (select sku, sum(unidades) / 14.0 vel from public.ranking_produtos(hoje - 13, hoje) where sku is not null group by 1)
    select jsonb_agg(jsonb_build_object('id', 'estoque:' || p.sku,
      'severidade', case when p.estoque_atual / r.vel < critico then 'critico' else 'atencao' end,
      'titulo', coalesce(p.nome_produto, p.sku) || ': ' || replace(case when p.estoque_atual / r.vel < 10 then round(p.estoque_atual / r.vel, 1)::text else round(p.estoque_atual / r.vel)::text end, '.', ',') || ' dias de estoque',
      'detalhe', p.estoque_atual || ' un · giro ' || replace(round(r.vel, 1)::text, '.', ',') || ' un/dia · limite ' || critico || '/' || alerta || ' dias',
      'setor', 'Estoque', 'tela', 'estoque', 'sku', p.sku, 'cobertura', p.estoque_atual / r.vel) order by p.estoque_atual / r.vel)
    from produtos_estoque p join r on r.sku = p.sku where r.vel > 0 and p.estoque_atual / r.vel < alerta), '[]'::jsonb);

  real_mes := public.central_realizados(m_ini, hoje);
  inv := coalesce((real_mes->>'trafego||investimento')::numeric, 0);
  roas := coalesce((real_mes->>'trafego||roas_alvo')::numeric, 0);
  with pr as (select * from public.ranking_produtos(hoje - 89, hoje))
  select case when sum(pr.faturamento) filter (where c.custo_unitario > 0) > 0
              then (sum(pr.faturamento) filter (where c.custo_unitario > 0) - sum(c.custo_unitario * pr.unidades) filter (where c.custo_unitario > 0))
                   / sum(pr.faturamento) filter (where c.custo_unitario > 0) end
  into margem from pr left join produtos_cogs c on c.sku = pr.sku and c.custo_unitario > 0;
  breakeven := case when margem > 0 then 1 / margem end;
  if inv > 0 and breakeven is not null and roas > 0 and roas < breakeven then
    out := out || jsonb_build_object('id', 'trafego:breakeven', 'severidade', 'critico',
      'titulo', 'Tráfego no vermelho: ROAS ' || public.central_fmt(roas, 'x') || ' < equilíbrio ' || public.central_fmt(breakeven, 'x'),
      'detalhe', 'Margem bruta ' || round(margem * 100) || '% · investimento do mês ' || public.central_fmt(inv, 'R$'),
      'setor', 'Tráfego', 'tela', 'trafego');
  end if;

  for m in select escopo, coalesce(canal,'') canal, metrica, meta_valor, unidade from metas_kpi
    where periodo = 'mensal' and ano = extract(year from hoje) and periodo_num = extract(month from hoje) and meta_valor > 0
      and metrica not in ('ticket_medio','taxa_recompra','conversao','roas_alvo','cpa_alvo','pct_clientes_novos','tempo_medio_resposta','satisfacao')
  loop
    declare k text := m.escopo || '|' || m.canal || '|' || m.metrica; realizado numeric; previsto numeric; pct numeric; setor text; tela text; rot text;
    begin
      realizado := coalesce((real_mes->>k)::numeric,
        (select valor from valores_setor where escopo = m.escopo and coalesce(canal,'') = m.canal and metrica = m.metrica
           and periodo = 'mensal' and ano = extract(year from hoje) and periodo_num = extract(month from hoje)), 0);
      previsto := m.meta_valor * fracao;
      if previsto <= 0 or realizado >= previsto then continue; end if;
      pct := realizado * 100 / previsto;
      setor := case m.escopo when 'geral' then 'Vendas' when 'trafego' then 'Tráfego' when 'influenciadores' then 'Influenciadores'
                             when 'social_media' then 'Social Media' when 'automacoes' then 'Automações' when 'atendimento' then 'Atendimento' else m.escopo end;
      tela := case m.escopo when 'geral' then 'vendas' else m.escopo end;
      rot := case m.metrica when 'faturamento_mes' then 'Faturamento do mês' when 'faturamento_atribuido' then 'Faturamento atribuído'
        when 'investimento' then 'Investimento' when 'faturamento_influencer' then 'Faturamento via influencer'
        when 'influencers_ativos' then 'Nº influencers ativos' when 'seguidores_liquidos' then 'Seguidores líquidos'
        when 'visualizacoes' then 'Visualizações' when 'interacoes' then 'Interações' when 'cliques_link' then 'Cliques no link'
        when 'vendas_link' then 'Vendas pelo link' when 'faturamento' then (case m.canal when 'email' then 'E-mail' when 'whatsapp_api' then 'WhatsApp API' when 'grupos' then 'Grupos' else m.canal end) || ' — Faturamento'
        when 'disparos' then (case m.canal when 'email' then 'E-mail' when 'whatsapp_api' then 'WhatsApp API' when 'grupos' then 'Grupos' else m.canal end) || ' — Disparos'
        when 'volume_atendimentos' then 'Volume de atendimentos' else m.metrica end;
      out := out || jsonb_build_object('id', 'meta:' || k, 'severidade', case when pct < 80 then 'critico' else 'atencao' end,
        'titulo', setor || ' · ' || rot || ' fora do ritmo (' || round(pct) || '% do previsto)',
        'detalhe', 'Realizado ' || public.central_fmt(realizado, m.unidade) || ' · previsto até hoje ' || public.central_fmt(previsto, m.unidade) || ' · meta do mês ' || public.central_fmt(m.meta_valor, m.unidade),
        'setor', setor, 'tela', tela, 'chave', k, 'realizado', realizado, 'previsto', previsto, 'meta', m.meta_valor, 'unidade', m.unidade, 'pct', pct);
    end;
  end loop;

  select coalesce(sum(total - refunded_amount), 0) into ontem from shopify_orders
  where is_test = false and dia = hoje - 1 and financial_status in ('paid','partially_refunded');
  select coalesce(sum(total - refunded_amount), 0) / 7 into media from shopify_orders
  where is_test = false and dia between hoje - 8 and hoje - 2 and financial_status in ('paid','partially_refunded');
  if media > 0 and ontem < media * 0.6 then
    out := out || jsonb_build_object('id', 'vendas:queda', 'severidade', 'atencao',
      'titulo', 'Queda de faturamento: ontem ' || public.central_fmt(ontem, 'R$') || ' (' || round(ontem * 100 / media) || '% da média)',
      'detalhe', 'Média dos 7 dias anteriores ' || public.central_fmt(media, 'R$'),
      'setor', 'Vendas', 'tela', 'vendas');
  end if;

  return (select coalesce(jsonb_agg(a order by case a->>'severidade' when 'critico' then 0 else 1 end), '[]'::jsonb)
          from jsonb_array_elements(out) a);
end $$;
revoke all on function public.central_alertas(text) from public;
grant execute on function public.central_alertas(text) to anon, authenticated, service_role;



-- ======================================================================
-- KPIs semanais: a janela (padrão seg→hoje), a anterior, 8 janelas de
-- tendência, e as ações. Tradução de kpis.functions.ts.
-- ======================================================================
create or replace function public.central_kpis(p_token text, p_de date, p_ate date) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare
  hoje date := (now() at time zone 'America/Sao_Paulo')::date;
  dur int := (p_ate - p_de) + 1;
  a_de date := p_de - dur; a_ate date := p_de - 1;
  jan jsonb := '[]'::jsonb; i int;
  r jsonb;
begin
  if not public.central_ok(p_token) then raise exception 'token' using errcode = '28000'; end if;

  for i in reverse 7..0 loop
    jan := jan || (with w as (select (p_de - dur * i) de, (p_de - dur * i + dur - 1) ate),
      pp as (select o.*, o.total - o.refunded_amount liq from shopify_orders o, w
             where o.is_test = false and o.dia between w.de and w.ate and o.financial_status in ('paid','partially_refunded')),
      prim as (select cliente_hash, min(dia) primeiro from shopify_orders where is_test = false and financial_status in ('paid','partially_refunded') and cliente_hash is not null group by 1)
      select jsonb_build_object('de', w.de, 'ate', w.ate, 'rotulo', to_char(w.de, 'DD/MM'),
        'faturamento', coalesce((select sum(liq) from pp), 0), 'pedidos', (select count(*) from pp),
        'ticket', coalesce((select sum(liq) / nullif(count(*), 0) from pp), 0),
        'sessoes', (select sum(sessions) from kpi_sessions_diarias where dia between w.de and w.ate),
        'conversao', (select case when sum(sessions) > 0 then (select count(*) from pp)::numeric * 100 / sum(sessions) end from kpi_sessions_diarias where dia between w.de and w.ate),
        'frete_pct', (select case when count(*) > 0 then count(*) filter (where total >= 349)::numeric * 100 / count(*) end from pp),
        'recorrentes_pct', (select case when count(*) > 0 then count(*) filter (where pr.primeiro < w.de)::numeric * 100 / count(*) end
          from pp left join prim pr on pr.cliente_hash = pp.cliente_hash where pp.cliente_hash is not null),
        'recompra', (select taxa_recompra_pct from public.recompra(w.de, w.ate)))
      from w);
  end loop;

  return jsonb_build_object(
    'janela', jan->7, 'anterior', jan->6, 'tendencia', jan, 'hoje', hoje,
    'recompra', (select jsonb_build_object('taxa', taxa_recompra_pct, 'recompradores', recompradores, 'clientes', clientes_periodo) from public.recompra(p_de, p_ate)),
    'metas', (select jsonb_build_object(
      'faturamento', (select (array[meta1, meta2, meta3])[meta_ativa] * dur / extract(day from (date_trunc('month', p_ate) + interval '1 month - 1 day'))
        from metas_mensais where ano = extract(year from p_ate) and mes = extract(month from p_ate)),
      'ticket_medio', (select meta_valor from metas_kpi where periodo = 'mensal' and escopo = 'geral' and metrica = 'ticket_medio' and ano = extract(year from p_ate) and periodo_num = extract(month from p_ate)),
      'taxa_recompra', (select meta_valor from metas_kpi where periodo = 'mensal' and escopo = 'geral' and metrica = 'taxa_recompra' and ano = extract(year from p_ate) and periodo_num = extract(month from p_ate)),
      'conversao', (select meta_valor from metas_kpi where periodo = 'mensal' and escopo = 'geral' and metrica = 'conversao' and ano = extract(year from p_ate) and periodo_num = extract(month from p_ate)))),
    'dias', coalesce((select jsonb_agg(jsonb_build_object('dia', d, 'faturamento', coalesce(rd.faturamento, 0), 'pedidos', coalesce(rd.pedidos, 0)) order by d)
      from generate_series(p_de, p_ate, interval '1 day') g(d) left join public.ranking_dias(p_de, p_ate) rd on rd.dia = g.d::date), '[]'::jsonb),
    'frete', (with pp as (select total from shopify_orders where is_test = false and dia between p_de and p_ate and financial_status in ('paid','partially_refunded'))
      select jsonb_build_object('pedidos', count(*), 'na_faixa', count(*) filter (where total >= 300 and total < 349),
        'pct_faixa', coalesce(count(*) filter (where total >= 300 and total < 349)::numeric * 100 / nullif(count(*), 0), 0),
        'gap_medio', avg(349 - total) filter (where total >= 300 and total < 349)) from pp),
    'produtos', coalesce((select jsonb_agg(jsonb_build_object('nome', r.nome, 'sku', r.sku, 'faturamento', r.faturamento, 'unidades', r.unidades,
        'estoque', e.estoque_atual, 'risco', e.estoque_atual < 30) order by r.faturamento desc)
      from (select * from public.ranking_produtos(p_de, p_ate) limit 8) r left join produtos_estoque e on e.sku = r.sku), '[]'::jsonb),
    'sem_voltar', (with u as (select cliente_hash, max(dia) ultima from shopify_orders where is_test = false and financial_status in ('paid','partially_refunded')
        and cliente_hash is not null and dia between p_ate - 400 and p_ate group by 1)
      select count(*) from u where ultima between p_ate - 60 and p_ate - 30));
end $$;
revoke all on function public.central_kpis(text, date, date) from public;
grant execute on function public.central_kpis(text, date, date) to anon, authenticated, service_role;

-- ======================================================================
-- Gravar: metas, realizados manuais, cupons, limites do estoque.
-- ======================================================================
create or replace function public.central_gravar(p_token text, p_acao text, p_dados jsonb) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare d jsonb := coalesce(p_dados, '{}'::jsonb);
begin
  if not public.central_ok(p_token) then raise exception 'token' using errcode = '28000'; end if;

  if p_acao = 'meta_mensal' then
    insert into metas_mensais (ano, mes, meta1, meta2, meta3, meta_ativa)
    values ((d->>'ano')::int, (d->>'mes')::int, coalesce((d->>'meta1')::numeric, 0), coalesce((d->>'meta2')::numeric, 0),
            coalesce((d->>'meta3')::numeric, 0), least(3, greatest(1, coalesce((d->>'meta_ativa')::int, 1))))
    on conflict (ano, mes) do update set meta1 = excluded.meta1, meta2 = excluded.meta2, meta3 = excluded.meta3,
      meta_ativa = excluded.meta_ativa, updated_at = now();
    return jsonb_build_object('ok', true);

  elsif p_acao = 'meta_ativa' then
    update metas_mensais set meta_ativa = least(3, greatest(1, (d->>'meta_ativa')::int)), updated_at = now()
    where ano = (d->>'ano')::int and mes = (d->>'mes')::int;
    return jsonb_build_object('ok', true);

  elsif p_acao = 'meta_kpi' then
    if d->>'meta_valor' is null then
      delete from metas_kpi where escopo = d->>'escopo' and coalesce(canal,'') = coalesce(d->>'canal','') and metrica = d->>'metrica'
        and periodo = coalesce(d->>'periodo', 'mensal') and ano = (d->>'ano')::int and periodo_num = (d->>'periodo_num')::int;
    else
      insert into metas_kpi (escopo, canal, metrica, periodo, ano, periodo_num, meta_valor, unidade)
      values (d->>'escopo', coalesce(d->>'canal',''), d->>'metrica', coalesce(d->>'periodo','mensal'), (d->>'ano')::int, (d->>'periodo_num')::int,
              greatest(0, (d->>'meta_valor')::numeric), d->>'unidade')
      on conflict (escopo, canal, metrica, periodo, ano, periodo_num) do update set meta_valor = excluded.meta_valor,
        unidade = coalesce(excluded.unidade, metas_kpi.unidade), updated_at = now();
    end if;
    return jsonb_build_object('ok', true);

  elsif p_acao = 'valor_setor' then
    insert into valores_setor (escopo, canal, metrica, periodo, ano, periodo_num, valor)
    values (d->>'escopo', coalesce(d->>'canal',''), d->>'metrica', coalesce(d->>'periodo','mensal'), (d->>'ano')::int, (d->>'periodo_num')::int,
            greatest(0, (d->>'valor')::numeric))
    on conflict (escopo, canal, metrica, periodo, ano, periodo_num) do update set valor = excluded.valor, updated_at = now();
    return jsonb_build_object('ok', true);

  elsif p_acao = 'cupom' then
    insert into cupons_acompanhados (codigo, nome, tipo, percentual)
    values (upper(trim(d->>'codigo')), trim(d->>'nome'), d->>'tipo', (d->>'percentual')::numeric)
    on conflict (codigo) do update set nome = excluded.nome, tipo = excluded.tipo, percentual = excluded.percentual, updated_at = now();
    return jsonb_build_object('ok', true);

  elsif p_acao = 'cupom_excluir' then
    delete from cupons_acompanhados where codigo = upper(trim(d->>'codigo'));
    return jsonb_build_object('ok', true);

  elsif p_acao = 'estoque_config' then
    insert into app_config (key, value) values ('estoque_thresholds', d)
    on conflict (key) do update set value = excluded.value, updated_at = now();
    return jsonb_build_object('ok', true);

  elsif p_acao = 'sessoes' then
    insert into kpi_sessions_diarias (dia, sessions, checkouts, atualizado_em)
    values ((d->>'dia')::date, (d->>'sessions')::int, (d->>'checkouts')::int, now())
    on conflict (dia) do update set sessions = excluded.sessions, checkouts = excluded.checkouts, atualizado_em = now();
    return jsonb_build_object('ok', true);

  elsif p_acao = 'atendimento_semana' then
    insert into atendimento_metricas (semana, volume, tempo_resposta_min, csat, motivos, atualizado_em)
    values ((d->>'semana')::date, coalesce((d->>'volume')::int, 0), coalesce((d->>'tempo')::numeric, 0),
            least(100, greatest(0, coalesce((d->>'csat')::numeric, 0))), coalesce(d->'motivos', '{}'::jsonb), now())
    on conflict (semana) do update set volume = excluded.volume, tempo_resposta_min = excluded.tempo_resposta_min,
      csat = excluded.csat, motivos = excluded.motivos, atualizado_em = now();
    return jsonb_build_object('ok', true);
  end if;

  return jsonb_build_object('ok', false, 'erro', 'ação desconhecida: ' || coalesce(p_acao, ''));
end $$;
revoke all on function public.central_gravar(text, text, jsonb) from public;
grant execute on function public.central_gravar(text, text, jsonb) to anon, authenticated, service_role;
