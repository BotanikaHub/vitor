'use client';

import { dataCurta } from '@/lib/datas';
import { PRIORIDADE, quemFaz, type ListaClickUp, type Tarefa } from '@/lib/tarefas';

/** O cartão. Traz a prévia do checklist porque é ali que mora o detalhe
 *  do trabalho — quem olha o quadro quer saber o que falta, não só que
 *  existe uma tarefa. */
export function Cartao({
  t, listas, hoje, filhas, atrasada, onAbrir,
}: {
  t: Tarefa;
  listas: ListaClickUp[];
  hoje: string;
  filhas: Tarefa[];
  atrasada: boolean;
  onAbrir: () => void;
}) {
  const itens = t.checklist ?? [];
  const feitos = new Set(t.checklist_feito ?? []);
  const quem = quemFaz(t);
  const prio = t.prioridade ? PRIORIDADE[t.prioridade] ?? t.prioridade : null;

  return (
    <button
      onClick={onAbrir}
      className={
        'w-full rounded-[9px] border bg-papel p-3 text-left transition hover:border-linha-2 ' +
        (atrasada ? 'border-l-[3px] border-l-vermelho border-linha' : 'border-linha')
      }
    >
      {t.projeto ? (
        <span className="mb-1 block text-[11px] font-medium uppercase tracking-[0.06em] text-tinta-3">
          {t.projeto}
        </span>
      ) : null}
      <span className="block text-[13px] leading-snug">{t.nome}</span>

      {itens.length ? (
        <ul className="mt-2 space-y-0.5 border-l border-linha pl-2.5">
          {itens.slice(0, 3).map((it) => {
            const ok = feitos.has(it);
            return (
              <li key={it}
                className={'flex items-start gap-1.5 text-[11.5px] leading-snug ' +
                  (ok ? 'text-tinta-3 line-through' : 'text-tinta-2')}>
                <span className={'mt-[3px] size-2.5 shrink-0 rounded-[3px] border text-[8px] leading-[9px] ' +
                  (ok ? 'border-verde text-verde' : 'border-linha-2')}>
                  {ok ? '✓' : ''}
                </span>
                <span className="min-w-0 flex-1 truncate">{it}</span>
              </li>
            );
          })}
          {itens.length > 3 ? (
            <li className="pl-4 text-[11px] text-tinta-3">
              e mais {itens.length - 3}
            </li>
          ) : null}
        </ul>
      ) : null}

      <span className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-tinta-3">
        {prio ? (
          <span className="rounded-full border px-1.5 py-px text-[10px] uppercase tracking-[0.04em]"
            style={{ color: t.prioridade_cor ?? undefined, borderColor: 'currentColor' }}>
            {prio}
          </span>
        ) : null}
        {t.dia ? (
          <span className={'tabular ' + (atrasada ? 'font-medium text-vermelho' : '')}>
            {dataCurta(t.dia)}
          </span>
        ) : null}
        {itens.length ? <span>{feitos.size}/{itens.length}</span> : null}
        {filhas.length ? (
          <span>{filhas.filter((f) => f.encerrada_em || f.status === 'feito').length}/{filhas.length} sub</span>
        ) : null}
        <span className="ml-auto truncate">{quem.join(', ') || '—'}</span>
      </span>
    </button>
  );
}
