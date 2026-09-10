-- ======================================================================
-- O primeiro acesso de cada pessoa.
--
-- Antes, criar uma conta era abrir o Supabase e cadastrar na mão, um a
-- um. Agora a pessoa mesma cria a dela na tela de entrar — mas isso só
-- vale a pena se a tela souber, ANTES de criar, se o e-mail digitado
-- está na lista de convites. Sem isso o `ass.italoneves@gmail.com` que
-- vira `italoneves@gmail.com` cria uma conta que nasce sem acesso, não
-- diz por quê, e sobra para o Vitor limpar.
--
-- A lista tem RLS: só quem já está dentro lê. Quem está criando a conta
-- ainda não está dentro. Então esta função — e só ela — responde de
-- fora, devolvendo o mínimo que a tela precisa mostrar.
--
-- O que ela entrega a um desconhecido: dado um e-mail exato, se ele é da
-- equipe e o nome de quem é. Quem já sabe o e-mail de alguém daqui
-- normalmente já sabe o nome; e ver "Cadastro de Ítalo Neves" é o que
-- garante que a pessoa não digitou o endereço errado. Papel, área e
-- marcas não saem — isso é de dentro.
-- ======================================================================

create or replace function public.convite_de(p_email text)
returns jsonb
language plpgsql
security definer
stable
set search_path to 'public', 'pg_temp'
as $$
declare
  e text := lower(trim(coalesce(p_email, '')));
  c public.equipe_convites%rowtype;
begin
  if e !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then
    return jsonb_build_object('erro', 'email');
  end if;

  select * into c from public.equipe_convites where email = e;

  return jsonb_build_object(
    'convidado',    c.email is not null,
    'nome',         coalesce(c.nome, ''),
    'ja_tem_conta', exists (select 1 from auth.users u where lower(u.email) = e)
  );
end $$;

revoke execute on function public.convite_de(text) from public;
grant  execute on function public.convite_de(text) to anon, authenticated;
