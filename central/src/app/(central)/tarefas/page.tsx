import { sessaoAtual } from '@/lib/sessao';
import { clienteServidor } from '@/lib/supabase/servidor';
import { Quadro } from './Quadro';
import { hojeISO } from '@/lib/datas';
import type { ListaClickUp, Tarefa } from '@/lib/tarefas';

export const metadata = { title: 'Tarefas · Central' };
export const dynamic = 'force-dynamic';

/** As tarefas, nativas na Central — não mais a página do planejador
 *  dentro de um quadro. Os dados são os mesmos: o espelho do ClickUp. */
export default async function Tarefas() {
  const s = await sessaoAtual();
  const supabase = await clienteServidor();

  const [{ data: tarefas }, { data: listas }] = await Promise.all([
    supabase.from('tarefas_planejadas')
      .select('assinatura, nome, descricao, status, status_cor, status_ordem, prioridade, prioridade_cor, dia, inicio, responsavel, responsaveis, etiquetas, checklist, checklist_feito, lista, campanha, projeto, fase, mae_de, clickup_id, clickup_url, encerrada_em, situacao, ordem')
      .neq('situacao', 'recusada')
      .order('dia', { ascending: true }),
    supabase.from('listas_clickup').select('lista_id, nome, statuses'),
  ]);

  return (
    <Quadro
      tarefas={(tarefas ?? []) as Tarefa[]}
      listas={(listas ?? []) as ListaClickUp[]}
      hoje={hojeISO()}
      marcaAtiva={s.marcaAtiva?.nome ?? null}
      eu={s.perfil.nome}
    />
  );
}
