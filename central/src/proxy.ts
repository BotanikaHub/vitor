import { NextResponse, type NextRequest } from 'next/server';
import { renovarSessao } from '@/lib/supabase/proxy';

const PUBLICAS = ['/entrar', '/cadastro', '/auth'];

export async function proxy(req: NextRequest) {
  const { resposta, user } = await renovarSessao(req);
  const caminho = req.nextUrl.pathname;
  const publica = PUBLICAS.some((p) => caminho === p || caminho.startsWith(p + '/'));

  /* Sem sessão, só as páginas públicas. A guarda vive aqui e não em cada
     página para não haver tela que alguém esqueceu de proteger. */
  if (!user && !publica) {
    const destino = req.nextUrl.clone();
    destino.pathname = '/entrar';
    destino.searchParams.set('de', caminho);
    return NextResponse.redirect(destino);
  }
  if (user && publica && caminho !== '/auth/sair') {
    const destino = req.nextUrl.clone();
    destino.pathname = '/';
    destino.search = '';
    return NextResponse.redirect(destino);
  }
  return resposta;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)'],
};
