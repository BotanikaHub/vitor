import { cartao } from '@/lib/design';

/** O cabeçalho de uma página de dentro. Título, uma linha do que ela
 *  serve, e o canto direito para ação. */
export function Cabecalho({
  titulo, abaixo, acao,
}: { titulo: string; abaixo?: string; acao?: React.ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-[20px] font-semibold tracking-[-0.02em]">{titulo}</h1>
        {abaixo ? <p className="mt-1 text-[13px] text-tinta-2">{abaixo}</p> : null}
      </div>
      {acao}
    </div>
  );
}

/** Uma seção com título. */
export function Bloco({
  titulo, aoLado, children, className = '',
}: {
  titulo?: string;
  aoLado?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cartao + ' ' + className}>
      {titulo ? (
        <div className="flex items-center justify-between gap-3 border-b border-linha px-4 py-3">
          <h2 className="text-[13px] font-semibold">{titulo}</h2>
          {aoLado}
        </div>
      ) : null}
      {children}
    </section>
  );
}

/** Quando não há o que mostrar, dizer o que fazer — e não deixar a caixa
 *  em branco, que parece página quebrada. */
export function Vazio({ children }: { children: React.ReactNode }) {
  return (
    <p className="px-4 py-8 text-center text-[13px] text-tinta-3">{children}</p>
  );
}

/** Um número grande com rótulo. O tom marca o que pede atenção. */
export function Numero({
  rotulo, valor, pe, tom = 'neutro',
}: {
  rotulo: string;
  valor: React.ReactNode;
  pe?: string;
  tom?: 'neutro' | 'alerta' | 'atencao' | 'bom';
}) {
  const cor = {
    neutro: 'text-tinta',
    alerta: 'text-vermelho',
    atencao: 'text-ambar',
    bom: 'text-verde',
  }[tom];
  return (
    <div className={cartao + ' px-4 py-3.5'}>
      <p className="text-[11px] uppercase tracking-[0.08em] text-tinta-3">{rotulo}</p>
      <p className={'mt-1 text-[24px] font-semibold tabular tracking-[-0.02em] ' + cor}>{valor}</p>
      {pe ? <p className="mt-0.5 text-[12px] text-tinta-3">{pe}</p> : null}
    </div>
  );
}
