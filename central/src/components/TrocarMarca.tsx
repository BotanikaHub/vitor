'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { tintaSobre } from '@/lib/design';
import type { Marca } from '@/lib/tipos';

/** A marca em cartaz. Com uma marca só, vira um selo sem interação —
 *  botão que não faz nada é pior que botão nenhum. */
export function TrocarMarca({ marcas, ativa }: { marcas: Marca[]; ativa: Marca | null }) {
  const router = useRouter();
  const [indo, setIndo] = useState(false);
  if (!ativa) return null;

  const selo = (m: Marca, viva: boolean) => (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[12px] font-medium"
      style={
        viva
          ? { background: m.cor, color: tintaSobre(m.cor) }
          : { color: 'var(--tinta-2)' }
      }
    >
      {m.nome}
    </span>
  );

  if (marcas.length < 2) return selo(ativa, true);

  async function trocar(slug: string) {
    if (slug === ativa!.slug || indo) return;
    setIndo(true);
    await fetch('/api/marca', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ slug }),
    });
    router.refresh();
    setIndo(false);
  }

  return (
    <div className="flex items-center gap-0.5 rounded-full border border-linha bg-papel p-0.5">
      {marcas.map((m) => (
        <button
          key={m.id}
          onClick={() => trocar(m.slug)}
          aria-pressed={m.slug === ativa.slug}
          className="rounded-full transition disabled:opacity-60"
          disabled={indo}
        >
          {selo(m, m.slug === ativa.slug)}
        </button>
      ))}
    </div>
  );
}
