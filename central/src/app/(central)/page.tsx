import Link from 'next/link';
import { sessaoAtual } from '@/lib/sessao';
import { clienteServidor } from '@/lib/supabase/servidor';
import { Bloco, Numero, Vazio } from '@/components/Pagina';
import { cartao } from '@/lib/design';
import { hojeISO, emDias, porExtenso, saudacao, ateQuinta, ehQuinta, dataCurta } from '@/lib/datas';

export const metadata = { title: 'Início · Central' };
export const dynamic = 'force-dynamic';

type Tarefa = {
  assinatura: string; nome: string; dia: string | null; status: string;
  status_cor: string | null; responsavel: string | null; lista: string | null;
  campanha: string | null; clickup_url: string | null; encerrada_em: string | null;
};

/** A tela inicial responde "o que eu faço agora" — não "o que existe".
 *  Por isso ela começa pelo que é meu e está vencido, e só depois mostra
 *  o resto. */
export default async function Inicio() {
  const s = await sessaoAtual();
  const supabase = await clienteServidor();
  const hoje = hojeISO();
  const fimDaSemana = emDias(7);

  const { data } = await supabase
    .from('tarefas_planejadas')
    .select('assinatura, nome, dia, status, status_cor, responsavel, lista, campanha, clickup_url, encerrada_em')
    .neq('situacao', 'recusada')
    .order('dia', { ascending: true });

  const todas = (data ?? []) as Tarefa[];
  const daMarca = s.marcaAtiva
    ? todas.filter((t) => !t.lista || t.lista === s.marcaAtiva!.nome)
    : todas;

  /* O nome no ClickUp vem como "Sarah | Gestora de Automações"; o que
     casa com a pessoa aqui é o primeiro pedaço. */
  const meuPrimeiro = s.perfil.nome.split(' ')[0].toLowerCase();
  const ehMinha = (t: Tarefa) =>
    (t.responsavel ?? '').toLowerCase().includes(meuPrimeiro);

  const aberta = (t: Tarefa) => !t.encerrada_em && t.status !== 'feito';
  const minhas = daMarca.filter((t) => ehMinha(t) && aberta(t));
  const vencidas = minhas.filter((t) => t.dia && t.dia < hoje);
  const paraHoje = minhas.filter((t) => t.dia === hoje);
  const naSemana = minhas.filter((t) => t.dia && t.dia > hoje && t.dia <= fimDaSemana);
  const equipeVencida = daMarca.filter((t) => aberta(t) && t.dia && t.dia < hoje);

  /* Agrupa o vencido por pessoa: uma pessoa com vinte tarefas vencidas
     só aparece quando alguém conta, e a ideia é não precisar contar. */
  const porPessoa = [...equipeVencida.reduce((m, t) => {
    const quem = (t.responsavel ?? 'Sem responsável').split('|')[0].trim();
    m.set(quem, [...(m.get(quem) ?? []), t]);
    return m;
  }, new Map<string, Tarefa[]>())]
    .sort((a, b) => b[1].length - a[1].length);

  const faltamParaQuinta = ateQuinta();

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[22px] font-semibold tracking-[-0.02em]">
            {saudacao()}, {s.perfil.nome.split(' ')[0]}
          </h1>
          <p className="mt-1 text-[13px] text-tinta-2 first-letter:uppercase">
            {porExtenso()} · {s.area?.nome ?? 'sem área'}
            {s.marcaAtiva ? ` · ${s.marcaAtiva.nome}` : ''}
          </p>
        </div>
        <div className={cartao + ' px-3.5 py-2'}>
          <p className="text-[11px] uppercase tracking-[0.08em] text-tinta-3">
            Reunião de KPI
          </p>
          <p className="mt-0.5 text-[13px] font-medium">
            {ehQuinta()
              ? 'É hoje, quinta-feira'
              : `Quinta-feira — em ${faltamParaQuinta} dia${faltamParaQuinta > 1 ? 's' : ''}`}
          </p>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Numero rotulo="Vencidas" valor={vencidas.length}
          tom={vencidas.length ? 'alerta' : 'bom'}
          pe={vencidas.length ? 'passaram do prazo' : 'nada atrasado'} />
        <Numero rotulo="Para hoje" valor={paraHoje.length} pe="vencem hoje" />
        <Numero rotulo="Esta semana" valor={naSemana.length} pe="próximos 7 dias" />
        <Numero rotulo="Vencidas na equipe" valor={equipeVencida.length}
          tom={equipeVencida.length > 10 ? 'atencao' : 'neutro'}
          pe={s.marcaAtiva ? 'em ' + s.marcaAtiva.nome : 'em todas as marcas'} />
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          <Bloco titulo="O que é seu e está aberto"
            aoLado={<Link href="/planejador" className="text-[12px] text-tinta-2 underline underline-offset-2">ver no quadro</Link>}>
            {minhas.length ? (
              <ul className="divide-y divide-linha">
                {minhas.slice(0, 12).map((t) => (
                  <li key={t.assinatura} className="flex items-center gap-3 px-4 py-2.5">
                    <span className="size-2 shrink-0 rounded-full"
                      style={{ background: t.status_cor ?? '#a1a1aa' }} />
                    <span className="min-w-0 flex-1 truncate text-[13px]">
                      {t.clickup_url ? (
                        <a href={t.clickup_url} target="_blank" rel="noopener"
                          className="hover:underline underline-offset-2">{t.nome}</a>
                      ) : t.nome}
                    </span>
                    <span className={'shrink-0 text-[12px] tabular ' +
                      (t.dia && t.dia < hoje ? 'text-vermelho' : 'text-tinta-3')}>
                      {dataCurta(t.dia)}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <Vazio>
                Nada aberto no seu nome{s.marcaAtiva ? ` em ${s.marcaAtiva.nome}` : ''}.
                As tarefas vêm do ClickUp pelo nome do responsável.
              </Vazio>
            )}
            {minhas.length > 12 ? (
              <p className="border-t border-linha px-4 py-2 text-[12px] text-tinta-3">
                e mais {minhas.length - 12}
              </p>
            ) : null}
          </Bloco>

          {/* Quem é da gestão precisa ver a carga dos outros, não só a
              própria — e é o que impede esta tela de abrir vazia para
              quem distribui em vez de executar. */}
          {equipeVencida.length ? (
            <Bloco titulo={`Vencidas na equipe — ${equipeVencida.length}`}>
              <ul className="divide-y divide-linha">
                {porPessoa.slice(0, 8).map(([quem, itens]) => (
                  <li key={quem} className="px-4 py-2.5">
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="text-[13px] font-medium">{quem}</span>
                      <span className="shrink-0 text-[12px] text-vermelho tabular">
                        {itens.length} vencida{itens.length > 1 ? 's' : ''}
                      </span>
                    </div>
                    <p className="mt-0.5 truncate text-[12px] text-tinta-3">
                      a mais antiga: {dataCurta(itens[0].dia)} · {itens[0].nome}
                    </p>
                  </li>
                ))}
              </ul>
            </Bloco>
          ) : null}
        </div>

        <div className="space-y-5">
          <Bloco titulo="Sua área">
            <div className="px-4 py-3.5">
              <p className="text-[13px] font-medium">{s.area?.nome ?? '—'}</p>
              {s.area?.descricao ? (
                <p className="mt-1 text-[12px] leading-relaxed text-tinta-2">{s.area.descricao}</p>
              ) : null}
              <p className="mt-3 text-[12px] text-tinta-3">
                {s.perfil.cargo ?? 'sem cargo definido'} · {s.marcas.map((m) => m.nome).join(', ')}
              </p>
            </div>
          </Bloco>

          <Bloco titulo="Atalhos"
            aoLado={<Link href="/ferramentas" className="text-[12px] text-tinta-2 underline underline-offset-2">todas</Link>}>
            <div className="grid grid-cols-2 gap-px bg-linha">
              {[
                { href: '/planejador', nome: 'Planejador' },
                { href: '/processos', nome: 'Processos' },
                { href: '/ferramentas', nome: 'Ferramentas' },
                { href: '/equipe', nome: 'Equipe' },
              ].map((a) => (
                <Link key={a.href} href={a.href}
                  className="bg-papel px-4 py-3 text-[13px] transition hover:bg-papel-3">
                  {a.nome}
                </Link>
              ))}
            </div>
          </Bloco>
        </div>
      </div>
    </div>
  );
}
