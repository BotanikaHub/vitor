'use client';

import { useState } from 'react';
import { clienteNavegador } from '@/lib/supabase/cliente';
import { campo, rotulo, botaoForte, avisoErro, aviso } from '@/lib/design';

export function FormaCadastro() {
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState('');
  const [pronto, setPronto] = useState(false);
  const [indo, setIndo] = useState(false);

  async function criar(e: React.FormEvent) {
    e.preventDefault();
    setErro('');
    if (senha.length < 8) {
      setErro('A senha precisa de pelo menos 8 caracteres.');
      return;
    }
    setIndo(true);
    const supabase = clienteNavegador();
    const { error } = await supabase.auth.signUp({
      email: email.trim(),
      password: senha,
      /* o nome vai no metadado porque é o gatilho do banco que monta o
         perfil, no mesmo instante em que o usuário nasce */
      options: { data: { nome: nome.trim() } },
    });
    if (error) {
      setErro(
        error.message.toLowerCase().includes('already registered')
          ? 'Esse e-mail já tem conta. Tente entrar.'
          : 'Não consegui criar a conta: ' + error.message,
      );
      setIndo(false);
      return;
    }
    setPronto(true);
    setIndo(false);
  }

  if (pronto) {
    return (
      <div className="space-y-3">
        <p className={aviso}>
          <b className="font-medium text-tinta">Conta criada.</b> Confirme o
          e-mail que enviamos para <b className="font-medium text-tinta">{email}</b>.
        </p>
        <p className="text-[13px] leading-relaxed text-tinta-2">
          Depois de confirmar, o acesso ainda precisa ser liberado por um
          administrador — é o que impede que qualquer pessoa que descubra
          o endereço entre na operação.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={criar} className="space-y-4">
      <div className="space-y-1.5">
        <label className={rotulo} htmlFor="nome">Nome</label>
        <input
          id="nome" required autoFocus autoComplete="name" className={campo}
          value={nome} placeholder="como a equipe te chama"
          onChange={(e) => setNome(e.target.value)}
        />
      </div>
      <div className="space-y-1.5">
        <label className={rotulo} htmlFor="email">E-mail</label>
        <input
          id="email" type="email" required autoComplete="email" className={campo}
          value={email} placeholder="voce@botanika.com.br"
          onChange={(e) => setEmail(e.target.value)}
        />
      </div>
      <div className="space-y-1.5">
        <label className={rotulo} htmlFor="senha">Senha</label>
        <input
          id="senha" type="password" required autoComplete="new-password"
          minLength={8} className={campo} value={senha}
          onChange={(e) => setSenha(e.target.value)}
        />
        <p className="text-[12px] text-tinta-3">Pelo menos 8 caracteres.</p>
      </div>
      {erro ? <p className={avisoErro}>{erro}</p> : null}
      <button type="submit" disabled={indo} className={botaoForte + ' w-full'}>
        {indo ? 'Criando…' : 'Criar conta'}
      </button>
    </form>
  );
}
