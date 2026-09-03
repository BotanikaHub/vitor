'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { clienteNavegador } from '@/lib/supabase/cliente';
import { campo, rotulo, botaoForte, avisoErro } from '@/lib/design';

export function FormaEntrar() {
  const router = useRouter();
  const params = useSearchParams();
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState('');
  const [indo, setIndo] = useState(false);

  async function entrar(e: React.FormEvent) {
    e.preventDefault();
    setErro('');
    setIndo(true);
    const supabase = clienteNavegador();
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password: senha,
    });
    if (error) {
      /* A mensagem do Supabase vem em inglês e fala de "credentials".
         Quem está tentando entrar merece saber o que fazer. */
      setErro(
        error.message.toLowerCase().includes('invalid')
          ? 'E-mail ou senha não conferem.'
          : error.message.toLowerCase().includes('not confirmed')
            ? 'Falta confirmar o e-mail. Procure a mensagem que enviamos.'
            : 'Não consegui entrar: ' + error.message,
      );
      setIndo(false);
      return;
    }
    router.replace(params.get('de') || '/');
    router.refresh();
  }

  return (
    <form onSubmit={entrar} className="space-y-4">
      <div className="space-y-1.5">
        <label className={rotulo} htmlFor="email">E-mail</label>
        <input
          id="email" type="email" required autoComplete="email" autoFocus
          className={campo} value={email} placeholder="voce@botanika.com.br"
          onChange={(e) => setEmail(e.target.value)}
        />
      </div>
      <div className="space-y-1.5">
        <label className={rotulo} htmlFor="senha">Senha</label>
        <input
          id="senha" type="password" required autoComplete="current-password"
          className={campo} value={senha}
          onChange={(e) => setSenha(e.target.value)}
        />
      </div>
      {erro ? <p className={avisoErro}>{erro}</p> : null}
      <button type="submit" disabled={indo} className={botaoForte + ' w-full'}>
        {indo ? 'Entrando…' : 'Entrar'}
      </button>
    </form>
  );
}
