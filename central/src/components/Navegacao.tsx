'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { SECOES } from '@/lib/secoes';

/** A navegação. As seções que ainda não existem aparecem apagadas em vez
 *  de sumirem: é o mapa do que vem, e evita a pergunta "cadê". */


export function Navegacao() {
  const aqui = usePathname();
  return (
    <nav className="-mb-px flex gap-1 overflow-x-auto">
      {SECOES.map((s) => {
        const ativa = s.href === '/' ? aqui === '/' : aqui.startsWith(s.href);
        const base =
          'whitespace-nowrap border-b-2 px-3 py-2.5 text-[13px] transition';
        if (!s.pronta) {
          return (
            <span
              key={s.href}
              title="Ainda não construída"
              className={base + ' cursor-default border-transparent text-tinta-3'}
            >
              {s.nome}
            </span>
          );
        }
        return (
          <Link
            key={s.href}
            href={s.href}
            className={
              base +
              (ativa
                ? ' border-tinta font-medium text-tinta'
                : ' border-transparent text-tinta-2 hover:text-tinta')
            }
          >
            {s.nome}
          </Link>
        );
      })}
    </nav>
  );
}
