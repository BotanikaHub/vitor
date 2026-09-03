'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { clienteNavegador } from '@/lib/supabase/cliente';
import { campo, rotulo, botaoForte, avisoErro, cartao } from '@/lib/design';
import type { Area } from '@/lib/tipos';

/** "Como configurar um cupom" vira "como-configurar-um-cupom". O
 *  endereço fica legível e não muda quando o título é ajustado. */
function apelido(t: string): string {
  return t.normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '').slice(0, 60);
}

export function FormaProcesso({
  areas, minhaArea,
}: { areas: Area[]; minhaArea: string | null }) {
  const router = useRouter();
  const [titulo, setTitulo] = useState('');
  const [resumo, setResumo] = useState('');
  const [area, setArea] = useState(minhaArea ?? '');
  const [texto, setTexto] = useState('');
  const [erro, setErro] = useState('');
  const [indo, setIndo] = useState(false);

  async function criar(e: React.FormEvent) {
    e.preventDefault();
    setErro('');
    const slug = apelido(titulo);
    if (!slug) { setErro('Dê um título ao processo.'); return; }
    setIndo(true);
    const supabase = clienteNavegador();
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase.from('processes').insert({
      titulo: titulo.trim(),
      slug,
      resumo: resumo.trim() || null,
      conteudo_md: texto,
      area_id: area || null,
      criado_por: user?.id ?? null,
      atualizado_por: user?.id ?? null,
    });
    setIndo(false);
    if (error) {
      setErro(error.message.includes('duplicate')
        ? 'Já existe um processo com esse título.'
        : 'Não consegui criar: ' + error.message);
      return;
    }
    router.push('/processos/' + slug);
    router.refresh();
  }

  return (
    <form onSubmit={criar} className="space-y-4">
      <div className="space-y-1.5">
        <label className={rotulo} htmlFor="titulo">Título</label>
        <input id="titulo" required autoFocus className={campo} value={titulo}
          placeholder="ex.: Como configurar um cupom na Shopify"
          onChange={(e) => setTitulo(e.target.value)} />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <label className={rotulo} htmlFor="area">Área</label>
          <select id="area" className={campo} value={area}
            onChange={(e) => setArea(e.target.value)}>
            <option value="">sem área</option>
            {areas.map((a) => <option key={a.id} value={a.id}>{a.nome}</option>)}
          </select>
        </div>
        <div className="space-y-1.5">
          <label className={rotulo} htmlFor="resumo">Resumo <span className="normal-case tracking-normal">(opcional)</span></label>
          <input id="resumo" className={campo} value={resumo}
            placeholder="uma linha do que ele resolve"
            onChange={(e) => setResumo(e.target.value)} />
        </div>
      </div>
      <div className="space-y-1.5">
        <label className={rotulo} htmlFor="texto">O processo</label>
        <textarea id="texto" value={texto} spellCheck
          onChange={(e) => setTexto(e.target.value)}
          placeholder={'## Quando usar\n\n...\n\n## Passo a passo\n\n- [ ] primeiro\n- [ ] segundo'}
          className={cartao + ' min-h-[340px] w-full resize-y px-4 py-3 font-mono text-[13px] leading-relaxed outline-none'} />
      </div>
      {erro ? <p className={avisoErro}>{erro}</p> : null}
      <button type="submit" disabled={indo} className={botaoForte}>
        {indo ? 'Criando…' : 'Criar processo'}
      </button>
    </form>
  );
}
