import Link from 'next/link';
import { sessaoAtual } from '@/lib/sessao';
import { clienteServidor } from '@/lib/supabase/servidor';
import { Cabecalho, Bloco, Vazio } from '@/components/Pagina';
import { botaoForte } from '@/lib/design';
import type { Area } from '@/lib/tipos';

export const metadata = { title: 'Processos · Central' };
export const dynamic = 'force-dynamic';

type Processo = {
  id: string; titulo: string; slug: string; resumo: string | null;
  area_id: string | null; versao: number; atualizado_em: string;
};

/** O que hoje mora na cabeça das pessoas. Quem entra aprende
 *  perguntando, e quando alguém sai o processo sai junto. */
export default async function Processos() {
  const s = await sessaoAtual();
  const supabase = await clienteServidor();
  const [{ data: procs }, { data: areas }] = await Promise.all([
    supabase.from('processes')
      .select('id, titulo, slug, resumo, area_id, versao, atualizado_em')
      .order('titulo'),
    supabase.from('areas').select('*').order('ordem'),
  ]);

  const lista = (procs ?? []) as Processo[];
  const todasAreas = (areas ?? []) as Area[];
  const nomeArea = (id: string | null) =>
    todasAreas.find((a) => a.id === id)?.nome ?? 'Sem área';

  /* A área de quem está olhando vem primeiro: é o que ela consulta no
     dia a dia. */
  const ordem = [...todasAreas].sort((a, b) =>
    (a.id === s.perfil.area_id ? -1 : 0) - (b.id === s.perfil.area_id ? -1 : 0) ||
    a.ordem - b.ordem);
  const grupos = [...ordem.map((a) => a.id), null]
    .map((id) => ({ id, itens: lista.filter((p) => p.area_id === id) }))
    .filter((g) => g.itens.length);

  return (
    <div>
      <Cabecalho
        titulo="Processos"
        abaixo="Como se faz cada coisa aqui. Serve para consultar no dia e para treinar quem entra."
        acao={<Link href="/processos/novo" className={botaoForte}>Escrever um processo</Link>}
      />
      {grupos.length ? (
        <div className="space-y-5">
          {grupos.map((g) => (
            <Bloco key={g.id ?? 'sem'} titulo={nomeArea(g.id)}>
              <ul className="divide-y divide-linha">
                {g.itens.map((p) => (
                  <li key={p.id}>
                    <Link href={`/processos/${p.slug}`}
                      className="block px-4 py-3 transition hover:bg-papel-3">
                      <div className="flex items-baseline justify-between gap-3">
                        <span className="text-[13px] font-medium">{p.titulo}</span>
                        <span className="shrink-0 text-[11px] text-tinta-3">
                          v{p.versao}
                        </span>
                      </div>
                      {p.resumo ? (
                        <p className="mt-0.5 text-[12px] leading-relaxed text-tinta-2">{p.resumo}</p>
                      ) : null}
                    </Link>
                  </li>
                ))}
              </ul>
            </Bloco>
          ))}
        </div>
      ) : (
        <Bloco>
          <Vazio>
            Nenhum processo escrito ainda. O primeiro pode ser o que você
            mais explica repetido.
          </Vazio>
        </Bloco>
      )}
    </div>
  );
}
