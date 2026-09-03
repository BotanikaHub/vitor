import { sessaoAtual } from '@/lib/sessao';
import { clienteServidor } from '@/lib/supabase/servidor';
import { Cabecalho, Bloco, Vazio } from '@/components/Pagina';

export const metadata = { title: 'Ferramentas · Central' };
export const dynamic = 'force-dynamic';

type Ferramenta = {
  id: string; nome: string; descricao: string | null;
  url: string; categoria: string;
};

/** Onde se acha o acesso de cada coisa. Existe para ninguém mais
 *  perguntar "qual é o link do X" no grupo. */
export default async function Ferramentas() {
  await sessaoAtual();
  const supabase = await clienteServidor();
  const { data } = await supabase
    .from('tools')
    .select('id, nome, descricao, url, categoria')
    .order('categoria').order('ordem');

  const lista = (data ?? []) as Ferramenta[];
  const porCategoria = lista.reduce<Record<string, Ferramenta[]>>((acc, f) => {
    (acc[f.categoria] ??= []).push(f);
    return acc;
  }, {});
  const categorias = Object.keys(porCategoria).sort((a, b) => a.localeCompare(b, 'pt-BR'));

  return (
    <div>
      <Cabecalho
        titulo="Ferramentas"
        abaixo="Os acessos da operação, num lugar só."
      />
      {categorias.length ? (
        <div className="space-y-5">
          {categorias.map((c) => (
            <Bloco key={c} titulo={c}>
              <div className="grid gap-px bg-linha sm:grid-cols-2 lg:grid-cols-3">
                {porCategoria[c].map((f) => (
                  <a key={f.id} href={f.url} target="_blank" rel="noopener"
                    className="group bg-papel px-4 py-3.5 transition hover:bg-papel-3">
                    <p className="text-[13px] font-medium group-hover:underline underline-offset-2">
                      {f.nome}
                    </p>
                    {f.descricao ? (
                      <p className="mt-1 text-[12px] leading-relaxed text-tinta-2">{f.descricao}</p>
                    ) : null}
                    <p className="mt-1.5 truncate text-[11px] text-tinta-3">
                      {f.url.replace(/^https?:\/\//, '').split('/')[0]}
                    </p>
                  </a>
                ))}
              </div>
            </Bloco>
          ))}
        </div>
      ) : (
        <Bloco><Vazio>Nenhuma ferramenta cadastrada ainda.</Vazio></Bloco>
      )}
    </div>
  );
}
