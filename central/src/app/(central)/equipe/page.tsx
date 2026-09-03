import { sessaoAtual } from '@/lib/sessao';
import { clienteServidor } from '@/lib/supabase/servidor';
import { Cabecalho, Bloco, Vazio } from '@/components/Pagina';
import { ListaDePessoas } from './ListaDePessoas';
import type { Area, Marca, Papel } from '@/lib/tipos';

export const metadata = { title: 'Equipe · Central' };
export const dynamic = 'force-dynamic';

export type PessoaNaLista = {
  id: string; nome: string; email: string; cargo: string | null;
  papel: Papel; ativo: boolean; area_id: string | null;
  marcas: string[];
};

export default async function Equipe() {
  const s = await sessaoAtual();
  const supabase = await clienteServidor();

  const [{ data: pessoas }, { data: areas }, { data: marcas }, { data: vinculos }] =
    await Promise.all([
      supabase.from('profiles')
        .select('id, nome, email, cargo, papel, ativo, area_id')
        .order('nome'),
      supabase.from('areas').select('*').order('ordem'),
      supabase.from('brands').select('*').order('nome'),
      supabase.from('profile_brands').select('profile_id, brand_id'),
    ]);

  const porPessoa = new Map<string, string[]>();
  for (const v of (vinculos ?? []) as { profile_id: string; brand_id: string }[]) {
    porPessoa.set(v.profile_id, [...(porPessoa.get(v.profile_id) ?? []), v.brand_id]);
  }
  const lista: PessoaNaLista[] = ((pessoas ?? []) as Omit<PessoaNaLista, 'marcas'>[])
    .map((p) => ({ ...p, marcas: porPessoa.get(p.id) ?? [] }));

  const esperando = lista.filter((p) => !p.ativo);
  const dentro = lista.filter((p) => p.ativo);
  const souAdmin = s.perfil.papel === 'admin';

  return (
    <div className="space-y-5">
      <Cabecalho
        titulo="Equipe"
        abaixo={souAdmin
          ? 'Libere o acesso de quem se cadastrou e defina papel, área e marcas.'
          : 'Quem trabalha na operação e em que área.'}
      />

      {esperando.length ? (
        <Bloco titulo={`Esperando liberação — ${esperando.length}`}>
          {souAdmin ? (
            <ListaDePessoas
              pessoas={esperando}
              areas={(areas ?? []) as Area[]}
              marcas={(marcas ?? []) as Marca[]}
              souAdmin
              euId={s.perfil.id}
            />
          ) : (
            <Vazio>Um administrador precisa liberar {esperando.length} pessoa(s).</Vazio>
          )}
        </Bloco>
      ) : null}

      <Bloco titulo={`Na operação — ${dentro.length}`}>
        {dentro.length ? (
          <ListaDePessoas
            pessoas={dentro}
            areas={(areas ?? []) as Area[]}
            marcas={(marcas ?? []) as Marca[]}
            souAdmin={souAdmin}
            euId={s.perfil.id}
          />
        ) : (
          <Vazio>Ninguém liberado ainda.</Vazio>
        )}
      </Bloco>
    </div>
  );
}
