'use client';

import { useMemo, useState } from 'react';
import { clienteNavegador } from '@/lib/supabase/cliente';
import { Cabecalho, Bloco, Vazio } from '@/components/Pagina';
import { Cartao } from './Cartao';
import { Painel } from './Painel';
import { dataCurta } from '@/lib/datas';
import {
  atrasada as estaAtrasada, colunas, fechada, quemFaz,
  type ListaClickUp, type Tarefa,
} from '@/lib/tarefas';

type Vista = 'quadro' | 'acao' | 'pessoa';

export function Quadro({
  tarefas: iniciais, listas, hoje, marcaAtiva, eu,
}: {
  tarefas: Tarefa[];
  listas: ListaClickUp[];
  hoje: string;
  marcaAtiva: string | null;
  eu: string;
}) {
  const [tarefas, setTarefas] = useState(iniciais);
  const [vista, setVista] = useState<Vista>('quadro');
  /* Abre na lista da marca em cartaz — mas só se ela tiver tarefa,
     senão o quadro abriria vazio dizendo que não há nada quando há. */
  const [naLista, setNaLista] = useState(() =>
    marcaAtiva && iniciais.some((t) => t.lista === marcaAtiva) ? marcaAtiva : '');
  const [quem, setQuem] = useState('');
  const [aberta, setAberta] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');

  const nomesDeLista = useMemo(
    () => [...new Set(listas.map((l) => l.nome).concat(
      tarefas.map((t) => t.lista ?? '').filter(Boolean)))].sort(),
    [listas, tarefas]);

  const daLista = useMemo(
    () => tarefas.filter((t) => !naLista || t.lista === naLista),
    [tarefas, naLista]);

  const pessoas = useMemo(
    () => [...new Set(daLista.flatMap(quemFaz))].sort((a, b) => a.localeCompare(b, 'pt-BR')),
    [daLista]);

  const visiveis = useMemo(
    () => daLista.filter((t) => !quem || quemFaz(t).includes(quem)),
    [daLista, quem]);

  const filhasDe = (t: Tarefa) => tarefas.filter((x) => x.mae_de === t.assinatura);
  const ehMae = (t: Tarefa) => !t.mae_de;
  /* Mãe com filhas não vira cartão: ela é o bloco, não o trabalho. */
  const noQuadro = visiveis.filter((t) => !ehMae(t) || !filhasDe(t).length);
  const cols = useMemo(() => colunas(listas, naLista, daLista), [listas, naLista, daLista]);

  const t = aberta ? tarefas.find((x) => x.assinatura === aberta) ?? null : null;

  async function grava(assinatura: string, mudanca: Partial<Tarefa>) {
    const antes = tarefas;
    setTarefas((l) => l.map((x) => x.assinatura === assinatura ? { ...x, ...mudanca } : x));
    setSalvando(true);
    setErro('');
    const { error } = await clienteNavegador()
      .from('tarefas_planejadas').update(mudanca).eq('assinatura', assinatura);
    setSalvando(false);
    if (error) {
      /* a tela não pode mostrar o que o banco recusou */
      setTarefas(antes);
      setErro('Não consegui salvar: ' + error.message);
    }
  }

  function mudarItem(item: string, marcado: boolean) {
    if (!t) return;
    const feitos = new Set(t.checklist_feito ?? []);
    marcado ? feitos.add(item) : feitos.delete(item);
    grava(t.assinatura, {
      checklist_feito: (t.checklist ?? []).filter((i) => feitos.has(i)),
    });
  }

  const abertas = visiveis.filter((x) => !fechada(x, listas) && (!ehMae(x) || !filhasDe(x).length));
  const vencidas = abertas.filter((x) => estaAtrasada(x, listas, hoje));

  return (
    <div>
      <Cabecalho
        titulo="Tarefas"
        abaixo={`${abertas.length} abertas${vencidas.length ? ` · ${vencidas.length} vencidas` : ''}${naLista ? ` · ${naLista}` : ''}`}
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="flex rounded-[8px] border border-linha bg-papel p-0.5">
          {([['quadro', 'Quadro'], ['acao', 'Por ação'], ['pessoa', 'Por pessoa']] as const)
            .map(([v, nome]) => (
              <button key={v} onClick={() => setVista(v)}
                aria-pressed={vista === v}
                className={'rounded-[6px] px-3 py-1.5 text-[13px] transition ' +
                  (vista === v ? 'bg-papel-3 font-medium text-tinta' : 'text-tinta-2 hover:text-tinta')}>
                {nome}
              </button>
            ))}
        </div>
        <select value={naLista} onChange={(e) => { setNaLista(e.target.value); setQuem(''); }}
          aria-label="Lista"
          className="rounded-[8px] border border-linha bg-papel px-2.5 py-2 text-[13px]">
          <option value="">todas as listas</option>
          {nomesDeLista.map((l) => <option key={l} value={l}>{l}</option>)}
        </select>
        <select value={quem} onChange={(e) => setQuem(e.target.value)}
          aria-label="Responsável"
          className="rounded-[8px] border border-linha bg-papel px-2.5 py-2 text-[13px]">
          <option value="">todo mundo</option>
          {pessoas.map((p) => <option key={p} value={p}>{p}</option>)}
        </select>
        {quem || naLista ? (
          <button onClick={() => { setQuem(''); setNaLista(''); }}
            className="text-[12px] text-tinta-2 underline underline-offset-2">
            limpar filtros
          </button>
        ) : null}
        {eu && pessoas.some((p) => eu.toLowerCase().startsWith(p.toLowerCase().split(' ')[0])) ? (
          <button onClick={() => setQuem(pessoas.find((p) =>
            eu.toLowerCase().startsWith(p.toLowerCase().split(' ')[0]))!)}
            className="text-[12px] text-tinta-2 underline underline-offset-2">
            só as minhas
          </button>
        ) : null}
      </div>

      {erro ? (
        <p className="mb-3 rounded-[8px] border border-vermelho/25 bg-vermelho/5 px-3 py-2 text-[13px] text-vermelho">
          {erro}
        </p>
      ) : null}

      {!visiveis.length ? (
        <Bloco>
          <Vazio>
            {tarefas.length
              ? <>Nada aqui com o filtro de agora. As outras {tarefas.length} estão fora dele.</>
              : <>Nenhuma tarefa ainda. O espelho do ClickUp traz de hora em hora.</>}
          </Vazio>
        </Bloco>
      ) : vista === 'quadro' ? (
        <div className="grid gap-3 overflow-x-auto pb-2"
          style={{ gridTemplateColumns: `repeat(${cols.length}, minmax(230px, 1fr))` }}>
          {cols.map((c) => {
            const dela = noQuadro.filter((x) => x.status === c.nome);
            return (
              <section key={c.nome} className="min-w-[230px] rounded-[10px] border border-linha bg-papel-2 p-2.5">
                <h2 className="mb-2.5 flex items-center justify-between gap-2 border-b-2 pb-2 text-[11px] font-semibold uppercase tracking-[0.07em]"
                  style={{ color: c.cor ?? undefined, borderColor: c.cor ?? 'var(--linha)' }}>
                  <span className="truncate">{c.nome}</span>
                  <span className="tabular text-tinta-3">{dela.length}</span>
                </h2>
                <div className="space-y-2">
                  {dela.length ? dela.map((x) => (
                    <Cartao key={x.assinatura} t={x} listas={listas} hoje={hoje}
                      filhas={filhasDe(x)} atrasada={estaAtrasada(x, listas, hoje)}
                      onAbrir={() => setAberta(x.assinatura)} />
                  )) : (
                    <p className="py-6 text-center text-[12px] text-tinta-3">nada aqui</p>
                  )}
                </div>
              </section>
            );
          })}
        </div>
      ) : vista === 'acao' ? (
        <PorAcao visiveis={visiveis} filhasDe={filhasDe} listas={listas} hoje={hoje}
          onAbrir={setAberta} />
      ) : (
        <PorPessoa visiveis={noQuadro} listas={listas} hoje={hoje} onAbrir={setAberta} />
      )}

      {t ? (
        <Painel
          t={t}
          mae={t.mae_de ? tarefas.find((x) => x.assinatura === t.mae_de) ?? null : null}
          filhas={filhasDe(t)}
          statuses={cols}
          salvando={salvando}
          onFechar={() => setAberta(null)}
          onStatus={(s) => grava(t.assinatura, { status: s })}
          onItem={mudarItem}
          onAbrir={setAberta}
        />
      ) : null}
    </div>
  );
}

function Linha({ t, atrasada, onAbrir }: { t: Tarefa; atrasada: boolean; onAbrir: () => void }) {
  const quem = quemFaz(t);
  return (
    <button onClick={onAbrir}
      className="flex w-full items-center gap-2.5 px-4 py-2.5 text-left transition hover:bg-papel-3">
      <span className="size-2 shrink-0 rounded-full" style={{ background: t.status_cor ?? '#a1a1aa' }} />
      <span className="min-w-0 flex-1 truncate text-[13px]">{t.nome}</span>
      {t.checklist?.length ? (
        <span className="shrink-0 rounded bg-papel-3 px-1.5 text-[11px] text-tinta-2">
          {(t.checklist_feito ?? []).length}/{t.checklist.length}
        </span>
      ) : null}
      <span className={'shrink-0 text-[12px] tabular ' + (atrasada ? 'text-vermelho' : 'text-tinta-3')}>
        {dataCurta(t.dia)}
      </span>
      <span className="shrink-0 truncate text-[12px] text-tinta-3">{quem.join(', ') || '—'}</span>
    </button>
  );
}

function PorAcao({
  visiveis, filhasDe, listas, hoje, onAbrir,
}: {
  visiveis: Tarefa[];
  filhasDe: (t: Tarefa) => Tarefa[];
  listas: ListaClickUp[];
  hoje: string;
  onAbrir: (a: string) => void;
}) {
  const maes = visiveis.filter((t) => !t.mae_de && filhasDe(t).length);
  const soltas = visiveis.filter((t) =>
    !maes.some((m) => m.assinatura === (t.mae_de ?? t.assinatura)));
  return (
    <div className="space-y-4">
      {maes.map((m) => {
        const f = filhasDe(m);
        const feitas = f.filter((x) => fechada(x, listas)).length;
        return (
          <Bloco key={m.assinatura} titulo={m.nome}
            aoLado={<span className="text-[12px] text-tinta-3">{feitas} de {f.length}</span>}>
            <div className="h-0.5 bg-linha">
              <div className="h-full bg-verde"
                style={{ width: f.length ? `${Math.round((100 * feitas) / f.length)}%` : '0%' }} />
            </div>
            <div className="divide-y divide-linha">
              {f.map((x) => (
                <Linha key={x.assinatura} t={x} atrasada={estaAtrasada(x, listas, hoje)}
                  onAbrir={() => onAbrir(x.assinatura)} />
              ))}
            </div>
          </Bloco>
        );
      })}
      {soltas.length ? (
        <Bloco titulo="Sem ação ligada"
          aoLado={<span className="text-[12px] text-tinta-3">{soltas.length}</span>}>
          <div className="divide-y divide-linha">
            {soltas.map((x) => (
              <Linha key={x.assinatura} t={x} atrasada={estaAtrasada(x, listas, hoje)}
                onAbrir={() => onAbrir(x.assinatura)} />
            ))}
          </div>
        </Bloco>
      ) : null}
    </div>
  );
}

function PorPessoa({
  visiveis, listas, hoje, onAbrir,
}: { visiveis: Tarefa[]; listas: ListaClickUp[]; hoje: string; onAbrir: (a: string) => void }) {
  const por = new Map<string, Tarefa[]>();
  visiveis.forEach((t) => {
    const nomes = quemFaz(t);
    (nomes.length ? nomes : ['Sem responsável']).forEach((q) =>
      por.set(q, [...(por.get(q) ?? []), t]));
  });
  const grupos = [...por.entries()].map(([q, l]) => ({
    q, l,
    feitas: l.filter((x) => fechada(x, listas)).length,
    atras: l.filter((x) => estaAtrasada(x, listas, hoje)).length,
  })).sort((a, b) => b.atras - a.atras || b.l.length - a.l.length);

  return (
    <div className="space-y-4">
      {grupos.map((g) => (
        <Bloco key={g.q} titulo={g.q}
          aoLado={
            <span className="flex items-center gap-2 text-[12px]">
              <span className="text-tinta-3">{g.feitas} de {g.l.length}</span>
              {g.atras ? (
                <span className="rounded-full bg-vermelho/10 px-2 py-0.5 font-medium text-vermelho">
                  {g.atras} vencida{g.atras > 1 ? 's' : ''}
                </span>
              ) : null}
            </span>
          }>
          <div className="divide-y divide-linha">
            {g.l.filter((x) => !fechada(x, listas)).map((x) => (
              <Linha key={x.assinatura} t={x} atrasada={estaAtrasada(x, listas, hoje)}
                onAbrir={() => onAbrir(x.assinatura)} />
            ))}
          </div>
        </Bloco>
      ))}
    </div>
  );
}
