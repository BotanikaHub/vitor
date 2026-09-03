import { redirect } from 'next/navigation';
import { sessaoAtual } from '@/lib/sessao';
import { Marca } from '@/components/Marca';
import { Navegacao } from '@/components/Navegacao';
import { TrocarMarca } from '@/components/TrocarMarca';
import { MenuPessoa } from '@/components/MenuPessoa';

/** A casca de tudo que fica atrás do login. Lê a sessão uma vez e passa
 *  adiante; as páginas de dentro não repetem essa consulta. */
export default async function CascaCentral({ children }: { children: React.ReactNode }) {
  const s = await sessaoAtual();
  if (!s.perfil.ativo) redirect('/espera');
  if (!s.perfil.area_id) redirect('/comecar');

  return (
    <div
      className="min-h-dvh"
      /* a cor de foco acompanha a marca em cartaz */
      style={{ ['--acento' as string]: s.marcaAtiva?.cor ?? '#18181b' }}
    >
      <header className="sticky top-0 z-20 border-b border-linha bg-papel/85 backdrop-blur">
        <div className="mx-auto flex max-w-[1240px] items-center gap-3 px-5 pt-3">
          <Marca nome={s.marcaAtiva?.nome} cor={s.marcaAtiva?.cor} />
          <div className="ml-auto flex items-center gap-2">
            <TrocarMarca marcas={s.marcas} ativa={s.marcaAtiva} />
            <MenuPessoa perfil={s.perfil} area={s.area} />
          </div>
        </div>
        <div className="mx-auto max-w-[1240px] px-5">
          <Navegacao />
        </div>
      </header>
      <main className="mx-auto max-w-[1240px] px-5 py-6">{children}</main>
    </div>
  );
}
