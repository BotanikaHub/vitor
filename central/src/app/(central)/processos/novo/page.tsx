import Link from 'next/link';
import { sessaoAtual } from '@/lib/sessao';
import { clienteServidor } from '@/lib/supabase/servidor';
import { FormaProcesso } from './FormaProcesso';
import type { Area } from '@/lib/tipos';

export const metadata = { title: 'Novo processo · Central' };
export const dynamic = 'force-dynamic';

export default async function NovoProcesso() {
  const s = await sessaoAtual();
  const supabase = await clienteServidor();
  const { data: areas } = await supabase.from('areas').select('*').order('ordem');

  return (
    <div className="mx-auto max-w-[820px]">
      <Link href="/processos" className="text-[12px] text-tinta-2 underline underline-offset-2">
        ← Processos
      </Link>
      <h1 className="mb-1 mt-3 text-[20px] font-semibold tracking-[-0.02em]">
        Escrever um processo
      </h1>
      <p className="mb-5 text-[13px] text-tinta-2">
        Se for difícil de escrever, ninguém escreve. Comece pelo que você
        mais explica repetido.
      </p>
      <FormaProcesso
        areas={(areas ?? []) as Area[]}
        minhaArea={s.perfil.area_id}
      />
    </div>
  );
}
