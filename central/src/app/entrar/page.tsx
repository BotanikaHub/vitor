import { Suspense } from 'react';
import { FormaEntrar } from './FormaEntrar';
import { Moldura } from '@/components/Moldura';

export const metadata = { title: 'Entrar · Central' };

export default function Entrar() {
  return (
    <Moldura
      titulo="Entrar"
      abaixo="Ainda não tem conta?"
      link={{ href: '/cadastro', texto: 'Criar a minha' }}
    >
      <Suspense>
        <FormaEntrar />
      </Suspense>
    </Moldura>
  );
}
