/** As tarefas, do jeito que elas vêm do banco. O espelho do ClickUp já
 *  gravou tudo isto — aqui é só dar nome. */
export type Tarefa = {
  assinatura: string;
  nome: string;
  descricao: string | null;
  status: string;
  status_cor: string | null;
  status_ordem: number | null;
  prioridade: string | null;
  prioridade_cor: string | null;
  dia: string | null;
  inicio: string | null;
  responsavel: string | null;
  responsaveis: { id?: number; nome: string; email?: string | null }[] | null;
  etiquetas: string[] | null;
  checklist: string[] | null;
  checklist_feito: string[] | null;
  lista: string | null;
  campanha: string | null;
  projeto: string | null;
  fase: string | null;
  mae_de: string | null;
  clickup_id: string | null;
  clickup_url: string | null;
  encerrada_em: string | null;
  situacao: string | null;
  ordem: number | null;
};

export type StatusDaLista = {
  nome: string;
  cor: string | null;
  ordem: number | null;
  fecha: boolean;
};

export type ListaClickUp = {
  lista_id: string;
  nome: string;
  statuses: StatusDaLista[];
};

export const PRIORIDADE: Record<string, string> = {
  urgent: 'urgente', high: 'alta', normal: 'normal', low: 'baixa',
};

/** Cada lista nomeia o status que encerra do seu jeito — "feito" numa,
 *  "fechado" na outra. O que fecha de verdade é a data de encerramento. */
export function fechada(t: Tarefa, listas: ListaClickUp[]): boolean {
  if (t.encerrada_em) return true;
  const l = listas.find((x) => x.nome === t.lista);
  const st = l?.statuses.find((s) => s.nome === t.status);
  return st ? st.fecha : t.status === 'feito';
}

export function atrasada(t: Tarefa, listas: ListaClickUp[], hoje: string): boolean {
  return !fechada(t, listas) && !!t.dia && t.dia < hoje;
}

export function quemFaz(t: Tarefa): string[] {
  const l = (t.responsaveis ?? []).map((r) => r?.nome).filter(Boolean) as string[];
  if (!l.length && t.responsavel) l.push(t.responsavel);
  /* no ClickUp o nome vem como "Sarah | Gestora de Automações" */
  return l.map((n) => n.split('|')[0].trim());
}

/** As colunas são os status configurados na lista, não os que por acaso
 *  têm tarefa agora: sem a coluna vazia não há para onde mover. */
export function colunas(
  listas: ListaClickUp[], naLista: string, tarefas: Tarefa[],
): StatusDaLista[] {
  const mapa = new Map<string, StatusDaLista>();
  const guarda = (s: StatusDaLista) => {
    const tem = mapa.get(s.nome);
    if (!tem) mapa.set(s.nome, { ...s });
    else {
      if (!tem.cor && s.cor) tem.cor = s.cor;
      if (s.ordem !== null && (tem.ordem === null || s.ordem < tem.ordem)) tem.ordem = s.ordem;
    }
  };
  listas.filter((l) => !naLista || l.nome === naLista)
    .forEach((l) => l.statuses.forEach(guarda));
  /* tarefa criada aqui, fora de lista do ClickUp, ainda precisa de coluna */
  tarefas.forEach((t) => guarda({
    nome: t.status, cor: t.status_cor, ordem: t.status_ordem, fecha: false,
  }));
  return [...mapa.values()].sort((a, b) =>
    (a.ordem ?? 99) - (b.ordem ?? 99) || a.nome.localeCompare(b.nome, 'pt-BR'));
}
