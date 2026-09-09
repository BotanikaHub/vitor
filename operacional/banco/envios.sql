-- ======================================================================
-- Quantas mensagens saíram, por canal e por dia.  (base da Central)
--
-- Aplicado em sjkuysdmixfzeerxuudn como a migração central_envios_por_canal.
--
-- Estes números já chegavam aqui e ninguém lia:
--
--   public.emails          o fluxo do n8n "[Botanika] Fluxo - ActiveCampaign
--                          - Campanhas de E-mail -> Supabase" grava cada
--                          campanha com data e envios.
--   public.meta_whatsapp   o fluxo "[Botanika] Report - Meta API" grava o
--                          WhatsApp API por dia, com mensagens enviadas,
--                          entregues e gasto em reais.
--   public.disparos_manual tabela de digitar à mão, para os grupos —
--                          o fluxo do SendFlow que existe traz composição
--                          de grupo, não disparo.
--
-- Enquanto isso, "mensagens enviadas" e "gastos" apareciam no painel como
-- campo de digitar. Esta função devolve com as mesmas chaves que o painel
-- usa, para entrar direto no realizado do período, sem tradução no meio.
-- ======================================================================
create or replace function public.central_envios(p_marca text, p_de date, p_ate date)
returns jsonb
language plpgsql
security definer
set search_path = public, app
as $$
declare
  email_envios numeric := 0;
  api_envios numeric := 0;
  api_gastos numeric := 0;
  api_entregues numeric := 0;
  grupos_envios numeric := 0;
begin
  if not app.estou_ativo() then
    raise exception 'sem acesso' using errcode = '42501';
  end if;
  if p_de is null or p_ate is null or p_ate < p_de then return '{}'::jsonb; end if;

  -- Por enquanto estas tabelas são todas da Botanika: nenhuma delas tem
  -- coluna de marca. No dia em que a VermeFree tiver as suas, é aqui que
  -- elas entram — e não numa cópia desta função.
  if coalesce(p_marca, '') <> 'Botanika' then return '{}'::jsonb; end if;

  select coalesce(sum(nullif(regexp_replace(coalesce(envios, ''), '[^0-9]', '', 'g'), '')::numeric), 0)
    into email_envios
    from emails where data between p_de and p_ate;

  select coalesce(sum(mensagens_enviadas), 0), coalesce(sum(gasto_brl), 0), coalesce(sum(mensagens_entregues), 0)
    into api_envios, api_gastos, api_entregues
    from meta_whatsapp where data between p_de and p_ate;

  select coalesce(sum(mensagens_disparadas), 0)
    into grupos_envios
    from disparos_manual
   where data between p_de and p_ate and lower(coalesce(canal, '')) ~ 'whatsapp_org|grupo';

  return jsonb_strip_nulls(jsonb_build_object(
    'automacoes|email|disparos',         nullif(email_envios, 0),
    'automacoes|whatsapp_api|disparos',  nullif(api_envios, 0),
    'automacoes|whatsapp_api|entregues', nullif(api_entregues, 0),
    'automacoes|whatsapp_api|gastos',    nullif(api_gastos, 0),
    'automacoes|grupos|disparos',        nullif(grupos_envios, 0)));
end $$;

revoke all on function public.central_envios(text, date, date) from public, anon;
grant execute on function public.central_envios(text, date, date) to authenticated;
