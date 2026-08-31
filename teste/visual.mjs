/* Três coisas que só se vê olhando: o mapa não pode empilhar nó em cima
   de nó, o calendário não pode afogar a ação com data no que roda todo
   dia, e a semana precisa dizer o que está em promoção. */
import { chromium } from 'playwright-core';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const raiz = resolve(dirname(fileURLToPath(import.meta.url)), '..');

let ok_=0, mau=0;
const ok=(n,c,extra='')=>{c?ok_++:mau++;console.log((c?'OK  | ':'FALHA | ')+n+(extra?' | '+extra:''))};

const b = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args:['--no-sandbox']});
const p = await b.newPage({viewport:{width:1600,height:1100}});
const erros=[]; p.on('pageerror',e=>erros.push(e.message));
await p.route('**/dados/*.json*', r=>r.fulfill({status:404,body:''}));
await p.route('**/*.supabase.co/**',
  r=>r.fulfill({status:503,contentType:'application/json',body:'{}'}));
await p.goto('file://'+resolve(raiz,'index.html'),{waitUntil:'networkidle'});
await p.evaluate(()=>{try{localStorage.clear()}catch(e){}});
await p.reload({waitUntil:'networkidle'});
await p.waitForTimeout(500);
const G=(f,a)=>p.evaluate(f,a);

/* um mês parecido com o real: seis contínuas e duas ações com data */
await G(()=>{
  const m=mesAtual();m.metas=[480000,530000,600000];m.ticket=340;
  [['Perpétuo — Tráfego Direto',100000,'perpetuo'],['Orgânico — Influencers',120000,'perpetuo'],
   ['Orgânico — Instagram',70000,'perpetuo'],['Orgânico — Grupo VIP',30000,'perpetuo'],
   ['Orgânico — API',30000,'perpetuo'],['Orgânico — E-mail',10000,'perpetuo'],
   ['Dia D — 09/09',60000,'diaD'],['Semana do Cliente',60000,'semana']].forEach(([nome,meta,tipo])=>{
    AS={noId:null,tipo,tema:null,
      inicio:tipo==='diaD'?'2026-09-09':tipo==='semana'?'2026-09-14':'2026-09-01',
      fim:tipo==='diaD'?'2026-09-09':tipo==='semana'?'2026-09-18':'2026-09-30',meta,
      fontes:{traf:{meta:Math.round(meta*.267),inv:Math.round(meta*.06)},
              api:{meta:Math.round(meta*.267),inv:Math.round(meta*.03)}},
      nome,produtos:CATALOGO.map(x=>x.sku),modoDesc:'todos',descGeral:12,descPorSku:{},
      extras:['Combo Fitness'],canais:CANAIS.map(c=>c[0]),receita:null};
    AS.inv=invTotal(AS.fontes);criarCampanha();
  });
});
await p.waitForTimeout(500);

// ---- 1. o mapa não empilha nó sobre nó ----
async function colisoes(){
  return G(()=>{
    const cx=[...document.querySelectorAll('#mundo .no')].map(e=>{
      const r=e.getBoundingClientRect();
      return {t:e.textContent.slice(0,24),x1:r.left,x2:r.right,y1:r.top,y2:r.bottom};});
    const bate=[];
    for(let i=0;i<cx.length;i++)for(let j=i+1;j<cx.length;j++){
      const a=cx[i],b=cx[j];
      if(Math.min(a.x2,b.x2)-Math.max(a.x1,b.x1)>2 &&
         Math.min(a.y2,b.y2)-Math.max(a.y1,b.y1)>2) bate.push(`${a.t} × ${b.t}`);
    }
    return {nos:cx.length,n:bate.length,ex:bate.slice(0,3)};
  });
}
{
  await p.click('nav.paginas button[data-pg="mapa"]'); await p.waitForTimeout(700);
  let c=await colisoes();
  ok('com as ações do mês, nenhum nó fica em cima do outro', c.n===0, `${c.nos} nós · ${c.ex.join(' / ')}`);

  /* os filhos nascem pra fora do pai, nunca por cima dele */
  ok('filho nasce fora do pai', await G(()=>M().nos.filter(n=>n.pai).every(n=>{
    const pai=acharNo(n.pai);if(!pai)return true;
    const meia=((medidas[pai.id]?.w||190)+(medidas[n.id]?.w||190))/2;
    return Math.abs(n.x-pai.x)>=meia;
  })));

  await G(()=>{const cs=M().nos.filter(n=>n.campId).slice(0,2);cs.forEach(n=>abrirRamos(n.id))});
  await p.waitForTimeout(1000);
  c=await colisoes();
  ok('com dois TAPs ramificados, ainda nenhum', c.n===0, `${c.nos} nós · ${c.ex.join(' / ')}`);

  await G(()=>{M().nos.filter(n=>n.deTap).forEach(n=>n.fech=false);organizar()});
  await p.waitForTimeout(1400);
  c=await colisoes();
  ok('e com todos os galhos abertos também', c.n===0, `${c.nos} nós · ${c.ex.join(' / ')}`);
  ok('o mapa cresceu de verdade', c.nos>60, c.nos+' nós na tela');

  await G(()=>{M().nos=M().nos.filter(n=>!n.deTap);organizar()});
  await p.waitForTimeout(600);
}

// ---- 2. o calendário guarda a ação com data ----
{
  await p.click('nav.paginas button[data-pg="mes"]'); await p.waitForTimeout(500);
  const faixa=await G(()=>document.querySelector('#cal-continuas').innerText);
  ok('o que roda o mês inteiro sai da grade e vira faixa',
     /Rodando o mês inteiro/i.test(faixa)&&/Perpétuo/.test(faixa),
     faixa.replace(/\n/g,' ').slice(0,70));
  const naGrade=await G(()=>[...new Set([...document.querySelectorAll('#calendario .barra')]
    .map(e=>e.textContent.replace(/[‹›]/g,'').trim()))]);
  ok('a grade fica só com as ações com data', naGrade.length===2
     && naGrade.some(t=>/Dia D/.test(t)) && !naGrade.some(t=>/Perpétuo|Orgânico/.test(t)),
     naGrade.join(' | '));
  const antes=await G(()=>document.querySelectorAll('#calendario .barra').length);
  await p.click('#cal-continuas button.mini'); await p.waitForTimeout(400);
  const depois=await G(()=>document.querySelectorAll('#calendario .barra').length);
  ok('quem quiser ver tudo, vê', depois>antes*5, `${antes} -> ${depois} barras`);
  await p.click('#cal-continuas button.mini'); await p.waitForTimeout(400);
  ok('e volta a limpar', await G(()=>document.querySelectorAll('#calendario .barra').length)===antes);
}

// ---- 3. a oferta da semana ----
{
  await p.click('nav.paginas button[data-pg="semana"]'); await p.waitForTimeout(400);
  await G(()=>{semanaSel=1;pintarSemana()}); await p.waitForTimeout(400);
  const t=await G(()=>document.querySelector('#oferta-semana').innerText);
  ok('a semana do Dia D mostra a oferta dele', /Dia D — 09\/09/.test(t), t.split('\n')[0]);
  ok('com produto, preço cheio, desconto e preço final',
     /Tri\[Mg\]/.test(t)&&/R\$ 87,50/.test(t)&&/12% OFF/.test(t)&&/R\$ 77,00/.test(t),
     t.replace(/\n/g,' ').match(/Tri\[Mg\][^A-Z]{0,80}/)?.[0]||'');
  ok('SKU junto, pra não confundir produto parecido', /SKU 80\.1\.1/.test(t));
  ok('produto de fora do catálogo entra também', /Combo Fitness/.test(t));
  ok('e o que acompanha a oferta aparece',
     /Frete/.test(t)&&/Bônus universal/.test(t), t.replace(/\n/g,' ').slice(-90));
  ok('kit vem marcado como kit', /Kit Imunidade/.test(t));

  /* foto da Shopify: a miniatura existe sempre, com a inicial embaixo pra
     quando a imagem não puder carregar */
  const fotos=await G(()=>[...document.querySelectorAll('#oferta-semana .mini-foto')]
    .map(e=>({ini:e.querySelector('b')?.textContent,src:e.querySelector('img')?.getAttribute('src')||''})));
  ok('cada produto da oferta tem miniatura', fotos.length>=9, 'n='+fotos.length);
  /* o <img> se remove sozinho quando a imagem não carrega — e aqui a rede
     está fechada — então a URL se confere no HTML que a função gera */
  ok('a miniatura aponta para a foto da Shopify',
     /cdn\.shopify\.com/.test(await G(()=>miniatura(CATALOGO[0]))),
     (await G(()=>miniatura(CATALOGO[0]))).replace(/\s+/g,' ').slice(0,70));
  ok('e com a inicial embaixo, pra não virar ícone quebrado',
     fotos.every(f=>f.ini&&f.ini.length<=2), fotos.slice(0,3).map(f=>f.ini).join(','));
  ok('o produto leva para a página dele na loja',
     await G(()=>!!document.querySelector('#oferta-semana td.prod a[href*="botanikabrasil"]')));
  ok('todo produto do catálogo tem foto e página cadastradas',
     await G(()=>CATALOGO.every(p=>/^https:\/\/cdn\.shopify\.com/.test(p.foto||'')&&p.pag)));

  /* e na hora de montar a oferta, no assistente */
  await p.click('nav.paginas button[data-pg="mes"]'); await p.waitForTimeout(250);
  await G(()=>{assistente(null)}); await p.waitForTimeout(250);
  await p.click('#modal-cx .opcoes button'); await p.waitForTimeout(250);
  await p.click('#modal-cx button.ok'); await p.waitForTimeout(400);
  ok('o passo da oferta também mostra os produtos com foto',
     await G(()=>document.querySelectorAll('#lista-prod .mini-foto').length)===9,
     'n='+await G(()=>document.querySelectorAll('#lista-prod .mini-foto').length));
  await G(()=>fecharModal());
  await p.click('nav.paginas button[data-pg="semana"]'); await p.waitForTimeout(300);

  await G(()=>{semanaSel=0;pintarSemana()}); await p.waitForTimeout(400);
  ok('semana sem ação com data diz isso, em vez de ficar vazia',
     /Nenhuma ação com data nesta semana/i.test(
       await G(()=>document.querySelector('#oferta-semana').innerText)));
}

ok('sem erro de JS', erros.length===0, erros.join(' | '));
await b.close();
console.log(`\n${ok_} OK, ${mau} falha(s)`);
process.exit(mau?1:0);
