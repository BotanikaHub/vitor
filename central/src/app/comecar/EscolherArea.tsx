'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { clienteNavegador } from '@/lib/supabase/cliente';
import { campo, rotulo, botaoForte, avisoErro } from '@/lib/design';
import type { Area } from '@/lib/tipos';

export function EscolherArea({ areas }: { areas: Area[] }) {
  const router = useRouter();
  const [area, setArea] = useState('');
  const [cargo, setCargo] = useState('');
  const [erro, setErro] = useState('');
  const [indo, setIndo] = useState(false);

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    if (!area) { setErro('Escolha a sua área.'); return; }
    setIndo(true);
    setErro('');
    const supabase = clienteNavegador();
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase
      .from('profiles')
      .update({ area_id: area, cargo: cargo.trim() || null })
      .eq('id', user!.id);
    if (error) { setErro('Não consegui salvar: ' + error.message); setIndo(false); return; }
    router.replace('/');
    router.refresh();
  }

  return (
    <form onSubmit={salvar} className="space-y-4">
      <div className="space-y-2">
        <span className={rotulo}>Área</span>
        <div className="grid gap-2 sm:grid-cols-2">
          {areas.map((a) => (
            <label
              key={a.id}
              className={
                'cursor-pointer rounded-[8px] border px-3 py-2.5 transition ' +
                (area === a.id
                  ? 'border-tinta bg-papel-3'
                  : 'border-linha bg-papel hover:border-linha-2')
              }
            >
              <input
                type="radio" name="area" value={a.id} className="sr-only"
                checked={area === a.id} onChange={() => setArea(a.id)}
              />
              <span className="block text-[13px] font-medium text-tinta">{a.nome}</span>
              {a.descricao ? (
                <span className="mt-0.5 block text-[12px] leading-snug text-tinta-3">
                  {a.descricao}
                </span>
              ) : null}
            </label>
          ))}
        </div>
      </div>
      <div className="space-y-1.5">
        <label className={rotulo} htmlFor="cargo">Cargo <span className="normal-case tracking-normal">(opcional)</span></label>
        <input
          id="cargo" className={campo} value={cargo} placeholder="ex.: Gestora de Automações"
          onChange={(e) => setCargo(e.target.value)}
        />
      </div>
      {erro ? <p className={avisoErro}>{erro}</p> : null}
      <button type="submit" disabled={indo} className={botaoForte + ' w-full'}>
        {indo ? 'Salvando…' : 'Continuar'}
      </button>
    </form>
  );
}
