'use client';

import { createBrowserClient } from '@supabase/ssr';
import { SUPABASE_URL, SUPABASE_ANON } from '@/lib/supabase/projeto';

/** O Supabase visto do navegador. A chave é publicável de propósito:
 *  ela chega ao cliente de qualquer jeito, e quem segura o acesso é o
 *  RLS do banco, não o segredo da chave. */
export function clienteNavegador() {
  return createBrowserClient(
    SUPABASE_URL,
    SUPABASE_ANON,
  );
}
