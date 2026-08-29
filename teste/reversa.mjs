/* A engenharia reversa: começa na meta do mês e desce dividindo por ação.
   O que se testa aqui é o caminho inteiro — definir a meta, ver o buraco,
   criar a ação que o cobre, e o buraco fechar no mês e no mapa. */
import { chromium } from 'playwright-core';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const raiz = resolve(dirname(fileURLToPath(import.meta.url)), '..');

let ok_=0, mau=0;
const ok=(n,c,extra='')=>{c?ok_++:mau++;console.log((c?'OK  | ':'FALHA | ')+n+(extra?' | '+extra:''))};

const b = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args:['--no-sandbox']});
const p = await b.newPage({viewport:{width:1500,height:1000}});
const erros=[]; p.on('pageerror',e=>erros.push(e.message));
await p.route('**/dados/*.json*', r=>r.fulfill({status:404,body:''}));
await p.addInitScript(()=>{try{localStorage.clear()}catch(e){}});
/* a suíte nunca fala com a base de verdade: quem exercita esse caminho
   é teste/base.mjs, com a API simulada */
await p.route('**/*.supabase.co/**',
  r=>r.fulfill({status:503,contentType:'application/json',body:'{}'}));
await p.goto('file://'+resolve(raiz,'index.html'),{waitUntil:'networkidle'});
await p.waitForTimeout(400);
const G=f=>p.evaluate(f);
const escada=()=>G(()=>document.querySelector('#escada').innerText);

// ---- 1. sem meta, o passo 1 é o que aparece ----
{
  const t=await escada();
  ok('mês novo começa cobrando a meta', /Meta do mês/.test(t) && /a definir/i.test(t),
     t.replace(/\n/g,' ').slice(0,80));
  ok('e oferece definir ali mesmo',
     await G(()=>!!document.querySelector('#escada button')));
  ok('o mapa também pede a meta na raiz', await G(()=>{
    document.querySelector('nav.paginas button[data-pg="mapa"]').click();
    return [...document.querySelectorAll('.no.raiz .selo')].some(s=>/definir meta/i.test(s.textContent));
  }));
}

// ---- 2. definir a meta abre a divisão ----
{
  await p.click('nav.paginas button[data-pg="mes"]');
  await G(()=>editarMetasMes());
  await p.fill('#m-1','300000');
  await p.fill('#m-tk','200');
  await p.click('#modal-cx button.ok');
  await p.waitForTimeout(300);
  const t=await escada();
  ok('meta 1 entra', /R\$ 300\.000/.test(t), t.replace(/\n/g,' ').slice(0,60));
  ok('metas 2 e 3 saem da meta 1', /R\$ 351\.000/.test(t) && /R\$ 399\.000/.test(t));
  ok('com ticket, desce até pedidos', /Pedidos necessários/i.test(t) && /1\.500/.test(t));
  ok('sem nenhuma ação, tudo está por atribuir',
     /Falta atribuir/i.test(t) && /R\$ 300\.000/.test(t) && /100%/.test(t));
}

// ---- 3. criar a ação a partir do resto ----
{
  const bt=await p.$('#escada .fatia.resto button');
  ok('o buraco oferece criar a ação', !!bt);
  await bt.click(); await p.waitForTimeout(250);
  await p.click('#modal-cx .cartao-tipo, #modal-cx button');   // escolhe o 1º formato
  await p.waitForTimeout(250);
  const v=await G(()=>document.querySelector('#w-meta')?.value);
  ok('a ação já nasce com o resto como meta', String(v)==='300000', 'w-meta='+v);
  await p.fill('#w-meta','120000');
  await p.fill('#w-nome, #w-nome-camp, input[id^=w-nome]','Dia D Setembro').catch(()=>{});
  await G(()=>{ // fecha o assistente indo até o fim pelo caminho curto
    AS.meta=120000;AS.nome='Dia D Setembro';
    AS.fontes={traf:{meta:40000,inv:10000},api:{meta:32000,inv:4000}};
    criarCampanha();
  });
  await p.waitForTimeout(350);
}

// ---- 4. o buraco encolhe, no mês e no mapa ----
{
  await p.click('nav.paginas button[data-pg="mes"]'); await p.waitForTimeout(300);
  const t=await escada();
  ok('a ação aparece com sua fatia', /Dia D Setembro/.test(t) && /40%/.test(t),
     t.replace(/\n/g,' ').slice(0,120));
  ok('e com os pedidos que ela precisa trazer', /600 pedidos/.test(t));
  ok('o resto encolhe', /Falta atribuir/i.test(t) && /R\$ 180\.000/.test(t) && /60%/.test(t));
  ok('a barra tem uma fatia por ação',
     await G(()=>document.querySelectorAll('#escada .trilho i').length)===1);

  await p.click('nav.paginas button[data-pg="mapa"]'); await p.waitForTimeout(350);
  const selos=await G(()=>[...document.querySelectorAll('#mundo .selo')].map(s=>s.textContent));
  ok('a raiz do mapa mostra a meta', selos.some(s=>/R\$ 300\.000/.test(s)), selos.join(' / '));
  ok('e o que falta dividir', selos.some(s=>/falta R\$ 180\.000/.test(s)));
  ok('o nó da ação mostra a fatia dela', selos.some(s=>/R\$ 120\.000 · 40%/.test(s)));

  await p.click('nav.paginas button[data-pg="camp"]'); await p.waitForTimeout(300);
  ok('a aba do TAP também diz a fatia',
     /40%/.test(await G(()=>document.querySelector('#abas').innerText)));
}

// ---- 4b. o último degrau separa o que se compra do que não se compra ----
{
  await p.click('nav.paginas button[data-pg="mes"]'); await p.waitForTimeout(250);
  const t=await escada();
  ok('a escada separa tráfego e API', /Tráfego/.test(t) && /API/.test(t),
     t.replace(/\n/g,' ').slice(-140));
  ok('e mostra o que não se compra', /Não se compra/i.test(t));
  ok('cada fonte tem o próprio ROAS',
     (await G(()=>document.querySelector('#escada').innerText.match(/ROAS \d/g)||[])).length>=2);

  /* a soma das fontes pagas + o resto tem que ser a meta da ação */
  const c=await G(()=>{const c=campsMes()[0];
    return {meta:c.meta,traf:c.fontes.traf.meta,api:c.fontes.api.meta,inv:c.investimento,
            invTraf:c.fontes.traf.inv,invApi:c.fontes.api.inv}});
  ok('o faturamento das fontes cabe dentro da meta da ação',
     c.traf+c.api<=c.meta, `${c.traf}+${c.api} <= ${c.meta}`);
  ok('o investimento da ação é a soma das duas fontes',
     c.inv===c.invTraf+c.invApi, `${c.inv} = ${c.invTraf}+${c.invApi}`);

  /* e o TAP recebe uma linha de investimento por fonte */
  const tap=await G(()=>{const c=campsMes()[0];
    return (c.secoes.find(s=>/METAS/i.test(s.t))?.l||[]).map(l=>l.join(' | ')).join('\n')});
  ok('o TAP traz investimento separado por fonte',
     /Investimento — Tráfego/.test(tap) && /Investimento — API/.test(tap),
     tap.split('\n').filter(l=>/Investimento/.test(l)).join(' / '));
}

// ---- 4c. "Datas e meta" edita as duas fontes ----
{
  await p.click('nav.paginas button[data-pg="camp"]'); await p.waitForTimeout(250);
  await G(()=>editarPeriodo());
  await p.waitForTimeout(200);
  ok('o editor da campanha separa as fontes',
     await G(()=>!!document.querySelector('#e-m-traf') && !!document.querySelector('#e-i-traf')
       && !!document.querySelector('#e-m-api') && !!document.querySelector('#e-i-api')));
  ok('não sobrou o campo único de investimento',
     await G(()=>!document.querySelector('#e-inv')));
  await p.fill('#e-i-traf','30000'); await p.fill('#e-i-api','10000');
  await p.click('#modal-cx button.ok'); await p.waitForTimeout(300);
  ok('salvar soma as duas na verba da ação',
     await G(()=>campsMes()[0].investimento)===40000,
     'inv='+await G(()=>campsMes()[0].investimento));
}

// ---- 4d. a trava: fonte paga não passa da meta da ação ----
{
  let alerta='';
  p.once('dialog',async d=>{alerta=d.message();await d.accept()});
  await G(()=>{assistente(null,50000)}); await p.waitForTimeout(200);
  await p.click('#modal-cx .opcoes button, #modal-cx button'); await p.waitForTimeout(250);
  await p.fill('#w-meta','50000');
  await p.fill('#w-m-traf','40000'); await p.fill('#w-m-api','40000');
  await p.waitForTimeout(150);
  await p.click('#modal-cx button.ok'); await p.waitForTimeout(300);
  ok('o assistente barra e diz por quê', /passam da meta da ação/i.test(alerta),
     alerta.replace(/\n/g,' ').slice(0,70));
  ok('e continua no passo 2, sem perder o que foi digitado',
     await G(()=>!!document.querySelector('#w-m-traf')));
  await G(()=>fecharModal());
}

// ---- 5. fechando a meta inteira ----
{
  await G(()=>{const c=campsMes()[0];c.meta=300000;pintarMes();render()});
  await p.click('nav.paginas button[data-pg="mes"]'); await p.waitForTimeout(300);
  const t=await escada();
  ok('meta inteira dividida some com o alerta',
     /Meta inteira dividida em ações/i.test(t) && !/Falta atribuir/i.test(t),
     t.replace(/\n/g,' ').slice(-90));
  ok('o mapa para de cobrar o resto',
     !(await G(()=>[...document.querySelectorAll('#mundo .selo')].some(s=>/falta/i.test(s.textContent)))));

  await G(()=>{const c=campsMes()[0];c.meta=380000;pintarMes()});
  await p.waitForTimeout(250);
  ok('passar da meta é dito, não escondido',
     /já passam da Meta 1/i.test(await escada()));
}

ok('sem erro de JS', erros.length===0, erros.join(' | '));
await b.close();
console.log(`\n${ok_} OK, ${mau} falha(s)`);
process.exit(mau?1:0);
