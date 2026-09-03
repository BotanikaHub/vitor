import { FormaCadastro } from './FormaCadastro';
import { Moldura } from '@/components/Moldura';

export const metadata = { title: 'Criar conta · Central' };

export default function Cadastro() {
  return (
    <Moldura
      titulo="Criar conta"
      abaixo="Já tem conta?"
      link={{ href: '/entrar', texto: 'Entrar' }}
    >
      <FormaCadastro />
    </Moldura>
  );
}
