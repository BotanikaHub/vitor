import { notFound } from 'next/navigation';
import { Quadro } from '../(central)/tarefas/Quadro';
import type { ListaClickUp, Tarefa } from '@/lib/tarefas';

const STATUS = [
  { nome: 'a fazer', cor: '#87909e', ordem: 0, fecha: false },
  { nome: 'fazendo', cor: '#b660e0', ordem: 1, fecha: false },
  { nome: 'revisar', cor: '#f8ae00', ordem: 2, fecha: false },
  { nome: 'ajustes necessários', cor: '#e16b16', ordem: 3, fecha: false },
  { nome: 'feito', cor: '#008844', ordem: 4, fecha: true },
];
const LISTAS: ListaClickUp[] = [
  { lista_id: '1', nome: 'Botanika', statuses: STATUS },
  { lista_id: '2', nome: 'VermeFree', statuses: STATUS },
];
const PC: Record<string, string> = { urgent: '#f50000', high: '#f8ae00', normal: '#6fddff' };
let n = 0;
const T = (nome: string, o: Partial<Tarefa> = {}): Tarefa => ({
  assinatura: 'x' + ++n, nome, descricao: null, status: 'a fazer',
  status_cor: STATUS.find((s) => s.nome === (o.status ?? 'a fazer'))!.cor,
  status_ordem: STATUS.findIndex((s) => s.nome === (o.status ?? 'a fazer')),
  prioridade: 'high', prioridade_cor: PC[o.prioridade ?? 'high'],
  dia: null, inicio: null, responsavel: null, responsaveis: null, etiquetas: null,
  checklist: null, checklist_feito: null, lista: 'Botanika', campanha: null,
  projeto: null, fase: null, mae_de: null, clickup_id: null, clickup_url: null,
  encerrada_em: null, situacao: 'criada', ordem: n, ...o,
});
const q = (...ns: string[]) => ns.map((x, i) => ({ id: i, nome: x }));

const mae = T('DIA D KIDS — 26 a 30/09 | VERMEFREE', {
  lista: 'VermeFree', projeto: 'Dia D Kids', dia: '2026-10-01',
  responsaveis: q('Gestão Alliance'), etiquetas: ['setembro', 'kids'],
});
const TAREFAS: Tarefa[] = [
  mae,
  T('DIA D KIDS — Criar toda a copy · QUI 24/09 até 18h | VERMEFREE', {
    lista: 'VermeFree', projeto: 'Dia D Kids', dia: '2026-09-24', mae_de: mae.assinatura,
    responsaveis: q('Pedro Lage', 'Ítalo Neves'), prioridade: 'urgent', prioridade_cor: PC.urgent,
    checklist: ['E-mail · QUI 24/09 · disparo 1', 'WhatsApp · SEX 25/09 · disparo 1',
                'Story · SÁB 26/09', 'Feed · SEG 28/09'],
    checklist_feito: ['E-mail · QUI 24/09 · disparo 1'],
  }),
  T('DIA D KIDS — Criar todas as artes · QUI 24/09 até 18h | VERMEFREE', {
    lista: 'VermeFree', projeto: 'Dia D Kids', dia: '2026-09-24', mae_de: mae.assinatura,
    responsaveis: q('Ítalo Neves'),
  }),
  T('DIA D KIDS — Programar todos os disparos · SEX 25/09 | VERMEFREE', {
    lista: 'VermeFree', projeto: 'Dia D Kids', dia: '2026-09-25', mae_de: mae.assinatura,
    status: 'fazendo', status_cor: '#b660e0', status_ordem: 1,
    responsaveis: q('Sarah | Gestora de Automações'),
    checklist: ['Segmento na Unichat', 'Disparo 1', 'Disparo 2'], checklist_feito: [],
  }),
  T('AÇÕES DE RECOMPRA — WhatsApp API | VERMEFREE', {
    lista: 'VermeFree', projeto: 'Ações de Recompra', dia: '2026-08-14',
    prioridade: 'urgent', prioridade_cor: PC.urgent, responsaveis: q('Sarah | Gestora de Automações'),
  }),
  T('LEVANTAR STATUS E ENTREGAS DAS UGCs | VERMEFREE', {
    lista: 'VermeFree', projeto: 'Avulsas', dia: '2026-08-28',
    prioridade: 'normal', prioridade_cor: PC.normal, responsaveis: q('Ana Medeiros'),
  }),
  T('CONFERIR TUDO QUE VAI AO AR · todo dia até 09h | BOTANIKA + VERMEFREE', {
    lista: 'VermeFree', dia: '2026-09-04', prioridade: 'urgent', prioridade_cor: PC.urgent,
    responsaveis: q('Gestão Alliance'),
    checklist: ['Preço com desconto aplicado', 'Frete conforme a ação',
                'Banner e tarja com data certa', 'Links levam pra página certa'],
    checklist_feito: ['Preço com desconto aplicado', 'Frete conforme a ação'],
  }),
  T('DIA D — Criar 4 a 5 criativos em vídeo | BOTANIKA', {
    projeto: 'Dia D', dia: '2026-09-03', status: 'feito', status_cor: '#008844', status_ordem: 4,
    encerrada_em: '2026-09-03T09:29:41Z', responsaveis: q('Ítalo Neves'),
  }),
];

/** Banco de provas: renderiza as telas com dados de mentira, para eu
 *  poder OLHAR o que construí. O sandbox onde isto é desenvolvido não
 *  alcança o Supabase, então as páginas logadas não renderizam lá — e
 *  interface que ninguém olhou já foi pro ar torta duas vezes.
 *
 *  Fica trancado atrás de uma variável: sem PROVA_VISUAL=1 a rota não
 *  existe, e em produção ela nunca é ligada. */
export default function ProvaVisual() {
  if (process.env.PROVA_VISUAL !== '1') notFound();
  return (
    <div className="mx-auto max-w-[1240px] px-5 py-6">
      <Quadro tarefas={TAREFAS} listas={LISTAS} hoje="2026-09-03"
        marcaAtiva="VermeFree" eu="Vitor Gutierrez" />
    </div>
  );
}
