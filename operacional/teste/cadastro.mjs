/* O primeiro acesso de cada pessoa.

   O que precisa valer: quem não tem sessão vê a tela de entrar; dali dá
   para ir e voltar do cadastro; o e-mail digitado é conferido contra a
   lista da equipe ANTES de criar qualquer coisa; a senha curta e as duas
   senhas diferentes não passam; o cadastro certo chama o signUp do
   Supabase com o que a pessoa escreveu; e-mail já cadastrado é dito com
   todas as letras; e quem entra com conta não liberada vê o porquê em
   vez da operação vazia. */
import { chromium } from '/home/user/vitor/node_modules/playwright-core/index.mjs';
import { readFileSync } from 'node:fs';
import { createServer } from 'node:http';

const html = readFileSync(new URL('../dist/index.html', import.meta.url), 'utf8');
const srv = createServer((_, r) => { r.writeHead(200,{'content-type':'text/html; charset=utf-8'}); r.end(html) }).listen(0);
const nav = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const porta = srv.address().port;

let ok = 0, ruim = 0;
const conf = (o, v) => { if (v) { ok++; console.log('  ✓', o) } else { ruim++; console.log('  ✗', o) } };

/* A lista de convites como o banco a devolve pela função convite_de, e a
   resposta que o signUp dá em cada um dos três desfechos. */
const CONVITES = {
  'ass.italoneves@gmail.com': { convidado: true, nome: 'Ítalo Neves', ja_tem_conta: false },
  'comercialvittorgutierrez@gmail.com': { convidado: true, nome: 'Vitor Gutierrez', ja_tem_conta: true },
};

async function abrir(cfg) {
  const pag = await nav.newPage({ viewport: { width: 1440, height: 1000 } });
  pag.on('pageerror', (e) => console.log('  [erro na página]', e.message));
  await pag.addInitScript(([convites, opt]) => {
    window.__chamadas = { rpc: [], signUp: [], signIn: [], signOut: 0 };
    window.supabase = { createClient: () => ({
      auth: {
        getSession: async () => ({ data: { session: opt.sessao || null } }),
        signInWithPassword: async (a) => { window.__chamadas.signIn.push(a); return { error: null } },
        /* pelo sessionStorage porque sair recarrega a página, e o que
           estivesse só na memória iria embora junto */
        signOut: async () => { sessionStorage.setItem('__saiu', '1'); window.__chamadas.signOut++; return {} },
        signUp: async (a) => {
          window.__chamadas.signUp.push(a);
          const r = opt.signUp || { session: null, user: { identities: [{ id: 'i1' }] } };
          return { data: r, error: opt.signUpErro ? { message: opt.signUpErro } : null };
        },
      },
      rpc: async (nome, args) => {
        window.__chamadas.rpc.push({ nome, args });
        const e = String((args && args.p_email) || '').trim().toLowerCase();
        if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e)) return { data: { erro: 'email' }, error: null };
        return { data: convites[e] || { convidado: false, nome: '', ja_tem_conta: false }, error: null };
      },
      from: () => ({
        select: () => ({
          or: async () => ({ data: [], error: null }),
          eq: () => ({ maybeSingle: async () => ({ data: opt.perfil || null }) }),
        }),
        upsert: async () => ({ error: null }),
      }),
    }) };
  }, [CONVITES, cfg]);
  await pag.goto(`http://127.0.0.1:${porta}/`, { waitUntil: 'domcontentloaded' });
  await pag.locator('.ent-fundo').waitFor({ state: 'visible', timeout: 8000 });
  await pag.waitForTimeout(200);
  return pag;
}

/* ---------- 1. sem sessão: a tela de entrar, com a porta do cadastro ---------- */
console.log('\nsem sessão');
let p = await abrir({});
conf('quem chega sem sessão para na tela de entrar', await p.locator('.ent-bt').innerText() === 'Entrar');
conf('e existe um caminho para o primeiro acesso', await p.locator('[data-modo="cadastrar"]').count() === 1);
conf('a tela de entrar não pede senha duas vezes', await p.locator('#ent-senha2').count() === 0);

await p.locator('[data-modo="cadastrar"]').click();
await p.waitForTimeout(120);
conf('o botão do cadastro diz o que vai fazer', await p.locator('.ent-bt').innerText() === 'Criar minha conta');
conf('o cadastro pede a senha duas vezes', await p.locator('#ent-senha2').count() === 1);
conf('e diz que só a equipe entra', (await p.locator('.ent-pe').innerText()).includes('lista da equipe'));
conf('a senha nova não é preenchida pelo gerenciador como se fosse a antiga',
     await p.locator('#ent-senha').getAttribute('autocomplete') === 'new-password');

await p.locator('[data-modo="entrar"]').click();
await p.waitForTimeout(120);
conf('e dá para voltar para entrar', await p.locator('.ent-bt').innerText() === 'Entrar');

/* ---------- 2. o e-mail é conferido contra a lista, antes de criar ---------- */
console.log('\no e-mail antes da conta');
await p.locator('[data-modo="cadastrar"]').click();
await p.waitForTimeout(120);
await p.locator('#ent-email').fill('ass.italoneves@gmail.com');
await p.locator('#ent-senha').click();
await p.waitForTimeout(220);
conf('quem está na lista é reconhecido pelo nome', (await p.locator('[data-quem]').innerText()).includes('Ítalo Neves'));
conf('e o aviso vem em verde, de coisa certa', (await p.locator('[data-quem]').getAttribute('class')).includes('sim'));
conf('a conferência não vaza papel nem área', !(await p.locator('[data-quem]').innerText()).match(/membro|gestor|admin/i));

await p.locator('#ent-email').fill('italoneves@gmail.com');
await p.locator('#ent-senha').click();
await p.waitForTimeout(220);
let quem = await p.locator('[data-quem]').innerText();
conf('o endereço parecido mas fora da lista é avisado na hora', quem.includes('não está na lista'));
conf('e o aviso diz o que fazer', /digitou certo|peça ao Vitor/i.test(quem));

await p.locator('#ent-email').fill('comercialvittorgutierrez@gmail.com');
await p.locator('#ent-senha').click();
await p.waitForTimeout(220);
conf('quem já tem conta é mandado entrar em vez de cadastrar',
     (await p.locator('[data-quem]').innerText()).includes('já tem conta'));

/* ---------- 3. a senha ---------- */
console.log('\na senha');
await p.locator('#ent-email').fill('ass.italoneves@gmail.com');
await p.locator('#ent-senha').fill('123');
await p.locator('#ent-senha2').fill('123');
await p.locator('.ent-bt').click();
await p.waitForTimeout(250);
conf('senha curta não passa', (await p.locator('.ent-msg').innerText()).includes('8 caracteres'));
conf('e nada foi criado', (await p.evaluate(() => window.__chamadas.signUp.length)) === 0);

await p.locator('#ent-senha').fill('boa-senha-longa');
await p.locator('#ent-senha2').fill('boa-senha-longaa');
await p.locator('.ent-bt').click();
await p.waitForTimeout(250);
conf('as duas senhas diferentes não passam', (await p.locator('.ent-msg').innerText()).includes('diferentes'));
conf('e continua sem criar nada', (await p.evaluate(() => window.__chamadas.signUp.length)) === 0);

/* ---------- 4. um e-mail de fora nunca vira conta ---------- */
console.log('\nquem não é da equipe');
await p.locator('#ent-email').fill('estranho@gmail.com');
await p.locator('#ent-senha').fill('boa-senha-longa');
await p.locator('#ent-senha2').fill('boa-senha-longa');
await p.locator('.ent-bt').click();
await p.waitForTimeout(300);
conf('o cadastro é recusado antes de chegar no Supabase',
     (await p.evaluate(() => window.__chamadas.signUp.length)) === 0);
conf('e a recusa explica o motivo', (await p.locator('.ent-msg').innerText()).includes('não está na lista'));
conf('o campo do e-mail é apontado como o errado',
     await p.locator('#ent-email').getAttribute('aria-invalid') === 'true');
conf('e o botão volta a funcionar', !(await p.locator('.ent-bt').isDisabled()));
await p.close();

/* ---------- 5. o cadastro que dá certo ---------- */
console.log('\no cadastro que dá certo');
p = await abrir({});
await p.locator('[data-modo="cadastrar"]').click();
await p.waitForTimeout(120);
await p.locator('#ent-email').fill(' ASS.ItaloNeves@gmail.com ');
await p.locator('#ent-senha').fill('senha-do-italo');
await p.locator('#ent-senha2').fill('senha-do-italo');
await p.locator('.ent-bt').click();
await p.waitForTimeout(400);
const feito = await p.evaluate(() => window.__chamadas.signUp);
conf('o Supabase é chamado uma vez só', feito.length === 1);
conf('com o e-mail sem espaço em volta', feito[0] && feito[0].email === 'ASS.ItaloNeves@gmail.com'.trim());
conf('e com a senha que a pessoa escolheu', feito[0] && feito[0].password === 'senha-do-italo');
conf('o cadastro não manda nome, papel nem marca — isso é do convite',
     feito[0] && !JSON.stringify(feito[0]).match(/papel|marca|area/i));
conf('o link de confirmação volta para a Central',
     feito[0] && String(feito[0].options.emailRedirectTo).includes('127.0.0.1'));
const aviso = (await p.locator('.ent-cartao').innerText());
conf('e a tela manda a pessoa olhar o e-mail', /confirmação|clique no link/i.test(aviso));
conf('dizendo para qual endereço foi', aviso.toLowerCase().includes('ass.italoneves@gmail.com'));
conf('o e-mail fica guardado para a próxima entrada',
     await p.evaluate(() => localStorage.getItem('central.__email')) === 'ASS.ItaloNeves@gmail.com'.trim());
await p.close();

/* ---------- 6. quando o Supabase já tem esse e-mail ---------- */
console.log('\ne-mail que já existe');
p = await abrir({ signUp: { session: null, user: { identities: [] } } });
await p.locator('[data-modo="cadastrar"]').click();
await p.waitForTimeout(120);
await p.locator('#ent-email').fill('ass.italoneves@gmail.com');
await p.locator('#ent-senha').fill('senha-do-italo');
await p.locator('#ent-senha2').fill('senha-do-italo');
await p.locator('.ent-bt').click();
await p.waitForTimeout(350);
const m = await p.locator('.ent-msg').innerText();
conf('o "já existe" que o Supabase esconde é dito aqui', m.includes('já tem conta'));
conf('e a saída é entrar ou trocar a senha', /Esqueci minha senha|entre/i.test(m));
await p.close();

/* ---------- 7. quando o próprio Supabase recusa ---------- */
console.log('\nquando o servidor recusa');
p = await abrir({ signUpErro: 'Password is known to be weak and easy to guess, please choose a different one (pwned password)' });
await p.locator('[data-modo="cadastrar"]').click();
await p.waitForTimeout(120);
await p.locator('#ent-email').fill('ass.italoneves@gmail.com');
await p.locator('#ent-senha').fill('senha-vazada');
await p.locator('#ent-senha2').fill('senha-vazada');
await p.locator('.ent-bt').click();
await p.waitForTimeout(350);
conf('senha vazada é explicada em português',
     (await p.locator('.ent-msg').innerText()).includes('vazamentos'));
conf('e dá para tentar de novo sem recarregar', !(await p.locator('.ent-bt').isDisabled()));
await p.close();

/* ---------- 8. entrou, mas não está liberado ---------- */
console.log('\nconta sem liberação');
p = await abrir({
  sessao: { user: { id: 'u9', email: 'estranho@gmail.com' } },
  perfil: { id: 'u9', nome: 'estranho', email: 'estranho@gmail.com', papel: 'membro', ativo: false, cargo: null, area_id: null },
});
const corpo = await p.locator('.ent-cartao').innerText();
conf('quem não está liberado não vê a operação vazia', corpo.includes('acesso ainda não'));
conf('a tela diz de qual e-mail está falando', corpo.includes('estranho@gmail.com'));
conf('e oferece a saída certa: sair e usar o e-mail da equipe', /saia e crie a conta/i.test(corpo));
await p.locator('.ent-bt').click();
await p.waitForTimeout(150);
conf('o botão de sair realmente encerra a sessão', (await p.evaluate(() => sessionStorage.getItem('__saiu'))) === '1');
await p.close();

/* ---------- 9. entrou e está liberado: nada disso aparece ---------- */
console.log('\nquem está liberado');
const pag = await nav.newPage({ viewport: { width: 1440, height: 1000 } });
await pag.addInitScript(() => {
  window.supabase = { createClient: () => ({
    auth: { getSession: async () => ({ data: { session: { user: { id: 'u1', email: 'v@b.com' } } } }), signOut: async () => ({}) },
    rpc: async () => ({ data: null, error: null }),
    from: () => ({ select: () => ({ or: async () => ({ data: [], error: null }),
      eq: () => ({ maybeSingle: async () => ({ data: { id:'u1', nome:'Vitor Gutierrez', email:'v@b.com', papel:'admin', ativo:true, cargo:'', area_id:null } }) }) }),
      upsert: async () => ({ error: null }) }) }) };
});
await pag.goto(`http://127.0.0.1:${porta}/`, { waitUntil: 'networkidle' });
await pag.waitForTimeout(900);
conf('quem tem acesso não vê tela nenhuma na frente', await pag.locator('.ent-fundo').count() === 0);
await pag.close();

await nav.close();
srv.close();
console.log(`\ncadastro: ${ok} checagens passaram${ruim ? `, ${ruim} FALHARAM` : ''}`);
process.exit(ruim ? 1 : 0);
