'use client';

import { createBrowserClient } from '@supabase/ssr';

/** O Supabase visto do navegador. A chave é publicável de propósito:
 *  ela chega ao cliente de qualquer jeito, e quem segura o acesso é o
 *  RLS do banco, não o segredo da chave. */
export function clienteNavegador() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
