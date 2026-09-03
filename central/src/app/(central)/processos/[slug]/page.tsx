import Link from 'next/link';
import { notFound } from 'next/navigation';
import { sessaoAtual } from '@/lib/sessao';
import { clienteServidor } from '@/lib/supabase/servidor';
import { md } from '@/lib/markdown';
import { VerOuEditar } from '../VerOuEditar';

export const dynamic = 'force-dynamic';

export default async function Processo({
  params,
}: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  await sessaoAtual();
  const supabase = await clienteServidor();
  const { data: p } = await supabase
    .from('processes')
    .select('id, titulo, slug, resumo, conteudo_md, area_id, versao, atualizado_em')
    .eq('slug', slug)
    .maybeSingle();

  if (!p) notFound();

  const { data: area } = p.area_id
    ? await supabase.from('areas').select('nome').eq('id', p.area_id).maybeSingle()
    : { data: null };

  return (
    <div className="mx-auto max-w-[820px]">
      <Link href="/processos" className="text-[12px] text-tinta-2 underline underline-offset-2">
        ← Processos
      </Link>
      {/* O markdown vira HTML no servidor e desce pronto: o editor só
          precisa do texto cru para quando alguém for mexer. */}
      <VerOuEditar
        id={p.id}
        titulo={p.titulo}
        subtitulo={`${area?.nome ?? 'sem área'} · versão ${p.versao} · atualizado em ${new Date(p.atualizado_em).toLocaleDateString('pt-BR')}`}
        html={md(p.conteudo_md)}
        cru={p.conteudo_md}
      />
    </div>
  );
}
