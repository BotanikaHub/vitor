/* A ponte não pode ser testada contra o Supabase de dentro do sandbox — o
   proxy de saída bloqueia supabase.co. Então o que dá para provar aqui é a
   parte que é decisão nossa, e é justamente onde erro dói: qual chave vai
   para o banco, qual é da pessoa, qual é da operação, e qual nunca sobe. */
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';

const UID = '00000000-0000-0000-0000-000000000001';
const gravado = [];

/* ---- ambiente de mentira ---- */
const guardado = new Map();
const localStorage = {
  getItem: (k) => (guardado.has(k) ? guardado.get(k) : null),
  setItem: (k, v) => guardado.set(k, String(v)),
};
const sessionStorage = { _m: new Map(),
  getItem(k){return this._m.has(k)?this._m.get(k):null}, setItem(k,v){this._m.set(k,v)},
  removeItem(k){this._m.delete(k)} };

let recarregou = 0;
const estadoNoBanco = [
  { chave: 'central.tasks.vitor-gutierrez', dono: null, valor: [{ id: 1, t: 'do banco' }] },
  { chave: 'central.home.layout.vitor-gutierrez', dono: UID, valor: { cols: 2 } },
];

/* Um banco de mentira que dá para ler linha a linha, e não só tudo de uma
   vez: é o que a gravação precisa fazer agora para juntar em vez de
   atropelar. */
const acha = (chave, dono) => estadoNoBanco.find((l) => l.chave === chave &&
  (dono === null ? l.dono === null : l.dono === dono));

const sb = {
  auth: { getSession: async () => ({ data: { session: { user: { id: UID } } } }) },
  from: () => ({
    select: () => ({
      or: async () => ({ data: estadoNoBanco, error: null }),
      eq: (_c, chave) => ({
        is: () => ({ maybeSingle: async () => ({ data: acha(chave, null), error: null }) }),
        eq: (_d, dono) => ({ maybeSingle: async () => ({ data: acha(chave, dono), error: null }) }),
        maybeSingle: async () => ({ data: acha(chave, null), error: null }),
      }),
    }),
    upsert: (linha, op) => {
      gravado.push({ linha, op });
      const atual = acha(linha.chave, linha.dono ?? null);
      if (atual) atual.valor = linha.valor;
      else estadoNoBanco.push({ chave: linha.chave, dono: linha.dono ?? null, valor: linha.valor });
      return Promise.resolve({ error: null });
    },
  }),
};

/* O document de mentira só precisa ser suficiente para o caminho de quem
   já tem sessão: nada de barra na página, nada de tela de entrar. */
const documento = {
  querySelector: () => null,
  querySelectorAll: () => [],
  getElementById: () => null,
  createElement: () => ({ style: {}, setAttribute(){}, appendChild(){}, querySelector: () => null }),
  head: { appendChild(){} },
  body: { appendChild(){} },
  addEventListener: () => {},
  hidden: false,
};
class MutationObserver { observe(){} disconnect(){} }

const janela = {
  supabase: { createClient: () => sb },
  __SB_ANON__: 'chave-de-mentira',
  location: { reload: () => { recarregou++ } },
  addEventListener: () => {},
};

const fonte = readFileSync(new URL('../src/supabase.js', import.meta.url), 'utf8');
const roda = () =>
  new Function('window','localStorage','sessionStorage','location','document','console',
               'MutationObserver','addEventListener','setInterval',fonte)(
    janela, localStorage, sessionStorage, janela.location, documento, console,
    MutationObserver, () => {}, () => 0);

roda();
await new Promise((r) => setTimeout(r, 30));   // deixa as promessas resolverem

/* ---- o que tem que valer ---- */
assert.equal(recarregou, 1,
  'primeira visita: o estado veio diferente do banco, então recarrega uma vez');
assert.equal(localStorage.getItem('central.tasks.vitor-gutierrez'),
  JSON.stringify([{ id: 1, t: 'do banco' }]),
  'o estado da operação desceu para o navegador');

localStorage.setItem('central.tasks.vitor-gutierrez', JSON.stringify([{ id: 2 }]));
localStorage.setItem('central.home.layout.vitor-gutierrez', JSON.stringify({ cols: 3 }));
localStorage.setItem('central.theme', 'dark');
localStorage.setItem('outra.coisa', 'x');
await new Promise((r) => setTimeout(r, 20));

const chaves = gravado.map((g) => g.linha.chave);
assert.deepEqual(chaves,
  ['central.tasks.vitor-gutierrez', 'central.home.layout.vitor-gutierrez'],
  'sobem as duas chaves do app; o tema e o que não é nosso ficam de fora');

assert.equal(gravado[0].linha.dono, null,
  'tarefa é da operação inteira: dono nulo, todo mundo vê');
assert.equal(gravado[1].linha.dono, UID,
  'o arranjo da tela de início é de quem está logado');
assert.equal(gravado[0].op.onConflict, 'chave,dono',
  'grava por cima da linha que já existe em vez de criar outra');

/* Segunda visita, com o local já igual ao banco: não pode recarregar.
   O laço não é evitado por marca de sessão e sim por convergência — depois
   que a busca escreve, a comparação seguinte não acha diferença. */
recarregou = 0;
gravado.length = 0;
estadoNoBanco[0].valor = JSON.parse(localStorage.getItem('central.tasks.vitor-gutierrez'));
estadoNoBanco[1].valor = JSON.parse(localStorage.getItem('central.home.layout.vitor-gutierrez'));
roda();
await new Promise((r) => setTimeout(r, 30));
assert.equal(recarregou, 0, 'com o local igual ao banco, não recarrega');

/* E o inverso: se o banco tem algo que o local não tem, recarrega para o
   app iniciar com o dado de todos — foi o que faltava quando as dezoito
   campanhas não chegaram em quem estava com a aba aberta. */
recarregou = 0;
estadoNoBanco.push({ chave: 'central.campaigns.vitor-gutierrez', dono: null, valor: [{ id: 'pl-1' }] });
roda();
await new Promise((r) => setTimeout(r, 30));
assert.equal(recarregou, 1, 'dado novo no banco chega mesmo com a aba já aberta antes');

/* A corrida que quase apagou as campanhas: o app grava o padrão dele assim
   que roda, antes da busca terminar. Se o espelho já estivesse ligado
   nessa hora, esse padrão subiria por cima do que está no banco. */
{
  const guardadoLocal = new Map();
  const ls = {
    getItem: (k) => (guardadoLocal.has(k) ? guardadoLocal.get(k) : null),
    setItem: (k, v) => guardadoLocal.set(k, String(v)),
  };
  const ss = { _m:new Map(), getItem(k){return this._m.has(k)?this._m.get(k):null},
               setItem(k,v){this._m.set(k,v)}, removeItem(k){this._m.delete(k)} };
  const subiu = [];
  const sbLento = {
    auth: { getSession: async () => ({ data: { session: { user: { id: UID } } } }) },
    from: () => ({
      select: () => ({ or: () => new Promise((r) =>
        setTimeout(() => r({ data: [{ chave:'central.campaigns.vitor-gutierrez', dono:null,
                                      valor:[{id:'pl-1'},{id:'pl-2'}] }], error: null }), 40)) }),
      upsert: (linha) => { subiu.push(linha.chave); return Promise.resolve({ error: null }) },
    }),
  };
  const jan = { supabase:{ createClient: () => sbLento }, __SB_ANON__:'x',
                location:{ reload(){} }, addEventListener(){} };
  new Function('window','localStorage','sessionStorage','location','document','console',
               'MutationObserver','addEventListener','setInterval',fonte)(
    jan, ls, ss, jan.location, documento, console, MutationObserver, () => {}, () => 0);
  /* o app "acorda" antes da busca voltar e grava o padrão dele */
  await new Promise((r) => setTimeout(r, 10));
  ls.setItem('central.campaigns.vitor-gutierrez', JSON.stringify([{ id: 'padrao-do-app' }]));
  await new Promise((r) => setTimeout(r, 90));
  assert.deepEqual(subiu, [],
    'nada sobe antes da busca terminar — senão o padrão do app apagaria o que está no banco');
}

/* ================= juntar em vez de atropelar =================

   Enquanto o ClickUp era o original, perder uma gravação custava um
   "sincroniza de novo". Sem ele, a tarefa só existe aqui — e o vetor
   inteiro subindo a cada mudança apagaria o trabalho de quem salvou antes.
   O que tem que valer: só o que EU mudei vai por cima. */
{
  const gLocal = new Map();
  const ls = { getItem:(k)=>gLocal.has(k)?gLocal.get(k):null, setItem:(k,v)=>gLocal.set(k,String(v)) };
  const ss = { _m:new Map(), getItem(k){return this._m.has(k)?this._m.get(k):null},
               setItem(k,v){this._m.set(k,v)}, removeItem(k){this._m.delete(k)} };
  const CHAVE = 'central.tasks.vitor-gutierrez';
  const banco = [{ chave: CHAVE, dono: null,
    valor: [{ id:'a', titulo:'A', status:'a fazer' }, { id:'b', titulo:'B', status:'a fazer' }] }];
  const subidas = [];
  const achar = () => banco.find((l) => l.chave === CHAVE && l.dono === null);
  const sbJunta = {
    auth:{ getSession: async () => ({ data:{ session:{ user:{ id: UID } } } }) },
    from: () => ({
      select: () => ({
        or: async () => ({ data: banco, error: null }),
        eq: () => ({ is: () => ({ maybeSingle: async () => ({ data: achar(), error: null }) }),
                     eq: () => ({ maybeSingle: async () => ({ data: achar(), error: null }) }) }),
      }),
      upsert: (linha) => { subidas.push(linha.valor); achar().valor = linha.valor; return Promise.resolve({ error:null }) },
    }),
  };
  const jan = { supabase:{ createClient: () => sbJunta }, __SB_ANON__:'x',
                location:{ reload(){} }, addEventListener(){} };
  new Function('window','localStorage','sessionStorage','location','document','console',
               'MutationObserver','addEventListener','setInterval',fonte)(
    jan, ls, ss, jan.location, documento, console, MutationObserver, () => {}, () => 0);
  await new Promise((r) => setTimeout(r, 40));

  /* enquanto esta aba estava aberta, outra pessoa fechou a B e criou a C */
  achar().valor = [{ id:'a', titulo:'A', status:'a fazer' },
                   { id:'b', titulo:'B', status:'feito' },
                   { id:'c', titulo:'C', status:'a fazer' }];

  /* e eu, que só sei da A e da B, renomeio a A e salvo a minha lista inteira */
  ls.setItem(CHAVE, JSON.stringify([{ id:'a', titulo:'A renomeada', status:'a fazer' },
                                    { id:'b', titulo:'B', status:'a fazer' }]));
  await new Promise((r) => setTimeout(r, 60));

  const fim = subidas[subidas.length - 1];
  assert.ok(fim, 'a gravação chegou ao banco');
  const porId = Object.fromEntries(fim.map((t) => [t.id, t]));
  assert.equal(porId.a.titulo, 'A renomeada', 'o que eu mudei vale');
  assert.equal(porId.b.status, 'feito',
    'o que a outra pessoa fechou continua fechado — antes minha lista velha desfazia');
  assert.ok(porId.c, 'a tarefa que ela criou não some só porque eu não a tinha');

  /* apagar de propósito continua apagando */
  ls.setItem(CHAVE, JSON.stringify(fim.filter((t) => t.id !== 'c')));
  await new Promise((r) => setTimeout(r, 60));
  const depois = subidas[subidas.length - 1];
  assert.ok(!depois.some((t) => t.id === 'c'), 'o que eu tiro, sai mesmo');
  assert.equal(depois.length, 2, 'e só isso sai');
  /* e a lista que chega vazia não apaga o que existe: já aconteceu uma vez,
     com as dezoito campanhas */
  ls.setItem(CHAVE, JSON.stringify([]));
  await new Promise((r) => setTimeout(r, 60));
  const vazio = subidas[subidas.length - 1];
  assert.equal(vazio.length, 2, 'lista vazia por cima de lista cheia é ignorada');
}

console.log('ponte: 17 checagens passaram');
