import { sessaoAtual } from '@/lib/sessao';

export const metadata = { title: 'Planejador · Central' };

/** O planejador de sempre, agora dentro da Central: mesmo endereço,
 *  mesma navegação, atrás do mesmo login.
 *
 *  Ele entra num quadro próprio porque ainda é a página de um arquivo só,
 *  com o estilo e o estado dela. As telas vão saindo daqui e virando
 *  página nativa uma a uma — mapa mental, mês, semana, campanhas — sem
 *  que ninguém fique sem ferramenta enquanto isso acontece. */
export default async function Planejador() {
  await sessaoAtual();
  return (
    <div className="-mx-5 -my-6">
      <iframe
        src="/planejador/index.html"
        title="Planejador"
        className="block h-[calc(100dvh-97px)] w-full border-0"
      />
    </div>
  );
}
