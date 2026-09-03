import { NextResponse, type NextRequest } from 'next/server';
import { COOKIE_MARCA } from '@/lib/sessao';

/** Troca a marca em cartaz. Vai num cookie porque a escolha precisa
 *  valer já na renderização do servidor — se fosse estado do navegador,
 *  a primeira pintura viria com a marca errada. */
export async function POST(req: NextRequest) {
  const { slug } = await req.json().catch(() => ({ slug: '' }));
  if (typeof slug !== 'string' || !/^[a-z0-9-]{1,60}$/.test(slug)) {
    return NextResponse.json({ erro: 'marca inválida' }, { status: 400 });
  }
  const r = NextResponse.json({ ok: true });
  r.cookies.set(COOKIE_MARCA, slug, {
    path: '/',
    sameSite: 'lax',
    httpOnly: false,
    maxAge: 60 * 60 * 24 * 365,
  });
  return r;
}
