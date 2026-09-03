import { NextResponse, type NextRequest } from 'next/server';
import { clienteServidor } from '@/lib/supabase/servidor';

export async function POST(req: NextRequest) {
  const supabase = await clienteServidor();
  await supabase.auth.signOut();
  return NextResponse.redirect(new URL('/entrar', req.url), { status: 303 });
}

/* Também por GET: sair de uma sessão quebrada não pode depender de um
   formulário funcionar. */
export async function GET(req: NextRequest) {
  const supabase = await clienteServidor();
  await supabase.auth.signOut();
  return NextResponse.redirect(new URL('/entrar', req.url), { status: 303 });
}
