/* ======================================================================
   As marcas.

   Eram duas, escritas à mão em nove lugares — três <select> no HTML, o
   subtítulo da lateral, e listas soltas dentro de cinco módulos. Entrar
   uma terceira significava achar os nove e acertar todos; esquecer um
   deixava a marca invisível justamente na tela que a pessoa fosse usar.

   Agora a lista vem do banco, da tabela `brands`, que já existia e já é
   onde o cadastro decide quem trabalha em quê. Os <select> são reescritos
   a partir dela, e quem precisa da lista pergunta aqui.

   O plano B são as duas de sempre: se o banco não responder, o sistema
   continua funcionando com o que sempre teve, em vez de ficar sem marca
   nenhuma e sem saber o que mostrar.
   ====================================================================== */
(function () {
  'use strict';

  const PLANO_B = ['Botanika', 'VermeFree'];
  const TODAS = 'Todas as marcas';

  /* Uma cor por marca, para o nó no mapa e a barra da campanha não
     nascerem todos iguais. Pela posição na lista, e não por nome escrito
     no código — senão a marca nova nasce sem cor. */
  const CORES = ['#121415', '#4f8a70', '#8a5a3c', '#3c5a8a', '#7a4f8a'];

  let lista = PLANO_B.slice();

  const nomes = () => lista.slice();
  const ehMarca = (v) => lista.includes(v);
  const cor = (marca) => CORES[Math.max(0, lista.indexOf(marca)) % CORES.length];

  /* A marca que está na barra. "Todas as marcas" devolve vazio, que é
     como o resto do sistema já escreve "sem recorte". */
  const atual = () => {
    const v = document.getElementById('brandSelect')?.value || '';
    return ehMarca(v) ? v : '';
  };

  /* ---------- reescrever um seletor sem perder o que estava escolhido ---------- */
  function opcoes(sel, { comTodas, valor }) {
    if (!sel) return;
    const escolhido = valor != null ? valor : sel.value;
    const quer = lista.concat(comTodas ? [TODAS] : []);
    const tem = [...sel.options].map((o) => o.value || o.textContent);
    if (tem.length === quer.length && tem.every((t, i) => t === quer[i])) {
      if (escolhido && tem.includes(escolhido)) sel.value = escolhido;
      return;
    }
    sel.innerHTML = quer.map((m) => `<option${m === escolhido ? ' selected' : ''}>${m}</option>`).join('');
    if (escolhido && quer.includes(escolhido)) sel.value = escolhido;
  }

  function aplicar() {
    opcoes(document.getElementById('brandSelect'), { comTodas: true });
    opcoes(document.getElementById('newBrand'), {});
    opcoes(document.getElementById('campaignBrand'), {});
    /* o da ficha da tarefa é redesenhado a cada abertura, e o app o monta
       com as duas de sempre; o valor que já estava lá manda */
    const ficha = document.getElementById('detailBrand');
    if (ficha) opcoes(ficha, { valor: ficha.value });

    const sub = document.querySelector('.brandtitle span');
    if (sub) {
      const texto = lista.join(' · ');
      if (sub.textContent !== texto) sub.textContent = texto;
    }
  }

  async function carregar() {
    try {
      await window.Acessos?.carregar?.(false);
      const doBanco = (window.Acessos?.cache?.marcas || [])
        .filter((m) => m && m.nome && m.ativo !== false)
        .map((m) => m.nome);
      if (doBanco.length) lista = doBanco;
    } catch { /* fica o plano B */ }
    aplicar();
    return lista;
  }

  window.Marcas = { nomes, ehMarca, atual, cor, carregar, aplicar, TODAS, PLANO_B };

  function ligar() {
    aplicar();
    carregar();
    /* Os seletores do app são remontados: o da ficha da tarefa a cada
       abertura, o da campanha a cada edição. Um observador só devolve a
       lista certa quando eles voltam. */
    new MutationObserver(() => aplicar())
      .observe(document.documentElement, { childList: true, subtree: true });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', ligar); else ligar();
})();
