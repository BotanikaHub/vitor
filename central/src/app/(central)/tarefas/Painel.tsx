'use client';

import { md } from '@/lib/markdown';
import { dataCurta } from '@/lib/datas';
import { botaoLeve, cartao } from '@/lib/design';
import { PRIORIDADE, quemFaz, type StatusDaLista, type Tarefa } from '@/lib/tarefas';

/** A folha de uma tarefa. Tudo que dá pra saber sobre ela num lugar só:
 *  a descrição do ClickUp em markdown, o checklist clicável, as
 *  subtarefas, e o caminho de volta para a campanha. */
export function Painel({
  t, mae, filhas, statuses, onFechar, onStatus, onItem, onAbrir, salvando,
}: {
  t: Tarefa;
  mae: Tarefa | null;
  filhas: Tarefa[];
  statuses: StatusDaLista[];
  onFechar: () => void;
  onStatus: (s: string) => void;
  onItem: (item: string, marcado: boolean) => void;
  onAbrir: (assinatura: string) => void;
  salvando: boolean;
}) {
  const itens = t.checklist ?? [];
  const feitos = new Set(t.checklist_feito ?? []);
  const quem = quemFaz(t);

  return (
    <>
      <div className="fixed inset-0 z-30 bg-tinta/20" onClick={onFechar} aria-hidden />
      <aside
        role="dialog"
        aria-label={t.nome}
        className="fixed right-0 top-0 z-40 flex h-dvh w-full max-w-[560px] flex-col border-l border-linha bg-papel shadow-[-8px_0_32px_rgba(0,0,0,0.06)]"
      >
        <header className="flex items-start gap-3 border-b border-linha px-5 py-4">
          <div className="min-w-0 flex-1">
            <h2 className="text-[15px] font-semibold leading-snug">{t.nome}</h2>
            <p className="mt-1 flex flex-wrap items-center gap-x-1.5 text-[12px] text-tinta-3">
              {t.lista ? <span>{t.lista}</span> : null}
              {t.projeto ? <><span>·</span><span>{t.projeto}</span></> : null}
              {t.fase ? <><span>·</span><span>{t.fase}</span></> : null}
              {t.clickup_url ? (
                <>
                  <span>·</span>
                  <a href={t.clickup_url} target="_blank" rel="noopener"
                    className="underline underline-offset-2">abrir no ClickUp</a>
                </>
              ) : null}
            </p>
          </div>
          <button onClick={onFechar} aria-label="Fechar"
            className="shrink-0 rounded-[7px] px-2 py-1 text-[18px] leading-none text-tinta-3 hover:bg-papel-3">
            ×
          </button>
        </header>

        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-5 py-4">
          {mae ? (
            <button onClick={() => onAbrir(mae.assinatura)}
              className={cartao + ' flex w-full items-center gap-2 px-3 py-2 text-left text-[12px] transition hover:bg-papel-3'}>
              <span className="text-tinta-3">Dentro de</span>
              <span className="min-w-0 flex-1 truncate font-medium">{mae.nome}</span>
              <span className="text-tinta-3">→</span>
            </button>
          ) : null}

          <div className="grid gap-3 sm:grid-cols-2">
            <Campo rotulo="Status">
              <select
                value={t.status}
                disabled={salvando}
                onChange={(e) => onStatus(e.target.value)}
                className="w-full rounded-[7px] border border-linha bg-papel px-2.5 py-1.5 text-[13px]"
              >
                {statuses.map((s) => <option key={s.nome} value={s.nome}>{s.nome}</option>)}
              </select>
            </Campo>
            <Campo rotulo="Prioridade">
              <p className="text-[13px]" style={{ color: t.prioridade_cor ?? undefined }}>
                {t.prioridade ? PRIORIDADE[t.prioridade] ?? t.prioridade : '—'}
              </p>
            </Campo>
            <Campo rotulo="Começa"><p className="text-[13px] tabular">{dataCurta(t.inicio)}</p></Campo>
            <Campo rotulo="Prazo"><p className="text-[13px] tabular">{dataCurta(t.dia)}</p></Campo>
            <Campo rotulo={quem.length > 1 ? `Responsáveis — ${quem.length}` : 'Responsável'}>
              <p className="text-[13px]">{quem.join(', ') || '—'}</p>
            </Campo>
            {t.etiquetas?.length ? (
              <Campo rotulo="Etiquetas">
                <p className="flex flex-wrap gap-1">
                  {t.etiquetas.map((g) => (
                    <span key={g} className="rounded-full bg-papel-3 px-2 py-0.5 text-[11px] text-tinta-2">{g}</span>
                  ))}
                </p>
              </Campo>
            ) : null}
          </div>

          {itens.length ? (
            <section>
              <h3 className="mb-2 text-[11px] uppercase tracking-[0.08em] text-tinta-3">
                Checklist — {feitos.size} de {itens.length}
              </h3>
              <ul className="space-y-1">
                {itens.map((it) => {
                  const ok = feitos.has(it);
                  return (
                    <li key={it}>
                      <label className={
                        'flex cursor-pointer items-start gap-2.5 rounded-[7px] px-2 py-1.5 text-[13px] transition hover:bg-papel-3 ' +
                        (ok ? 'text-tinta-3' : '')
                      }>
                        <input type="checkbox" checked={ok} disabled={salvando}
                          onChange={(e) => onItem(it, e.target.checked)}
                          className="mt-[3px] size-3.5 shrink-0 accent-[var(--verde)]" />
                        <span className={ok ? 'line-through' : ''}>{it}</span>
                      </label>
                    </li>
                  );
                })}
              </ul>
            </section>
          ) : null}

          {filhas.length ? (
            <section>
              <h3 className="mb-2 text-[11px] uppercase tracking-[0.08em] text-tinta-3">
                Subtarefas — {filhas.filter((f) => f.encerrada_em || f.status === 'feito').length} de {filhas.length}
              </h3>
              <ul className="divide-y divide-linha rounded-[9px] border border-linha">
                {filhas.map((f) => (
                  <li key={f.assinatura}>
                    <button onClick={() => onAbrir(f.assinatura)}
                      className="flex w-full items-center gap-2.5 px-3 py-2 text-left transition hover:bg-papel-3">
                      <span className="size-2 shrink-0 rounded-full"
                        style={{ background: f.status_cor ?? '#a1a1aa' }} />
                      <span className="min-w-0 flex-1 truncate text-[13px]">{f.nome}</span>
                      <span className="shrink-0 text-[11px] tabular text-tinta-3">{dataCurta(f.dia)}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {t.descricao ? (
            <section>
              <h3 className="mb-2 text-[11px] uppercase tracking-[0.08em] text-tinta-3">Descrição</h3>
              <div className="proza rounded-[9px] border border-linha px-4 py-3"
                dangerouslySetInnerHTML={{ __html: md(t.descricao) }} />
            </section>
          ) : null}
        </div>

        {t.clickup_url ? (
          <footer className="border-t border-linha px-5 py-3">
            <a href={t.clickup_url} target="_blank" rel="noopener" className={botaoLeve}>
              Abrir no ClickUp
            </a>
          </footer>
        ) : null}
      </aside>
    </>
  );
}

function Campo({ rotulo, children }: { rotulo: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-1 text-[11px] uppercase tracking-[0.08em] text-tinta-3">{rotulo}</p>
      {children}
    </div>
  );
}
