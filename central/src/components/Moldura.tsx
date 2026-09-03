import Link from 'next/link';
import { Marca } from '@/components/Marca';
import { cartao } from '@/lib/design';

/** A moldura das telas de entrada e cadastro. Uma coluna estreita,
 *  centrada, sem nada em volta que distraia de terminar o formulário. */
export function Moldura({
  titulo, abaixo, link, children,
}: {
  titulo: string;
  abaixo: string;
  link: { href: string; texto: string };
  children: React.ReactNode;
}) {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-5 py-12">
      <div className="w-full max-w-[380px]">
        <div className="mb-8 flex justify-center">
          <Marca />
        </div>
        <div className={cartao + ' p-6'}>
          <h1 className="mb-5 text-[17px] font-semibold tracking-[-0.01em]">{titulo}</h1>
          {children}
        </div>
        <p className="mt-5 text-center text-[13px] text-tinta-2">
          {abaixo}{' '}
          <Link href={link.href} className="font-medium text-tinta underline underline-offset-2">
            {link.texto}
          </Link>
        </p>
      </div>
    </main>
  );
}
