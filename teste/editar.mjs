/* Editar depois de criar. O caso que motivou tudo: a semana do cliente
   foi estendida em mais dias e não havia por onde mexer — e "regerar"
   jogava fora o que a equipe já tinha escrito no cronograma. */
import { chromium } from 'playwright-core';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const raiz = resolve(dirname(fileURLToPath(import.meta.url)), '..');

let ok_=0, mau=0;
const ok=(n,c,extra='')=>{c?ok_++:mau++;console.log((c?'OK  | ':'FALHA | ')+n+(extra?' | '+extra:''))};

const b = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args:['--no-sandbox']});

async function abrir(){
  const p=await b.newPage({viewport:{width:1500,height:1100}});
  const erros=[];p.on('pageerror',e=>erros.push(e.message));
  await p.route('**/dados/*.json*', r=>r.fulfill({status:404,body:''}));
  await p.route('**/*.supabase.co/**',
    r=>r.fulfill({status:200,contentType:'application/json',body:'[]'}));
  await p.goto('file://'+resolve(raiz,'index.html'),{waitUntil:'networkidle'});
  await p.evaluate(()=>{try{localStorage.clear()}catch(e){}});
  await p.reload({waitUntil:'networkidle'});
  await p.waitForTimeout(600);
  return {p,erros};
}
const G=(p,f,a)=>p.evaluate(f,a);

/* Cria uma semana temática de 5 dias e escreve à mão no cronograma,
   como a equipe faz. */
const semana=(p,op={})=>p.evaluate(o=>{
  AS={noId:null,tipo:o.tipo||'semana',tema:'Imunidade',inicio:o.ini||'2026-09-07',
    fim:o.fim||'2026-09-11',meta:60000,sugerida:0,inv:6000,
    fontes:{traf:{meta:16000,inv:4000},api:{meta:16000,inv:2000}},nome:o.nome||'Semana da Imunidade',
    produtos:catalogo().map(x=>x.sku),modoDesc:'todos',descGeral:10,descPorSku:{},
    extras:[],canais:CANAIS.map(c=>c[0]),receita:null};
  criarCampanha();
  return D.campanhas.findIndex(c=>c.nome===(o.nome||'Semana da Imunidade'));
},op);
const cron=(p,i)=>p.evaluate(k=>{
  const s=D.campanhas[k].secoes.find(x=>/CANAIS/i.test(x.t));
  return {c:s.c.slice(),l:s.l.map(l=>l.slice())};
},i);

// ---- 1. estender a semana mantém o que foi escrito e traz os dias novos ----
{
  const {p,erros}=await abrir();
  const i=await semana(p);
  const antes=await cron(p,i);
  ok('a semana de 5 dias sai dia a dia, com a preparação',
     antes.c.length===10&&/SEX 11\/09/.test(antes.c[8]), antes.c.join(' · '));

  await G(p,k=>{
    const s=D.campanhas[k].secoes.find(x=>/CANAIS/i.test(x.t));
    s.l[0][3]='3 vendas À MÃO';                    // célula de um dia
    s.l[2][s.c.length-1]='Sarah especial';         // quem faz
    s.c[2]='SÁB 05/09 (véspera)';                  // rótulo renomeado
    s.l.push(['Canal inventado','base X',...s.c.slice(2,-1).map(()=>'x'),'Gabriel']);
  },i);

  await G(p,k=>editarAcao(k),i);
  ok('o editor abriu', await G(p,()=>!!document.querySelector('#ed-fim')));
  await p.fill('#ed-fim','2026-09-14');
  await p.dispatchEvent('#ed-fim','change');
  await p.waitForTimeout(150);
  const prev=await G(p,()=>document.querySelector('#ed-previa').innerText);
  ok('a prévia diz quantos dias e o que entra no cronograma',
     /8 dias de ação/.test(prev)&&/ganha 3 colunas/.test(prev)&&/12\/09/.test(prev), prev);
  ok('a prévia promete guardar o que foi escrito',
     /continua onde está/.test(prev));

  await p.click('#modal-cx .bts .ok');
  await p.waitForTimeout(300);
  const dep=await cron(p,i);
  ok('os três dias novos entraram', dep.c.length===13&&/SEG 14\/09/.test(dep.c[11]),
     dep.c.join(' · '));
  ok('nenhum dia antigo se perdeu', ['DOM 06/09','SEG 07/09','SEX 11/09']
     .every(d=>dep.c.includes(d)), dep.c.join(' · '));
  ok('a célula escrita à mão continua no dia dela', dep.l[0][3]==='3 vendas À MÃO', dep.l[0][3]);
  ok('o "quem faz" trocado à mão continua',
     dep.l[2][dep.c.length-1]==='Sarah especial', dep.l[2][dep.c.length-1]);
  ok('o rótulo renomeado à mão continua', dep.c[2]==='SÁB 05/09 (véspera)', dep.c[2]);
  const inv=dep.l.find(l=>l[0]==='Canal inventado');
  ok('a linha inventada sobreviveu, com os dias novos em branco',
     !!inv&&inv[2]==='x'&&inv[10]===''&&inv[dep.c.length-1]==='Gabriel', JSON.stringify(inv));
  ok('os dias novos vieram preenchidos com o ritmo padrão',
     dep.l[0][11]==='2 última chance', dep.l[0][11]);
  ok('o que ninguém tocou acompanhou o gerador',
     dep.l[0][9]==='1 vendas', dep.l[0][9]);
  ok('as datas mudaram na campanha', await G(p,k=>D.campanhas[k].fim,i)==='2026-09-14');
  ok('o período no SOBRE O EVENTO acompanhou',
     /07\/09 a 14\/09/.test(await G(p,k=>D.campanhas[k].secoes
       .find(s=>/SOBRE O EVENTO/i.test(s.t)).l.map(l=>l[1]).join(' | '),i)));
  ok('sem erro de JS', erros.length===0, erros.join(' | '));
  await p.close();
}

// ---- 2. encurtar avisa antes e tira só os dias que saíram ----
{
  const {p,erros}=await abrir();
  const i=await semana(p);
  await G(p,k=>editarAcao(k),i);
  await p.fill('#ed-fim','2026-09-09');
  await p.dispatchEvent('#ed-fim','change');
  await p.waitForTimeout(150);
  const prev=await G(p,()=>document.querySelector('#ed-previa').innerText);
  ok('avisa quais colunas saem', /saem as colunas/.test(prev)&&/11\/09/.test(prev), prev);
  ok('e o aviso vem marcado',
     await G(p,()=>document.querySelector('#ed-previa').className.includes('alerta')));
  await p.click('#modal-cx .bts .ok');
  await p.waitForTimeout(300);
  const dep=await cron(p,i);
  ok('os dias que saíram sumiram', !dep.c.includes('SEX 11/09'), dep.c.join(' · '));
  ok('os que ficaram continuam', dep.c.includes('QUA 09/09'), dep.c.join(' · '));
  ok('sem erro de JS', erros.length===0, erros.join(' | '));
  await p.close();
}

// ---- 3. a oferta virou editável ----
{
  const {p,erros}=await abrir();
  const i=await semana(p);
  await G(p,k=>editarOferta(k),i);
  await p.waitForTimeout(200);
  ok('abre direto na aba da oferta', await G(p,()=>!!document.querySelector('#ed-frete')));
  const quantos=await G(p,k=>D.campanhas[k].oferta.produtos.length,i);
  await p.click('#ed-corpo .lin input[type=checkbox]');
  await p.fill('#ed-frete','Grátis acima de R$ 99');
  await p.fill('#ed-brinde','Coqueteleira acima de R$ 400');
  await p.fill('#ed-extras','Combo Imunidade · 20% OFF');
  await p.click('#modal-cx .bts .ok');
  await p.waitForTimeout(300);
  const o=await G(p,k=>D.campanhas[k].oferta,i);
  ok('tirou o produto desmarcado', o.produtos.length===quantos-1,
     `${quantos} → ${o.produtos.length}`);
  ok('gravou o frete novo', o.frete==='Grátis acima de R$ 99', o.frete);
  ok('gravou o brinde', /Coqueteleira/.test(o.brinde), o.brinde);
  ok('gravou o produto fora do catálogo', o.extras[0]==='Combo Imunidade · 20% OFF');
  const of=await G(p,k=>D.campanhas[k].secoes.find(s=>/SOBRE A OFERTA/i.test(s.t))
    .l.map(l=>l[0]+' | '+l[1]),i);
  ok('a seção da oferta no TAP acompanhou',
     of.some(l=>/Grátis acima de R\$ 99/.test(l))&&of.some(l=>/Combo Imunidade/.test(l)),
     of.join(' / '));
  ok('e o produto fora do catálogo entrou antes dos bônus, não no fim',
     of.findIndex(l=>/Fora do catálogo/.test(l))<of.findIndex(l=>/Bônus universal/.test(l)),
     of.join(' / '));
  ok('sem erro de JS', erros.length===0, erros.join(' | '));
  await p.close();
}

// ---- 4. canais de execução e verba ----
{
  const {p,erros}=await abrir();
  const i=await semana(p);
  await G(p,k=>{
    const s=D.campanhas[k].secoes.find(x=>/CANAIS/i.test(x.t));
    s.l.find(l=>l[0]==='WhatsApp API')[3]='NÃO APAGAR';
  },i);
  await G(p,k=>editarCanais(k),i);
  await p.waitForTimeout(200);
  ok('abre direto na aba dos canais', await G(p,()=>!!document.querySelector('#ed-soma')));
  await G(p,()=>[...document.querySelectorAll('#ed-corpo .lin[data-canal]')]
    .find(x=>x.dataset.canal==='Página de captura').querySelector('input').click());
  await p.click('#modal-cx .bts .ok');
  await p.waitForTimeout(300);
  const dep=await cron(p,i);
  const nomes=dep.l.map(l=>l[0]);
  ok('o canal desmarcado saiu do cronograma', !nomes.includes('Página de captura'),
     nomes.join(' · '));
  ok('os outros ficaram', nomes.includes('WhatsApp API')&&nomes.length===10,
     'linhas='+nomes.length);
  ok('e o que estava escrito neles não foi junto',
     dep.l.find(l=>l[0]==='WhatsApp API')[3]==='NÃO APAGAR');
  ok('não deixa desligar todos os canais', await (async()=>{
    await G(p,k=>editarCanais(k),i);await p.waitForTimeout(200);
    await G(p,()=>{ED.canais=[];});
    await p.click('#modal-cx .bts .ok');await p.waitForTimeout(250);
    return await G(p,()=>document.querySelector('#modal').classList.contains('on'));
  })());
  await p.evaluate(()=>fecharModal());
  ok('sem erro de JS', erros.length===0, erros.join(' | '));
  await p.close();
}

// ---- 5. nome, formato e tema ----
{
  const {p,erros}=await abrir();
  const i=await semana(p);
  await G(p,k=>editarAcao(k),i);
  await p.fill('#ed-nome','Semana do Sono');
  await p.fill('#ed-tema','Sono');
  await p.selectOption('#ed-tipo','gap');
  await p.waitForTimeout(150);
  await p.click('#modal-cx .bts .ok');
  await p.waitForTimeout(300);
  const c=await G(p,k=>({nome:D.campanhas[k].nome,tipo:D.campanhas[k].tipo,
    tema:D.campanhas[k].tema,
    evento:D.campanhas[k].secoes.find(s=>/SOBRE O EVENTO/i.test(s.t)).l.map(l=>l[1]).join(' | '),
    no:M().nos.find(n=>n.campId===D.campanhas[k].id)?.t}),i);
  ok('gravou o nome novo', c.nome==='Semana do Sono', c.nome);
  ok('gravou o formato novo', c.tipo==='gap', c.tipo);
  ok('gravou o tema', c.tema==='Sono', c.tema);
  ok('o TAP acompanhou o nome e o formato',
     /Semana do Sono/.test(c.evento)&&/ticket ou frete/.test(c.evento), c.evento);
  ok('o nó do mapa acompanhou', c.no==='Semana do Sono', c.no);
  ok('sem erro de JS', erros.length===0, erros.join(' | '));
  await p.close();
}

// ---- 6. dá pra editar de onde a ação aparece ----
{
  const {p,erros}=await abrir();
  await semana(p);
  const botao=async pg=>{
    await p.click(`nav.paginas button[data-pg="${pg}"]`);
    await p.waitForTimeout(350);
    return G(p,x=>{
      const b=[...document.querySelectorAll('#pg-'+x+' button')]
        .find(e=>/^editar/i.test(e.textContent.trim()));
      if(!b)return null;
      b.click();
      const aberto=document.querySelector('#modal').classList.contains('on');
      fecharModal();return aberto;
    },pg);
  };
  ok('do Mês', await botao('mes')===true);
  /* a semana aberta por padrão é a primeira do mês; a ação está na segunda */
  await G(p,()=>{semanaSel=semanasDoMes().findIndex(x=>
    dISO('2026-09-09')>=x.a&&dISO('2026-09-09')<=x.b);pintarSemana()});
  ok('da Semana', await botao('semana')===true);
  ok('das Campanhas', await botao('camp')===true);
  ok('sem erro de JS', erros.length===0, erros.join(' | '));
  await p.close();
}

// ---- 7. o mês também: marca, mês e ano ----
{
  const {p,erros}=await abrir();
  await p.click('nav.paginas button[data-pg="mes"]');
  await p.waitForTimeout(300);
  await G(p,()=>editarMetasMes());
  await p.waitForTimeout(200);
  ok('o modal do mês pede mês/ano e marca',
     await G(p,()=>!!document.querySelector('#m-quando')&&!!document.querySelector('#m-marca')));
  await p.fill('#m-quando','10/2027');
  await p.selectOption('#m-marca','VermeFree');
  await p.fill('#m-1','500.000');
  await p.click('#modal-cx .ok');
  await p.waitForTimeout(500);
  const m=await G(p,()=>({mes:mesAtual().mes,ano:mesAtual().ano,marca:marcaDo(mesAtual()),
    meta:mesAtual().metas[0], raiz:M().nos.find(n=>!n.pai).t,
    titulo:document.querySelector('#tit-mes').textContent}));
  ok('trocou o mês e o ano', m.mes===10&&m.ano===2027, `${m.mes}/${m.ano}`);
  ok('trocou a marca', m.marca==='VermeFree', m.marca);
  ok('a meta continuou sendo gravada', m.meta===500000, String(m.meta));
  ok('o topo da página acompanhou', /Outubro/i.test(m.titulo)&&/2027/.test(m.titulo), m.titulo);
  ok('a raiz do mapa acompanhou', /OUTUBRO/.test(m.raiz)&&/VERMEFREE/.test(m.raiz), m.raiz);
  ok('recusa mês repetido na mesma marca', await (async()=>{
    await G(p,()=>{D.meses.push({id:999,ano:2027,mes:11,marca:'VermeFree',metas:[1,2,3]})});
    await G(p,()=>editarMetasMes());await p.waitForTimeout(150);
    await p.fill('#m-quando','11/2027');
    await p.click('#modal-cx .ok');await p.waitForTimeout(250);
    return await G(p,()=>mesAtual().mes)===10;
  })());
  await p.evaluate(()=>fecharModal());
  ok('sem erro de JS', erros.length===0, erros.join(' | '));
  await p.close();
}

// ---- 8. seção renomeada à mão continua acompanhando as datas ----
{
  const {p,erros}=await abrir();
  const i=await semana(p);
  await G(p,k=>{
    const c=D.campanhas[k];
    c.secoes.find(s=>/CANAIS/i.test(s.t)).t='O QUE SAI POR DIA';
  },i);
  await G(p,k=>editarAcao(k),i);
  await p.fill('#ed-fim','2026-09-13');
  await p.click('#modal-cx .bts .ok');
  await p.waitForTimeout(300);
  const s=await G(p,k=>{
    const x=D.campanhas[k].secoes.find(y=>y.t==='O QUE SAI POR DIA');
    return x?{c:x.c.slice(),n:D.campanhas[k].secoes.length}:null;
  },i);
  ok('a seção renomeada continua existindo, com o nome novo', !!s, JSON.stringify(s&&s.c));
  ok('e ganhou os dias novos', !!s&&s.c.includes('SÁB 12/09'), s&&s.c.join(' · '));
  ok('não nasceu uma seção duplicada', s&&s.n===7, 'seções='+(s&&s.n));
  ok('sem erro de JS', erros.length===0, erros.join(' | '));
  await p.close();
}

// ---- 9. seção criada à mão fica intocada ----
{
  const {p,erros}=await abrir();
  const i=await semana(p);
  await G(p,k=>D.campanhas[k].secoes.splice(2,0,
    {t:'MINHAS NOTAS',c:['Campo','Valor'],l:[['combinado com o cliente','sim']]}),i);
  await G(p,k=>editarAcao(k),i);
  await p.fill('#ed-fim','2026-09-13');
  await p.click('#modal-cx .bts .ok');
  await p.waitForTimeout(300);
  const r=await G(p,k=>{
    const c=D.campanhas[k];
    const n=c.secoes.find(s=>s.t==='MINHAS NOTAS');
    const cr=c.secoes.find(s=>/CANAIS/i.test(s.t));
    return {nota:n&&n.l,cols:cr&&cr.c,total:c.secoes.length};
  },i);
  ok('a seção da pessoa continua igual',
     JSON.stringify(r.nota)===JSON.stringify([['combinado com o cliente','sim']]),
     JSON.stringify(r.nota));
  ok('e o cronograma seguiu sendo atualizado', r.cols.includes('SÁB 12/09'), r.cols.join(' · '));
  ok('nenhuma seção sumiu nem se duplicou', r.total===8, 'seções='+r.total);
  ok('sem erro de JS', erros.length===0, erros.join(' | '));
  await p.close();
}

// ---- 10. excluir um mês criado por engano ----
{
  const {p,erros}=await abrir();
  await semana(p);
  const quantos=await G(p,()=>D.meses.length);
  await G(p,()=>editarMetasMes());
  await p.waitForTimeout(200);
  ok('o botão de excluir aparece quando há mais de um mês',
     await G(p,()=>!!document.querySelector('#modal-cx .bts .perigo')));

  let perguntou='';
  p.once('dialog',async d=>{perguntou=d.message();await d.dismiss()});
  await p.click('#modal-cx .bts .perigo');
  await p.waitForTimeout(250);
  ok('pergunta antes, dizendo o que vai junto',
     /campanha/.test(perguntou)&&/mapa/.test(perguntou), perguntou.replace(/\n/g,' '));
  ok('desistir não apaga nada', await G(p,()=>D.meses.length)===quantos);

  p.once('dialog',async d=>{await d.accept()});
  await p.click('#modal-cx .bts .perigo');
  await p.waitForTimeout(500);
  const dep=await G(p,()=>({meses:D.meses.length,
    camps:D.campanhas.filter(c=>c.nome==='Semana da Imunidade').length,
    mapas:D.mapas.length, ativo:D.mesAtivo,
    existe:D.meses.some(m=>m.id===D.mesAtivo)}));
  ok('o mês saiu', dep.meses===quantos-1, `${quantos} → ${dep.meses}`);
  ok('as campanhas dele foram junto', dep.camps===0);
  ok('o mapa dele foi junto', dep.mapas===dep.meses);
  ok('sobrou um mês válido aberto', dep.existe);
  ok('sem erro de JS', erros.length===0, erros.join(' | '));
  await p.close();
}

// ---- 11. o que já existia continua funcionando ----
{
  const {p,erros}=await abrir();
  const i=await semana(p,{nome:'Dia D Kids',tipo:'diaD',ini:'2026-09-09',fim:'2026-09-09'});
  ok('campanha de um dia nasce inteira',
     (await cron(p,i)).c.length>=4, (await cron(p,i)).c.join(' · '));
  await G(p,k=>editarAcao(k),i);
  await p.waitForTimeout(150);
  await p.click('#modal-cx .bts button:not(.ok)');   // cancelar
  await p.waitForTimeout(200);
  ok('cancelar não muda nada',
     await G(p,k=>D.campanhas[k].fim,i)==='2026-09-09');
  await G(p,k=>editarAcao(k),i);
  await p.fill('#ed-fim','2026-09-01');
  await p.click('#modal-cx .bts .ok');
  await p.waitForTimeout(250);
  ok('recusa fim antes do início',
     await G(p,()=>document.querySelector('#modal').classList.contains('on'))&&
     await G(p,k=>D.campanhas[k].fim,i)==='2026-09-09');
  await p.evaluate(()=>fecharModal());
  ok('sem erro de JS', erros.length===0, erros.join(' | '));
  await p.close();
}

await b.close();
console.log(`\n${ok_} OK, ${mau} falha(s)`);
process.exit(mau?1:0);
