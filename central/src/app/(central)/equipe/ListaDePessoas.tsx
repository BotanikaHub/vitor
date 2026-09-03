'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { clienteNavegador } from '@/lib/supabase/cliente';
import { botaoLeve, tintaSobre } from '@/lib/design';
import { NOME_PAPEL, type Area, type Marca, type Papel } from '@/lib/tipos';
import type { PessoaNaLista } from './page';

const PAPEIS: Papel[] = ['admin', 'gestor', 'membro', 'externo'];
const iniciais = (n: string) =>
  n.trim().split(/\s+/).slice(0, 2).map((p) => p[0]).join('').toUpperCase();

export function ListaDePessoas({
  pessoas, areas, marcas, souAdmin, euId,
}: {
  pessoas: PessoaNaLista[];
  areas: Area[];
  marcas: Marca[];
  souAdmin: boolean;
  euId: string;
}) {
  const router = useRouter();
  const [erro, setErro] = useState('');
  const [ocupada, setOcupada] = useState<string | null>(null);
  const [, transicao] = useTransition();

  /* O construtor do Supabase é "thenable", não Promise: dá para esperar
     com await, mas não satisfaz o tipo Promise. Daí o await aqui dentro. */
  async function mexer(id: string, faz: () => PromiseLike<{ error: unknown }>) {
    setOcupada(id);
    setErro('');
    const { error } = await faz();
    setOcupada(null);
    if (error) {
      setErro(
        typeof error === 'object' && error && 'message' in error
          ? String((error as { message: string }).message)
          : 'Não consegui salvar.',
      );
      return;
    }
    transicao(() => router.refresh());
  }

  const sb = () => clienteNavegador();

  const liberar = (p: PessoaNaLista) =>
    mexer(p.id, () => sb().from('profiles').update({ ativo: !p.ativo }).eq('id', p.id));

  const trocarPapel = (p: PessoaNaLista, papel: Papel) =>
    mexer(p.id, () => sb().from('profiles').update({ papel }).eq('id', p.id));

  const trocarArea = (p: PessoaNaLista, area_id: string) =>
    mexer(p.id, () => sb().from('profiles')
      .update({ area_id: area_id || null }).eq('id', p.id));

  async function alternarMarca(p: PessoaNaLista, m: Marca) {
    const tem = p.marcas.includes(m.id);
    await mexer(p.id, async () =>
      tem
        ? await sb().from('profile_brands').delete()
            .eq('profile_id', p.id).eq('brand_id', m.id)
        : await sb().from('profile_brands')
            .insert({ profile_id: p.id, brand_id: m.id }));
  }

  return (
    <div>
      {erro ? (
        <p className="border-b border-linha bg-vermelho/5 px-4 py-2 text-[12px] text-vermelho">
          {erro}
        </p>
      ) : null}
      <ul className="divide-y divide-linha">
        {pessoas.map((p) => (
          <li key={p.id} className="px-4 py-3.5">
            <div className="flex flex-wrap items-start gap-3">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-full border border-linha bg-papel-3 text-[11px] font-semibold text-tinta-2">
                {iniciais(p.nome)}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[13px] font-medium">
                  {p.nome}
                  {p.id === euId ? (
                    <span className="ml-2 text-[11px] font-normal text-tinta-3">você</span>
                  ) : null}
                </p>
                <p className="truncate text-[12px] text-tinta-3">{p.email}</p>
                {!souAdmin ? (
                  <p className="mt-1 text-[12px] text-tinta-2">
                    {areas.find((a) => a.id === p.area_id)?.nome ?? 'sem área'}
                    {p.cargo ? ' · ' + p.cargo : ''} · {NOME_PAPEL[p.papel]}
                  </p>
                ) : null}
              </div>

              {souAdmin ? (
                <div className="flex flex-wrap items-center gap-2">
                  <select
                    aria-label={'Área de ' + p.nome}
                    value={p.area_id ?? ''}
                    disabled={ocupada === p.id}
                    onChange={(e) => trocarArea(p, e.target.value)}
                    className="rounded-[7px] border border-linha bg-papel px-2 py-1.5 text-[12px]"
                  >
                    <option value="">sem área</option>
                    {areas.map((a) => <option key={a.id} value={a.id}>{a.nome}</option>)}
                  </select>
                  <select
                    aria-label={'Papel de ' + p.nome}
                    value={p.papel}
                    /* Tirar o próprio admin deixaria a operação sem quem
                       libera ninguém. */
                    disabled={ocupada === p.id || p.id === euId}
                    onChange={(e) => trocarPapel(p, e.target.value as Papel)}
                    className="rounded-[7px] border border-linha bg-papel px-2 py-1.5 text-[12px] disabled:text-tinta-3"
                  >
                    {PAPEIS.map((x) => <option key={x} value={x}>{NOME_PAPEL[x]}</option>)}
                  </select>
                  <button
                    onClick={() => liberar(p)}
                    disabled={ocupada === p.id || p.id === euId}
                    className={botaoLeve + (p.ativo ? '' : ' border-verde text-verde')}
                  >
                    {p.ativo ? 'Bloquear' : 'Liberar'}
                  </button>
                </div>
              ) : null}
            </div>

            {souAdmin ? (
              <div className="mt-2.5 flex flex-wrap items-center gap-1.5 pl-11">
                <span className="text-[11px] uppercase tracking-[0.08em] text-tinta-3">
                  Marcas
                </span>
                {marcas.map((m) => {
                  const tem = p.marcas.includes(m.id);
                  return (
                    <button
                      key={m.id}
                      onClick={() => alternarMarca(p, m)}
                      disabled={ocupada === p.id}
                      aria-pressed={tem}
                      className="rounded-full px-2.5 py-1 text-[12px] transition disabled:opacity-50"
                      style={tem
                        ? { background: m.cor, color: tintaSobre(m.cor) }
                        : { border: '1px solid var(--linha)', color: 'var(--tinta-3)' }}
                    >
                      {m.nome}
                    </button>
                  );
                })}
              </div>
            ) : (
              <p className="mt-1 pl-11 text-[12px] text-tinta-3">
                {marcas.filter((m) => p.marcas.includes(m.id)).map((m) => m.nome).join(', ') || 'sem marca'}
              </p>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
