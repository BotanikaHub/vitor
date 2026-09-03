/** As seções da plataforma.
 *
 *  Mora num módulo comum de propósito. Já morou dentro do componente de
 *  navegação, que é 'use client', e o servidor importava a lista de lá:
 *  no build de produção os exports de um módulo cliente viram referência
 *  de cliente, e a lista chegava no servidor como algo que não é lista.
 *  Compilava, passava no build, e caía em produção na primeira página
 *  que a usasse. */
export type Secao = {
  href: string;
  nome: string;
  pronta: boolean;
};

export const SECOES: Secao[] = [
  { href: '/',            nome: 'Início',      pronta: true },
  /* Mapa mental, mês, semana, campanhas, metas e tarefas vivem dentro do
     planejador hoje. Vão sair para páginas próprias uma a uma; até lá,
     ninguém fica sem ferramenta. */
  { href: '/tarefas',     nome: 'Tarefas',     pronta: true },
  /* O que ainda não saiu do planejador: mapa mental, mês, semana,
     campanhas e gestão. Esta entrada encolhe conforme as telas viram
     página nativa daqui. */
  { href: '/planejador',  nome: 'Planejador',  pronta: true },
  { href: '/processos',   nome: 'Processos',   pronta: true },
  { href: '/ferramentas', nome: 'Ferramentas', pronta: true },
  { href: '/equipe',      nome: 'Equipe',      pronta: true },
];
