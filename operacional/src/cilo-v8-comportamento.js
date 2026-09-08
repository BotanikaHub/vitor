/* ======================================================================
   V8 — comportamento.

   O painel da tarefa fechava por clique no fundo e pelo botão ×, mas não
   pelo Esc. Enquanto o painel nascia deslocado, o botão × ficava fora da
   tela e o Esc era a única saída que restava — foi assim que a página
   travou para o Vitor. O deslocamento está corrigido no CSS; o Esc entra
   aqui porque é o reflexo de quem usa o sistema o dia inteiro.

   Fecha uma camada por vez, da mais recente para a mais antiga, para que
   um painel aberto por cima de outro não derrube os dois de uma vez.
   ====================================================================== */
(function () {
  'use strict';

  const CAMADAS = ['.tdrawer.open', '.drawer.open', '.modal.open'];
  const FECHAR  = ['.tdrawer-close', '.drawer-close', '.modal-close'];

  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape' || e.defaultPrevented) return;

    /* Dentro de um campo, Esc é do campo: serve para desfazer o que a
       pessoa está digitando, não para jogar fora a tarefa inteira. */
    const foco = document.activeElement;
    if (foco && (foco.isContentEditable ||
        ['INPUT', 'TEXTAREA', 'SELECT'].includes(foco.tagName))) {
      foco.blur();
      return;
    }

    const abertas = CAMADAS.flatMap((s) => [...document.querySelectorAll(s)])
      .filter((el) => getComputedStyle(el).display !== 'none');
    if (!abertas.length) return;

    /* A última no documento é a que está por cima. */
    const alvo = abertas[abertas.length - 1];
    const bt = FECHAR.map((s) => alvo.querySelector(s)).find(Boolean);
    if (bt) bt.click(); else alvo.classList.remove('open');
    e.preventDefault();
  });
})();
