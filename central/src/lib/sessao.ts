import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { clienteServidor } from '@/lib/supabase/servidor';
import type { Area, Marca, Perfil, Sessao } from '@/lib/tipos';

export const COOKIE_MARCA = 'central.marca';

/** Quem está logado, a área e as marcas a que tem acesso.
 *  Uma leitura só, no servidor, para a tela não piscar nem pedir os
 *  mesmos dados de novo a cada componente. */
export async function sessaoAtual(): Promise<Sessao> {
  const supabase = await clienteServidor();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/entrar');

  const { data: perfil } = await supabase
    .from('profiles')
    .select('id, nome, email, foto_url, area_id, cargo, papel, ativo')
    .eq('id', user.id)
    .single<Perfil>();

  /* O gatilho no banco cria o perfil junto com o usuário. Se mesmo assim
     ele não veio, algo saiu do lugar — é melhor mandar para o login do
     que renderizar uma tela sem dono. */
  if (!perfil) redirect('/auth/sair');

  const [{ data: area }, { data: vinculos }] = await Promise.all([
    perfil.area_id
      ? supabase.from('areas').select('*').eq('id', perfil.area_id).single<Area>()
      : Promise.resolve({ data: null }),
    supabase
      .from('profile_brands')
      .select('brands(id, nome, slug, cor, ativo)')
      .eq('profile_id', user.id),
  ]);

  /* O PostgREST devolve o vínculo como lista quando não sabe que a
     relação é de um para um, então achato os dois formatos. */
  const marcas = (vinculos ?? [])
    .flatMap((v) => {
      const b = (v as { brands: Marca | Marca[] | null }).brands;
      return Array.isArray(b) ? b : b ? [b] : [];
    })
    .filter((m) => m.ativo)
    .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));

  const escolhida = (await cookies()).get(COOKIE_MARCA)?.value;
  const marcaAtiva =
    marcas.find((m) => m.slug === escolhida) ?? marcas[0] ?? null;

  return { perfil, area: area ?? null, marcas, marcaAtiva };
}
