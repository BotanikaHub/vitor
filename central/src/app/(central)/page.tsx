import { sessaoAtual } from '@/lib/sessao';
import { cartao } from '@/lib/design';
import { SECOES } from '@/components/Navegacao';

export const metadata = { title: 'Início · Central' };

const saudacao = () => {
  const h = Number(new Date().toLocaleString('pt-BR', {
    timeZone: 'America/Sao_Paulo', hour: '2-digit', hour12: false,
  }));
  return h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite';
};

const hoje = () =>
  new Date().toLocaleDateString('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    weekday: 'long', day: '2-digit', month: 'long',
  });

export default async function Inicio() {
  const s = await sessaoAtual();
  const primeiro = s.perfil.nome.split(' ')[0];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-[22px] font-semibold tracking-[-0.02em]">
          {saudacao()}, {primeiro}
        </h1>
        <p className="mt-1 text-[13px] text-tinta-2 first-letter:uppercase">{hoje()}</p>
      </div>

      {/* A tela inicial vai responder "o que eu faço agora". Enquanto as
          tarefas não existem aqui, ela diz o que ainda falta em vez de
          fingir um painel cheio de caixa vazia. */}
      <section className={cartao + ' p-5'}>
        <h2 className="text-[14px] font-semibold">A fundação está de pé</h2>
        <p className="mt-2 max-w-[62ch] text-[13px] leading-relaxed text-tinta-2">
          Entrar, sair, perfil com área e cargo, marcas com acesso por pessoa
          e as políticas de acesso do banco. É a etapa 1 das oito.
        </p>
        <dl className="mt-4 grid gap-3 sm:grid-cols-3">
          {[
            ['Você é', s.perfil.cargo || s.area?.nome || '—'],
            ['Área', s.area?.nome ?? '—'],
            ['Marcas', s.marcas.map((m) => m.nome).join(', ') || '—'],
          ].map(([r, v]) => (
            <div key={r} className="rounded-[8px] bg-papel-2 px-3 py-2.5">
              <dt className="text-[11px] uppercase tracking-[0.08em] text-tinta-3">{r}</dt>
              <dd className="mt-0.5 text-[13px] text-tinta">{v}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className={cartao + ' p-5'}>
        <h2 className="text-[14px] font-semibold">O que vem</h2>
        <ul className="mt-3 grid gap-x-6 gap-y-1.5 sm:grid-cols-2">
          {SECOES.filter((x) => !x.pronta).map((x) => (
            <li key={x.href} className="flex items-baseline gap-2 text-[13px] text-tinta-2">
              <span className="size-1 shrink-0 rounded-full bg-linha-2" />
              {x.nome}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
