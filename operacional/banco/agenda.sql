-- ======================================================================
-- A agenda de cada pessoa.
--
-- Cada um liga o próprio calendário e vê a semana dele dentro da
-- Central, junto com as tarefas e a rotina do dia.
--
-- Por que o endereço secreto do iCal e não "entrar com o Google": o
-- escopo de leitura de calendário é sensível no Google, e um aplicativo
-- não verificado só funciona em modo de teste — onde a autorização
-- expira a cada sete dias. A equipe teria que reconectar toda semana.
-- O endereço secreto funciona hoje, sem projeto no Google Cloud, sem
-- verificação e sem expirar; vale para o Notion Calendar, que roda em
-- cima de uma conta Google, e para o Outlook, que publica o mesmo
-- formato. O preço é ser leitura, e o Google atualizar o arquivo com
-- algumas horas de atraso.
--
-- O endereço é uma credencial: quem o tiver lê aquela agenda até o dono
-- gerar outro. Então ele mora aqui, cada linha visível só para o dono, e
-- quem o usa é a função /api/agenda no servidor. Ele nunca desce para o
-- navegador depois de salvo.
-- ======================================================================

create table if not exists public.agenda_fonte (
  dono        uuid primary key references auth.users(id) on delete cascade,
  url         text not null,
  apelido     text,
  eventos     jsonb not null default '[]'::jsonb,   -- o que a última leitura trouxe
  lido_em     timestamptz,
  erro        text,
  criado_em   timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

alter table public.agenda_fonte enable row level security;

-- Sem política de leitura para mais ninguém: a agenda de cada um é dele.
-- Nem admin lê a do outro por aqui — quem precisar combina pelo
-- calendário, que é onde essas coisas se combinam.
create policy agenda_fonte_dono on public.agenda_fonte
  for all using (dono = (select auth.uid())) with check (dono = (select auth.uid()));

create or replace function app.agenda_tocada() returns trigger
language plpgsql as $$
begin
  new.atualizado_em := now();
  return new;
end $$;

drop trigger if exists agenda_tocada on public.agenda_fonte;
create trigger agenda_tocada before update on public.agenda_fonte
  for each row execute function app.agenda_tocada();
