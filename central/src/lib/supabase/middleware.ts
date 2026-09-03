import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';

/** Renova a sessão a cada navegação e devolve o usuário.
 *  Sem isto o token expira e a pessoa é deslogada no meio do trabalho. */
export async function renovarSessao(req: NextRequest) {
  let resposta = NextResponse.next({ request: req });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => req.cookies.getAll(),
        setAll: (novos) => {
          novos.forEach(({ name, value }) => req.cookies.set(name, value));
          resposta = NextResponse.next({ request: req });
          novos.forEach(({ name, value, options }) =>
            resposta.cookies.set(name, value, options));
        },
      },
    },
  );

  /* getUser e não getSession: só o getUser confere o token com o
     servidor de autenticação. O getSession acredita no cookie. */
  const { data: { user } } = await supabase.auth.getUser();
  return { resposta, user };
}
