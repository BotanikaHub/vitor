-- ======================================================================
-- A pasta do Drive de cada marca.
--
-- O id da pasta não é segredo — o acesso é, e ele mora no Google, na
-- lista de quem pode ver aquela pasta. Por isso o id fica aqui, na ficha
-- da marca que já existia, e não numa variável de ambiente: assim dá
-- para ligar e trocar a pasta pela própria tela, sem mexer na Vercel.
--
-- Quem lê a pasta é /api/drive, com a conta de serviço cuja chave vive
-- em GOOGLE_DRIVE_SA e nunca desce para o navegador.
-- ======================================================================

alter table public.painel_marcas add column if not exists drive_pasta text;

comment on column public.painel_marcas.drive_pasta is
  'Id da pasta do Google Drive daquela marca. Quem lê é /api/drive, com a conta de serviço; o id não é segredo, o acesso é.';
