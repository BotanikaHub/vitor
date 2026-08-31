/* Erro de sintaxe no script da página não dá aviso nenhum: o navegador
   simplesmente não define nada, e todo o resto da suíte falha com
   "mesAtual is not defined", que não diz onde está o problema. Este
   arquivo roda primeiro e aponta a linha. */
import { readFileSync, writeFileSync, unlinkSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
const raiz = resolve(dirname(fileURLToPath(import.meta.url)), '..');

let ok_=0, mau=0;
const ok=(n,c,extra='')=>{c?ok_++:mau++;console.log((c?'OK  | ':'FALHA | ')+n+(extra?' | '+extra:''))};

const html = readFileSync(resolve(raiz,'index.html'),'utf8');
const blocos=[...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m=>m[1]);
ok('a página tem script', blocos.length>=1, blocos.length+' bloco(s)');

blocos.forEach((js,i)=>{
  const arq=resolve(tmpdir(),`tap-sintaxe-${i}.mjs`);
  writeFileSync(arq,js);
  try{
    execFileSync(process.execPath,['--check',arq],{stdio:['ignore','ignore','pipe']});
    ok(`bloco ${i+1} compila`, true, js.length+' caracteres');
  }catch(e){
    ok(`bloco ${i+1} compila`, false,
       String(e.stderr||'').split('\n').slice(0,4).join(' · '));
  }finally{ try{unlinkSync(arq)}catch(e){} }
});

/* o marcador que o build usa para injetar o retrato tem que continuar lá */
ok('o marcador do retrato do ClickUp continua no lugar',
   (html.match(/const CU_RETRATO=null; \/\*\[\[RETRATO\]\]\*\//g)||[]).length===1);

console.log(`\n${ok_} OK, ${mau} falha(s)`);
process.exit(mau?1:0);
