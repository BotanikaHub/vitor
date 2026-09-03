import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';

/** O Supabase visto do servidor, com a sessão vinda do cookie. */
export async function clienteServidor() {
  const jar = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
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
