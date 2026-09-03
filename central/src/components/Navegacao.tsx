'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

/** As seções da plataforma. As que ainda não existem aparecem apagadas
 *  em vez de sumirem: é o mapa do que vem, e evita a pergunta "cadê". */
export const SECOES = [
  { href: '/',           nome: 'Início',      pronta: true  },
  { href: '/tarefas',    nome: 'Tarefas',     pronta: false },
  { href: '/semana',     nome: 'Semana',      pronta: false },
  { href: '/mes',        nome: 'Mês',         pronta: false },
  { href: '/campanhas',  nome: 'Campanhas',   pronta: false },
  { href: '/mapa',       nome: 'Mapa mental', pronta: false },
  { href: '/metas',      nome: 'Metas',       pronta: false },
  { href: '/processos',  nome: 'Processos',   pronta: false },
  { href: '/ferramentas',nome: 'Ferramentas', pronta: false },
  { href: '/equipe',     nome: 'Equipe',      pronta: false },
];

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
