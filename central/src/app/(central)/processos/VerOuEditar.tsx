'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { clienteNavegador } from '@/lib/supabase/cliente';
import { cartao, botaoLeve, botaoForte, avisoErro } from '@/lib/design';

export function VerOuEditar({
  id, titulo, subtitulo, html, cru,
}: {
  id: string; titulo: string; subtitulo: string; html: string; cru: string;
}) {
  const router = useRouter();
  const [editando, setEditando] = useState(false);
  const [texto, setTexto] = useState(cru);
  const [erro, setErro] = useState('');
  const [indo, setIndo] = useState(false);

  async function salvar() {
    setIndo(true); setErro('');
    const { error } = await clienteNavegador()
      .from('processes').update({ conteudo_md: texto }).eq('id', id);
    setIndo(false);
    if (error) { setErro('Não consegui salvar: ' + error.message); return; }
    setEditando(false);
    router.refresh();
  }

  return (
    <>
      <div className="mb-4 mt-3 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[20px] font-semibold tracking-[-0.02em]">{titulo}</h1>
          <p className="mt-1 text-[12px] text-tinta-3">{subtitulo}</p>
        </div>
        {editando ? (
          <div className="flex gap-2">
            <button className={botaoLeve} onClick={() => { setTexto(cru); setEditando(false); }}>
              Cancelar
            </button>
            <button className={botaoForte} onClick={salvar} disabled={indo}>
              {indo ? 'Salvando…' : 'Salvar'}
            </button>
          </div>
        ) : (
          <button className={botaoLeve} onClick={() => setEditando(true)}>Editar</button>
        )}
      </div>

      {erro ? <p className={avisoErro + ' mb-3'}>{erro}</p> : null}

      {editando ? (
        <>
          <textarea
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            spellCheck
            className={cartao + ' min-h-[420px] w-full resize-y px-4 py-3 font-mono text-[13px] leading-relaxed outline-none'}
          />
          <p className="mt-2 text-[12px] text-tinta-3">
            Markdown: <code># título</code>, <code>**negrito**</code>,
            {' '}<code>- item</code>, <code>- [ ] a fazer</code>, tabela com <code>|</code>.
            Salvar guarda a versão anterior.
          </p>
        </>
      ) : (
        <article className={cartao + ' proza px-6 py-5'}
          dangerouslySetInnerHTML={{ __html: html }} />
      )}
    </>
  );
}
