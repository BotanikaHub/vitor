'use client';

import { useEffect, useRef, useState } from 'react';
import { NOME_PAPEL, type Area, type Perfil } from '@/lib/tipos';
import { cartao, botaoLeve } from '@/lib/design';

const iniciais = (nome: string) =>
  nome.trim().split(/\s+/).slice(0, 2).map((p) => p[0]).join('').toUpperCase();

export function MenuPessoa({ perfil, area }: { perfil: Perfil; area: Area | null }) {
  const [aberto, setAberto] = useState(false);
  const caixa = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!aberto) return;
    const fora = (e: MouseEvent) => {
      if (caixa.current && !caixa.current.contains(e.target as Node)) setAberto(false);
    };
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setAberto(false); };
    document.addEventListener('mousedown', fora);
    document.addEventListener('keydown', esc);
    return () => {
      document.removeEventListener('mousedown', fora);
      document.removeEventListener('keydown', esc);
    };
  }, [aberto]);

  return (
    <div className="relative" ref={caixa}>
      <button
        onClick={() => setAberto((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={aberto}
        className="flex size-8 items-center justify-center rounded-full border border-linha bg-papel-3 text-[11px] font-semibold text-tinta-2 transition hover:border-linha-2"
        title={perfil.nome}
      >
        {iniciais(perfil.nome)}
      </button>
      {aberto ? (
        <div
          role="menu"
          className={cartao + ' absolute right-0 top-10 z-30 w-60 p-3 shadow-[0_8px_28px_rgba(0,0,0,0.08)]'}
        >
          <p className="text-[13px] font-medium text-tinta">{perfil.nome}</p>
          <p className="mt-0.5 truncate text-[12px] text-tinta-3">{perfil.email}</p>
          <dl className="mt-3 space-y-1 border-t border-linha pt-3 text-[12px]">
            <div className="flex justify-between gap-3">
              <dt className="text-tinta-3">Área</dt>
              <dd className="text-tinta-2">{area?.nome ?? '—'}</dd>
            </div>
            {perfil.cargo ? (
              <div className="flex justify-between gap-3">
                <dt className="text-tinta-3">Cargo</dt>
                <dd className="truncate text-tinta-2">{perfil.cargo}</dd>
              </div>
            ) : null}
            <div className="flex justify-between gap-3">
              <dt className="text-tinta-3">Papel</dt>
              <dd className="text-tinta-2">{NOME_PAPEL[perfil.papel]}</dd>
            </div>
          </dl>
          <form action="/auth/sair" method="post" className="mt-3">
            <button className={botaoLeve + ' w-full'}>Sair</button>
          </form>
        </div>
      ) : null}
    </div>
  );
}
