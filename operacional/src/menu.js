/* ======================================================================
   O menu que fica guardado.

   A lateral tinha seis destinos sempre à vista, mais a conta, e a maior
   parte deles não é de todo dia: quem trabalha abre a Central para ver o
   que é da área dele e fechar o que é dele. Seis ícones fixos roubam a
   largura da tela e a atenção de quem chega.

   Então ela some por padrão e volta num botão sanduíche. E, como agora
   ela não precisa caber num trilho de 84px, volta melhor do que era: com
   os nomes escritos ao lado dos ícones, que é o que ninguém tinha.

   No celular a lateral já virava barra de baixo, e ali ela está certa —
   este módulo não encosta nesse tamanho.
   ====================================================================== */
(function () {
  'use strict';

  const LARGURA = 901;   /* abaixo disto a lateral já é barra de baixo */
  const noPC = () => window.innerWidth >= LARGURA;

  const HAMBURGUER = `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M4 7h16"></path><path d="M4 12h16"></path><path d="M4 17h16"></path>
    </svg>`;

  function botao() {
    let b = document.getElementById('menuBotao');
    if (b) return b;
    const barra = document.querySelector('.global-toolbar');
    if (!barra) return null;
    b = document.createElement('button');
    b.id = 'menuBotao';
    b.type = 'button';
    b.className = 'mn-bt';
    b.setAttribute('aria-label', 'Abrir o menu');
    b.setAttribute('aria-expanded', 'false');
    b.innerHTML = HAMBURGUER;
    barra.insertBefore(b, barra.firstChild);
    return b;
  }

  /* Duas coisas da lateral não podem ficar guardadas: a marca, que se
     troca o dia inteiro, e o sino, que existe para avisar. Elas sobem
     para a barra de cima, que está sempre à vista. O que fica atrás do
     sanduíche são os seis destinos — que é o que ninguém abre de
     minuto em minuto. */
  function mudar() {
    const barra = document.querySelector('.global-toolbar');
    if (!barra || !noPC()) return;
    const bt = document.getElementById('menuBotao');

    const marca = document.getElementById('brandSelect');
    if (marca && !marca.closest('.global-toolbar')) {
      marca.classList.add('mn-marca');
      barra.insertBefore(marca, bt ? bt.nextSibling : barra.firstChild);
    }
    const sino = document.getElementById('notificationsBtn');
    if (sino && !sino.closest('.global-toolbar')) {
      sino.classList.add('mn-sino');
      barra.appendChild(sino);
    }
  }

  function fundo() {
    let f = document.getElementById('menuFundo');
    if (f) return f;
    f = document.createElement('div');
    f.id = 'menuFundo';
    f.className = 'mn-fundo';
    f.hidden = true;
    document.body.appendChild(f);
    return f;
  }

  const aberto = () => document.body.classList.contains('mn-aberto');

  function abrir() {
    if (!noPC()) return;
    document.body.classList.add('mn-aberto');
    fundo().hidden = false;
    const b = document.getElementById('menuBotao');
    if (b) { b.setAttribute('aria-expanded', 'true'); b.setAttribute('aria-label', 'Fechar o menu') }
    document.querySelector('.sidebar .navitem')?.focus?.();
  }

  function fechar() {
    document.body.classList.remove('mn-aberto');
    const f = document.getElementById('menuFundo'); if (f) f.hidden = true;
    const b = document.getElementById('menuBotao');
    if (b) { b.setAttribute('aria-expanded', 'false'); b.setAttribute('aria-label', 'Abrir o menu') }
  }

  /* ---------- ligar ---------- */
  function ajustar() {
    document.body.classList.toggle('mn', noPC());
    if (!noPC()) fechar();
  }

  document.addEventListener('click', (e) => {
    if (e.target.closest?.('#menuBotao')) { aberto() ? fechar() : abrir(); return }
    if (e.target.closest?.('#menuFundo')) { fechar(); return }
    /* escolher um destino fecha: ninguém quer o menu por cima do que pediu */
    if (aberto() && e.target.closest?.('.sidebar .navitem, .sidebar .side-select')) {
      setTimeout(fechar, 60);
    }
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && aberto()) { fechar(); e.stopPropagation() }
  });

  window.addEventListener('resize', ajustar);

  /* O app refaz pedaços da tela o tempo todo; o botão é reposto se sumir. */
  const olho = new MutationObserver(() => { botao(); fundo(); mudar() });

  function ligar() {
    ajustar();
    botao();
    fundo();
    mudar();
    olho.observe(document.body, { childList: true, subtree: true });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', ligar);
  else ligar();

  window.MenuLateral = { abrir, fechar, aberto };
})();
