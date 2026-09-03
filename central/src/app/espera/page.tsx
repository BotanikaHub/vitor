import { clienteServidor } from '@/lib/supabase/servidor';
import { redirect } from 'next/navigation';
import { Marca } from '@/components/Marca';
import { cartao, botaoLeve } from '@/lib/design';

export const metadata = { title: 'Aguardando liberação · Central' };

/** Conta criada, acesso ainda não. Esta tela existe para a pessoa saber
 *  que não é erro dela — e para não ficar batendo numa tela em branco. */
export default async function Espera() {
  const supabase = await clienteServidor();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/entrar');

  const { data: perfil } = await supabase
    .from('profiles').select('nome, ativo').eq('id', user.id).single();

  if (perfil?.ativo) redirect('/');

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-5 py-12">
      <div className="w-full max-w-[420px]">
        <div className="mb-8 flex justify-center"><Marca /></div>
        <div className={cartao + ' p-6'}>
          <h1 className="text-[17px] font-semibold tracking-[-0.01em]">
            Falta a liberação do acesso
          </h1>
          <p className="mt-3 text-[13px] leading-relaxed text-tinta-2">
            Sua conta está criada{perfil?.nome ? `, ${perfil.nome}` : ''}. Um
            administrador precisa liberar o acesso e definir a sua área e as
            marcas em que você trabalha.
          </p>
          <p className="mt-3 text-[13px] leading-relaxed text-tinta-2">
            É esse passo que impede que qualquer pessoa que descubra o
            endereço entre na operação.
          </p>
          <form action="/auth/sair" method="post" className="mt-5">
            <button className={botaoLeve}>Sair</button>
          </form>
        </div>
      </div>
    </main>
  );
}
