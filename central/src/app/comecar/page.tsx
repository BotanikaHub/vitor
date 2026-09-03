import { redirect } from 'next/navigation';
import { clienteServidor } from '@/lib/supabase/servidor';
import { EscolherArea } from './EscolherArea';
import { Marca } from '@/components/Marca';
import { cartao } from '@/lib/design';
import type { Area } from '@/lib/tipos';

export const metadata = { title: 'Sua área · Central' };

/** Um passo só, na primeira entrada: de que área a pessoa é. É ela que
 *  decide quais processos, metas e tarefas fazem sentido mostrar. */
export default async function Comecar() {
  const supabase = await clienteServidor();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/entrar');

  const { data: perfil } = await supabase
    .from('profiles').select('nome, area_id, ativo').eq('id', user.id).single();

  if (!perfil?.ativo) redirect('/espera');
  if (perfil.area_id) redirect('/');

  const { data: areas } = await supabase.from('areas').select('*').order('ordem');

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-5 py-12">
      <div className="w-full max-w-[460px]">
        <div className="mb-8 flex justify-center"><Marca /></div>
        <div className={cartao + ' p-6'}>
          <h1 className="text-[17px] font-semibold tracking-[-0.01em]">
            De que área você é{perfil.nome ? `, ${perfil.nome.split(' ')[0]}` : ''}?
          </h1>
          <p className="mt-2 mb-5 text-[13px] leading-relaxed text-tinta-2">
            É o que define os processos, as metas e as tarefas que aparecem
            para você. Depois disso, mudar de área é decisão de gestão.
          </p>
          <EscolherArea areas={(areas ?? []) as Area[]} />
        </div>
      </div>
    </main>
  );
}
