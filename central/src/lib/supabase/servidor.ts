import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { SUPABASE_URL, SUPABASE_ANON } from '@/lib/supabase/projeto';

/** O Supabase visto do servidor, com a sessão vinda do cookie. */
export async function clienteServidor() {
  const jar = await cookies();
  return createServerClient(
    SUPABASE_URL,
    SUPABASE_ANON,
    {
      cookies: {
        getAll: () => jar.getAll(),
        setAll: (novos) => {
          try {
            novos.forEach(({ name, value, options }) => jar.set(name, value, options));
          } catch {
            /* Server Component não escreve cookie. Quem renova a sessão
               é o middleware; aqui o silêncio é o comportamento certo. */
          }
        },
      },
    },
  );
}
