/** Onde fica o Supabase da operação.
 *
 *  Os dois valores são públicos por natureza: a URL é um endereço e a
 *  chave publicável chega ao navegador de qualquer jeito — ela já está,
 *  hoje, dentro do planejador antigo servido em texto puro. Quem segura
 *  o acesso é o RLS do banco.
 *
 *  Ficam aqui como padrão para o app subir sem depender de alguém ter
 *  lembrado de preencher a variável no painel. A variável, quando
 *  existe, ganha — é assim que se aponta para outro projeto sem tocar
 *  no código. */
export const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  'https://sjkuysdmixfzeerxuudn.supabase.co';

export const SUPABASE_ANON =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNqa3V5c2RtaXhmemVlcnh1dWRuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODExMTMxNDQsImV4cCI6MjA5NjY4OTE0NH0.oMbvy25V6-W7YvF70zNb1xVfRwH_tGBWp3NPHGtpOtM';
