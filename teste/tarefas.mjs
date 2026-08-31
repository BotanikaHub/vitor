/* A rota /api/tarefas entrega o planejamento em texto, para sessões do
   Claude que não têm ferramenta de consulta ao banco. O que importa aqui
   é o formato: a tarefa tem que sair pronta para entrar no ClickUp, no
   mesmo padrão que a equipe já usa. */
import { nomeDaTarefa, emTexto } from '../api/tarefas.mjs';

let ok_=0, mau=0;
const ok=(n,c,extra='')=>{c?ok_++:mau++;console.log((c?'OK  | ':'FALHA | ')+n+(extra?' | '+extra:''))};

const l1={dia:'2026-09-09',campanha:'Dia D — 09/09',marca:'Botanika',
  canal:'E-mails base antiga',o_que_sai:'2 vendas',quem_faz:'Pedro cria e Sarah programa',base:'Base geral'};
const l2={dia:'2026-09-07',campanha:'Orgânico — API',marca:'VermeFree',
  canal:'WhatsApp API',o_que_sai:'1',quem_faz:'Sarah',base:'—'};

const n1=nomeDaTarefa(l1), n2=nomeDaTarefa(l2);
ok('a tarefa sai no padrão AÇÃO — canal · dia | MARCA',
   /^DIA D — E-mails base antiga \(2 vendas\) · QUA 09\/09 \| BOTANIKA$/.test(n1), n1);
ok('a data que já vinha no nome da ação não se repete',
   !/09\/09.*09\/09/.test(n1), n1);
ok('quantidade 1 não vira ruído no nome',
   /^ORGÂNICO — API — WhatsApp API · SEG 07\/09 \| VERMEFREE$/.test(n2), n2);
ok('a marca vai em caixa alta no fim, como no ClickUp',
   n1.endsWith('| BOTANIKA') && n2.endsWith('| VERMEFREE'));

const camps=[{campanha:'Dia D — 09/09',marca:'Botanika',formato:'diaD',
  inicio:'2026-09-09',fim:'2026-09-09',meta:60000,verba:6000}];
const txt=emTexto([l1,l2],camps,'2026-09-07','2026-09-13');
ok('o texto abre dizendo o período e o tamanho',
   /PLANEJAMENTO · 2026-09-07 a 2026-09-13/.test(txt) && /2 peças a produzir, em 2 ações/.test(txt),
   txt.split('\n')[1]);
ok('lista as ações com meta e verba',
   /Botanika · Dia D — 09\/09 · diaD · 2026-09-09 a 2026-09-09 · meta R\$ 60\.000 · verba R\$ 6\.000/.test(txt),
   txt.split('\n').find(l=>/Dia D/.test(l)));
ok('agrupa as tarefas por dia, em ordem',
   txt.indexOf('SEG 2026-09-07') < txt.indexOf('QUA 2026-09-09'));
ok('cada tarefa vem com responsável',
   /responsável: Pedro cria e Sarah programa/.test(txt));
ok('e com a base quando existe, sem traço solto',
   /base: Base geral/.test(txt) && !/base: —/.test(txt));
ok('o cabeçalho das tarefas anuncia o padrão',
   /TAREFAS, NO PADRÃO DO CLICKUP/.test(txt));

/* período vazio não pode devolver algo quebrado */
const vazio=emTexto([],[],'2026-10-01','2026-10-07');
ok('período sem nada ainda responde direito',
   /0 peças a produzir, em 0 ações/.test(vazio), vazio.split('\n')[1]);

console.log(`\n${ok_} OK, ${mau} falha(s)`);
process.exit(mau?1:0);
