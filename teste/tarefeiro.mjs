/* A aba Tarefas: o ClickUp aqui dentro. O Supabase é simulado — a suíte
   nunca fala com a base de verdade — e o que se testa é o que a pessoa vê
   e o que a página grava quando ela mexe numa tarefa. */
import { chromium } from 'playwright-core';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const raiz = resolve(dirname(fileURLToPath(import.meta.url)), '..');

let ok_=0, mau=0;
const ok=(n,c,extra='')=>{c?ok_++:mau++;console.log((c?'OK  | ':'FALHA | ')+n+(extra?' | '+extra:''))};

const b = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args:['--no-sandbox']});

const hoje=new Date(), d=n=>{const x=new Date(hoje);x.setDate(x.getDate()+n);
  return `${x.getFullYear()}-${String(x.getMonth()+1).padStart(2,'0')}-${String(x.getDate()).padStart(2,'0')}`};

/* O que a base devolve. Uma mãe com duas filhas, uma avulsa e uma da
   outra marca, para o filtro ter o que filtrar. */
const TAREFAS=()=>[
  {assinatura:'BOTANIKA§1§mae',marca:'BOTANIKA',campanha:'Dia D Kids',
   nome:'DIA D KIDS — 10/09 | BOTANIKA',responsavel:'Pedro Lage',prioridade:'urgent',
   dia:d(3),inicio:d(-2),situacao:'aprovada',status:'a fazer',checklist:null,
   checklist_feito:[],ordem:0,mae_de:null,descricao:'# A oferta\n30% OFF'},
  {assinatura:'BOTANIKA§1§copy',marca:'BOTANIKA',campanha:'Dia D Kids',
   nome:'DIA D KIDS — Criar toda a copy · QUI 04/09 até 18h | BOTANIKA',
   responsavel:'Pedro Lage',prioridade:'urgent',dia:d(-1),inicio:d(-2),
   situacao:'aprovada',status:'a fazer',mae_de:'BOTANIKA§1§mae',ordem:1,
   checklist:['E-mail · QUI 04/09 · disparo 1','WhatsApp · SEX 05/09 · disparo 1'],
   checklist_feito:[]},
  {assinatura:'BOTANIKA§1§artes',marca:'BOTANIKA',campanha:'Dia D Kids',
   nome:'DIA D KIDS — Criar todas as artes · QUI 04/09 até 18h | BOTANIKA',
   responsavel:'Ítalo Neves',prioridade:'urgent',dia:d(2),inicio:d(-2),
   situacao:'aprovada',status:'feito',mae_de:'BOTANIKA§1§mae',ordem:2,
   checklist:null,checklist_feito:[]},
  {assinatura:'MAO§9§avulsa',marca:'BOTANIKA',campanha:'Avulsa',
   nome:'Trocar o banner da home',responsavel:'Gabriel',prioridade:'normal',
   dia:d(1),situacao:'aprovada',status:'fazendo',mae_de:null,ordem:0,
   checklist:null,checklist_feito:[]},
  {assinatura:'VERMEFREE§2§mae',marca:'VERMEFREE',campanha:'Frasco novo',
   nome:'FRASCO NOVO — 20/09 | VERMEFREE',responsavel:'Sarah | Gestora',
   prioridade:'high',dia:d(9),situacao:'aprovada',status:'revisar',mae_de:null,
   ordem:0,checklist:null,checklist_feito:[]},
];

/* Base de mentira: só o suficiente do PostgREST que a página usa. */
function baseFalsa({tarefas=TAREFAS(),falharPatch=false,falharGet=false}={}){
  const reg={tarefas,patches:[],posts:[],gets:0};
  return {reg, rota: async r=>{
    const req=r.request(), u=req.url();
    if(!/tarefas_planejadas/.test(u)){
      // a tabela do planejamento: vazia, para o resto da página seguir igual
      if(req.method()==='GET')return r.fulfill({status:200,contentType:'application/json',body:'[]'});
      return r.fulfill({status:201,contentType:'application/json',body:'[]'});
    }
    if(req.method()==='GET'){
      reg.gets++;
      if(falharGet)return r.fulfill({status:500,body:'{}'});
      return r.fulfill({status:200,contentType:'application/json',
        body:JSON.stringify(reg.tarefas)});
    }
    if(req.method()==='PATCH'){
      const corpo=JSON.parse(req.postData()||'{}');
      const ass=decodeURIComponent((u.match(/assinatura=eq\.([^&]+)/)||[])[1]||'');
      reg.patches.push({assinatura:ass,corpo});
      if(falharPatch)return r.fulfill({status:500,body:'{}'});
      const alvo=reg.tarefas.find(t=>t.assinatura===ass);
      if(alvo)Object.assign(alvo,corpo,{atualizada_em:new Date().toISOString()});
      return r.fulfill({status:200,contentType:'application/json',
        body:JSON.stringify(alvo?[alvo]:[])});
    }
    if(req.method()==='POST'){
      const linhas=JSON.parse(req.postData()||'[]');
      reg.posts.push(...linhas);
      linhas.forEach(l=>reg.tarefas.push(Object.assign(
        {checklist:null,checklist_feito:[],ordem:0},l)));
      return r.fulfill({status:201,contentType:'application/json',
        body:JSON.stringify(linhas)});
    }
    return r.fulfill({status:200,body:'[]'});
  }};
}

async function abrir(op={}){
  const {reg,rota}=baseFalsa(op);
  const p=await b.newPage({viewport:{width:1500,height:1000}});
  const erros=[];p.on('pageerror',e=>erros.push(e.message));
  await p.route('**/dados/*.json*', r=>r.fulfill({status:404,body:''}));
  await p.route('**/*.supabase.co/**', rota);
  await p.goto('file://'+resolve(raiz,'index.html'),{waitUntil:'networkidle'});
  await p.evaluate(()=>{try{localStorage.clear()}catch(e){}});
  await p.reload({waitUntil:'networkidle'});
  await p.waitForTimeout(600);
  if(!op.semAbrir){
    await p.click('nav.paginas button[data-pg="tarefas"]');
    await p.waitForTimeout(500);
  }
  return {p,reg,erros};
}
const G=(p,f,a)=>p.evaluate(f,a);
const corpo=p=>G(p,()=>document.querySelector('#tf-corpo').innerText);
const resumo=p=>G(p,()=>document.querySelector('#tf-resumo').innerText);

// ---- 1. abriu a aba: leu a base e montou o quadro ----
{
  const {p,reg,erros}=await abrir();
  ok('a aba existe na navegação',
     await G(p,()=>!!document.querySelector('nav.paginas button[data-pg="tarefas"]')));
  ok('leu as tarefas ao entrar na aba', reg.gets>=1, 'gets='+reg.gets);
  ok('não leu antes de abrir a aba, no boot',
     await G(p,()=>TF.length)>0);
  const t=await corpo(p);
  ok('o quadro tem as cinco colunas do ClickUp',
     await G(p,()=>document.querySelectorAll('#pg-tarefas .tf-col').length)===5,
     'colunas='+await G(p,()=>document.querySelectorAll('#pg-tarefas .tf-col').length));
  ok('as colunas usam os nomes de status de lá',
     /a fazer/i.test(t)&&/ajustes necessários/i.test(t)&&/revisar/i.test(t), t.split('\n')[0]);
  ok('só a marca do mês aparece', !/FRASCO NOVO/.test(t), 'vazou VermeFree');
  ok('a mãe com filhas não vira cartão solto no quadro',
     !/DIA D KIDS — 10\/09/.test(t));
  ok('a tarefa avulsa aparece', /Trocar o banner da home/.test(t));
  ok('mostrou o progresso do checklist', /0\/2/.test(t), t.split('\n').slice(0,3).join(' · '));
  ok('marcou a atrasada',
     await G(p,()=>document.querySelectorAll('#pg-tarefas .tf-card.atrasada').length)===1,
     'atrasadas='+await G(p,()=>document.querySelectorAll('#pg-tarefas .tf-card.atrasada').length));
  const r=await resumo(p);
  ok('o resumo conta as concluídas', /1 de 3/.test(r), r.replace(/\n/g,' · '));
  ok('o resumo conta as atrasadas', /Atrasadas\n1\n/i.test(r), r.replace(/\n/g,' · '));
  ok('carimbou a hora da leitura',
     /lido \d{2}:\d{2}/.test(await G(p,()=>document.querySelector('#tf-quando').textContent)));
  ok('sem erro de JS', erros.length===0, erros.join(' | '));
  await p.close();
}

// ---- 2. as duas marcas e o filtro por pessoa ----
{
  const {p,erros}=await abrir();
  await p.click('#tf-marca');
  await p.waitForTimeout(200);
  ok('o botão mostra as duas marcas', /FRASCO NOVO/.test(await corpo(p)));
  await p.click('#tf-marca');
  await p.waitForTimeout(200);
  ok('e volta pra marca do mês', !/FRASCO NOVO/.test(await corpo(p)));
  await p.selectOption('#tf-quem','Ítalo Neves');
  await p.waitForTimeout(200);
  const t=await corpo(p);
  ok('filtrou por pessoa', /Criar todas as artes/.test(t)&&!/Trocar o banner/.test(t),
     t.replace(/\n+/g,' · ').slice(0,120));
  ok('sem erro de JS', erros.length===0, erros.join(' | '));
  await p.close();
}

// ---- 3. por ação e por pessoa ----
{
  const {p,erros}=await abrir();
  await p.click('#tf-abas button[data-tv="lista"]');
  await p.waitForTimeout(200);
  const l=await corpo(p);
  ok('agrupou pela ação-mãe', /DIA D KIDS — 10\/09/.test(l), l.split('\n')[0]);
  ok('contou as feitas da ação', /1 de 2 feitas/.test(l), l.replace(/\n/g,' · ').slice(0,140));
  ok('a avulsa ficou no bloco sem ação', /Sem ação ligada/.test(l)&&/Trocar o banner/.test(l));
  await p.click('#tf-abas button[data-tv="pessoa"]');
  await p.waitForTimeout(200);
  const q=await corpo(p);
  ok('agrupou por pessoa', /Pedro Lage/.test(q)&&/Gabriel/.test(q), q.split('\n')[0]);
  ok('quem tem atraso vem primeiro', q.indexOf('Pedro Lage')<q.indexOf('Gabriel'));
  ok('não repete o que já está feito', !/Criar todas as artes/.test(q));
  ok('sem erro de JS', erros.length===0, erros.join(' | '));
  await p.close();
}

// ---- 4. abrir uma tarefa e mexer nela ----
{
  const {p,reg,erros}=await abrir();
  await G(p,()=>tfAbrir('BOTANIKA§1§copy'));
  await p.waitForTimeout(200);
  ok('o painel abriu', await G(p,()=>document.querySelector('#tf-painel').classList.contains('on')));
  const f=await G(p,()=>document.querySelector('#tf-folha').innerText);
  ok('mostrou o checklist inteiro',
     /E-mail · QUI 04\/09/i.test(f)&&/WhatsApp/i.test(f), f.split('\n')[1]);
  ok('disse dentro de qual ação está', /DIA D KIDS — 10\/09/.test(f));

  // muda o status
  await p.selectOption('#tf-folha select','fazendo');
  await p.waitForTimeout(400);
  ok('gravou o status', reg.patches.some(x=>x.corpo.status==='fazendo'),
     JSON.stringify(reg.patches));
  ok('gravou na tarefa certa',
     reg.patches[0]?.assinatura==='BOTANIKA§1§copy', reg.patches[0]?.assinatura);

  // marca um item do checklist
  await p.click('#tf-folha .item input');
  await p.waitForTimeout(400);
  const pat=reg.patches.find(x=>x.corpo.checklist_feito);
  ok('gravou o item do checklist', !!pat&&pat.corpo.checklist_feito.length===1,
     JSON.stringify(pat?.corpo));
  ok('a contagem subiu na tela',
     /1 de 2/i.test(await G(p,()=>document.querySelector('#tf-folha').innerText)));

  await p.keyboard.press('Escape');
  await p.waitForTimeout(150);
  ok('Esc fecha o painel',
     !await G(p,()=>document.querySelector('#tf-painel').classList.contains('on')));
  ok('sem erro de JS', erros.length===0, erros.join(' | '));
  await p.close();
}

// ---- 5. a base recusa: a tela volta ao que era ----
{
  const {p,reg,erros}=await abrir({falharPatch:true});
  await G(p,()=>tfAbrir('MAO§9§avulsa'));
  await p.waitForTimeout(200);
  await p.selectOption('#tf-folha select','feito');
  await p.waitForTimeout(600);
  ok('tentou gravar', reg.patches.length===1, 'patches='+reg.patches.length);
  ok('desfez a mudança que não foi salva',
     await G(p,()=>TF.find(t=>t.assinatura==='MAO§9§avulsa').status)==='fazendo',
     await G(p,()=>TF.find(t=>t.assinatura==='MAO§9§avulsa').status));
  ok('avisou a pessoa', /Não consegui salvar/.test(
     await G(p,()=>document.querySelector('#msg').textContent)),
     await G(p,()=>document.querySelector('#msg').textContent));
  ok('sem erro de JS', erros.length===0, erros.join(' | '));
  await p.close();
}

// ---- 6. criar uma tarefa na mão ----
{
  const {p,reg,erros}=await abrir();
  await p.click('#pg-tarefas .mini.forte');
  await p.waitForTimeout(200);
  ok('o formulário abriu', await G(p,()=>!!document.querySelector('#tn-nome')));
  await p.fill('#tn-nome','Revisar o texto do pop-up');
  await p.fill('#tn-quem','Gabriel');
  await p.click('#modal-cx .ok');
  await p.waitForTimeout(500);
  const nova=reg.posts[0];
  ok('gravou a tarefa nova', !!nova&&nova.nome==='Revisar o texto do pop-up',
     JSON.stringify(nova));
  ok('já nasce aprovada e a fazer', nova?.situacao==='aprovada'&&nova?.status==='a fazer');
  ok('nasce na marca do mês', nova?.marca===await G(p,()=>marcaDo(mesAtual()).toUpperCase()),
     nova?.marca);
  ok('apareceu na tela sem precisar recarregar',
     /Revisar o texto do pop-up/.test(await corpo(p)));
  ok('sem nome não cria', await (async()=>{
    await p.click('#pg-tarefas .mini.forte');await p.waitForTimeout(150);
    await p.click('#modal-cx .ok');await p.waitForTimeout(300);
    return reg.posts.length===1;})(), 'posts='+reg.posts.length);
  ok('sem erro de JS', erros.length===0, erros.join(' | '));
  await p.close();
}

// ---- 7. a base fora do ar não derruba a página ----
{
  const {p,erros}=await abrir({falharGet:true});
  ok('explicou que não conseguiu ler',
     /Não consegui ler as tarefas/.test(await corpo(p)), await corpo(p));
  await p.click('nav.paginas button[data-pg="camp"]');
  await p.waitForTimeout(300);
  ok('o resto da página continua de pé',
     await G(p,()=>document.querySelector('#pg-camp').classList.contains('on')));
  ok('sem erro de JS', erros.length===0, erros.join(' | '));
  await p.close();
}

// ---- 8. nada quebrou nas abas de sempre ----
{
  const {p,erros}=await abrir({semAbrir:true});
  for(const pg of ['mapa','mes','semana','camp','gestao']){
    await p.click(`nav.paginas button[data-pg="${pg}"]`);
    await p.waitForTimeout(350);
    ok('abre a aba '+pg, await G(p,x=>document.querySelector('#pg-'+x).classList.contains('on'),pg));
  }
  ok('sem erro de JS ao passear por tudo', erros.length===0, erros.join(' | '));
  await p.close();
}

await b.close();
console.log(`\n${ok_} OK, ${mau} falha(s)`);
process.exit(mau?1:0);
