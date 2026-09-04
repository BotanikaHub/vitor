# -*- coding: utf-8 -*-
from gerar import pagina, BOT, VER

# ============================ INÍCIO — A MINHA ÁREA ========================
inicio = '''
<div class="g" style="grid-template-columns:1fr 320px">
  <div class="g">

    <!-- a régua do mês, que é o que a área persegue -->
    <div class="cx">
      <div class="cx-t"><h2>Setembro · a Gestão responde por isto</h2>
        <span class="mais">falta 22 dias</span></div>
      <div style="padding:13px">
        <div style="display:flex;align-items:baseline;gap:10px;margin-bottom:8px">
          <span class="num" style="font-size:26px;font-weight:600;letter-spacing:-.02em">R$ 168.400</span>
          <span style="font-size:12px;color:#78716C">de <span class="num">R$ 480.000</span> · Meta 1</span>
          <span class="selo bom" style="background:#F0FDF4;margin-left:auto">35% · no ritmo</span>
        </div>
        <div class="barra" style="height:7px">
          <i style="width:35%;background:#14713D"></i>
          <i style="width:8%;background:#BBF7D0"></i>
        </div>
        <div style="display:flex;justify-content:space-between;font-size:10.5px;color:#A8A29E;margin-top:6px">
          <span>realizado · <span class="num">R$ 168.400</span></span>
          <span>previsto até domingo · <span class="num">R$ 38.000</span></span>
          <span>ritmo necessário · <span class="num">R$ 14.164/dia</span></span>
        </div>
      </div>
    </div>

    <!-- o que a área tem que entregar, com dono e prazo -->
    <div class="cx">
      <div class="cx-t"><h2>O que a minha área entrega esta semana</h2>
        <span class="mais">9 abertas · 4 vencidas</span></div>
      <table>
        <tr><th style="width:38%">Entrega</th><th>Campanha</th><th>Quem</th>
            <th class="d">Prazo</th><th class="d" style="width:64px">Feito</th></tr>
        <tr><td><span class="pt" style="background:#B91C1C;display:inline-block;margin-right:7px"></span>Configurar desconto, frete e brinde na Shopify</td>
            <td style="color:#78716C">Dia D</td><td>Pedro</td>
            <td class="d num mal">03/09 · ontem</td><td class="d num" style="color:#A8A29E">0/4</td></tr>
        <tr><td><span class="pt" style="background:#B91C1C;display:inline-block;margin-right:7px"></span>Programar todos os disparos</td>
            <td style="color:#78716C">Dia D</td><td>Sarah</td>
            <td class="d num mal">04/09 · hoje</td><td class="d num">2/6</td></tr>
        <tr><td><span class="pt" style="background:#B45309;display:inline-block;margin-right:7px"></span>Criar 4 a 5 criativos em vídeo</td>
            <td style="color:#78716C">Dia D</td><td>Ítalo</td>
            <td class="d num ate">04/09 · hoje</td><td class="d num">3/4</td></tr>
        <tr><td><span class="pt" style="background:#78716C;display:inline-block;margin-right:7px"></span>Enviar criativos aos gestores de tráfego</td>
            <td style="color:#78716C">Perpétuo</td><td>Gestão Alliance</td>
            <td class="d num">05/09</td><td class="d num" style="color:#A8A29E">—</td></tr>
        <tr><td><span class="pt" style="background:#78716C;display:inline-block;margin-right:7px"></span>Conferir tudo que vai ao ar</td>
            <td style="color:#78716C">Diária</td><td>Gestão Alliance</td>
            <td class="d num">todo dia 09h</td><td class="d num">2/14</td></tr>
      </table>
    </div>

    <!-- o problema nº3 do documento: sobrecarga invisível -->
    <div class="cx">
      <div class="cx-t"><h2>Carga da equipe</h2>
        <span class="mais">quem está afogado aparece aqui, sem ninguém contar</span></div>
      <table>
        <tr><th style="width:150px">Pessoa</th><th style="width:160px">Distribuição</th>
            <th class="d">Abertas</th><th class="d">Vencidas</th><th class="d">Hoje</th><th>Área</th></tr>
        <tr><td>Sarah</td>
            <td><div class="barra"><i style="width:62%;background:#B91C1C"></i><i style="width:38%;background:#D6D3D1"></i></div></td>
            <td class="d num">21</td><td class="d num mal" style="font-weight:600">13</td><td class="d num">3</td>
            <td style="color:#78716C">Automações</td></tr>
        <tr><td>Ítalo</td>
            <td><div class="barra"><i style="width:22%;background:#B45309"></i><i style="width:78%;background:#D6D3D1"></i></div></td>
            <td class="d num">18</td><td class="d num ate">4</td><td class="d num">2</td>
            <td style="color:#78716C">Design</td></tr>
        <tr><td>Pedro</td>
            <td><div class="barra"><i style="width:14%;background:#B45309"></i><i style="width:86%;background:#D6D3D1"></i></div></td>
            <td class="d num">14</td><td class="d num ate">2</td><td class="d num">1</td>
            <td style="color:#78716C">Copy · Site · Tráfego</td></tr>
        <tr><td>Ana</td>
            <td><div class="barra"><i style="width:0%;background:#B91C1C"></i><i style="width:100%;background:#D6D3D1"></i></div></td>
            <td class="d num">6</td><td class="d num" style="color:#A8A29E">0</td><td class="d num">0</td>
            <td style="color:#78716C">Creators</td></tr>
      </table>
    </div>
  </div>

  <!-- coluna da direita -->
  <div class="g" style="align-content:start">
    <div class="cx" style="border-color:#D6D3D1">
      <div class="cx-t" style="background:#FCFCFB"><h2>Reunião de KPI</h2></div>
      <div style="padding:12px 13px">
        <div style="font-size:19px;font-weight:600;letter-spacing:-.015em">Quinta, 10/09</div>
        <div style="font-size:11.5px;color:#78716C;margin-top:2px">em 6 dias · 09h00</div>
        <div style="border-top:1px solid #F5F5F4;margin-top:10px;padding-top:9px">
          <div class="rot" style="margin-bottom:6px">A Gestão leva</div>
          <div style="display:flex;flex-direction:column;gap:5px;font-size:12px">
            <label style="display:flex;gap:7px;align-items:flex-start;color:#57534E">
              <span style="width:12px;height:12px;border:1px solid #15803D;border-radius:3px;
                    color:#15803D;font-size:9px;text-align:center;line-height:11px;flex:none;margin-top:2px">✓</span>
              <span style="text-decoration:line-through">Fechamento do Dia D</span></label>
            <label style="display:flex;gap:7px;align-items:flex-start;color:#1C1917">
              <span style="width:12px;height:12px;border:1px solid #D6D3D1;border-radius:3px;flex:none;margin-top:2px"></span>
              <span>Carga da equipe e as 13 vencidas da Sarah</span></label>
            <label style="display:flex;gap:7px;align-items:flex-start;color:#1C1917">
              <span style="width:12px;height:12px;border:1px solid #D6D3D1;border-radius:3px;flex:none;margin-top:2px"></span>
              <span>Sessões: caíram de 1.369 para 409</span></label>
          </div>
        </div>
      </div>
    </div>

    <!-- problema nº2: demanda que nasce em conversa e some -->
    <div class="cx">
      <div class="cx-t"><h2>Caixa de entrada</h2><span class="mais">6</span></div>
      <div style="padding:11px 13px;border-bottom:1px solid #F5F5F4">
        <div style="font-size:12px;line-height:1.4">"Precisamos revisar o pop-up, tá abrindo em 3s e o português tá errado"</div>
        <div style="display:flex;align-items:center;gap:7px;margin-top:6px">
          <span style="font-size:10.5px;color:#A8A29E">Gabriel · reunião de 03/09</span>
          <button class="bt" style="margin-left:auto;padding:2px 8px;font-size:11px">Virar tarefa</button>
        </div>
      </div>
      <div style="padding:11px 13px;border-bottom:1px solid #F5F5F4">
        <div style="font-size:12px;line-height:1.4">"Reciclar a menção no perfil do Willian apontando pro site"</div>
        <div style="display:flex;align-items:center;gap:7px;margin-top:6px">
          <span style="font-size:10.5px;color:#A8A29E">Gabriel · reunião de 03/09</span>
          <button class="bt" style="margin-left:auto;padding:2px 8px;font-size:11px">Virar tarefa</button>
        </div>
      </div>
      <div style="padding:9px 13px;font-size:11px;color:#A8A29E">e mais 4 sem dono</div>
    </div>

    <div class="cx">
      <div class="cx-t"><h2>Processos da Gestão</h2><span class="mais">ver todos</span></div>
      <div style="padding:4px 0">
        <div style="padding:7px 13px;font-size:12px;border-bottom:1px solid #F5F5F4">Como abrir uma campanha do zero</div>
        <div style="padding:7px 13px;font-size:12px;border-bottom:1px solid #F5F5F4">O padrão de nome de tarefa</div>
        <div style="padding:7px 13px;font-size:12px">Conferência diária antes de publicar</div>
      </div>
    </div>
  </div>
</div>
'''

pagina('Main.dc.html', 'Gestão', 'A sua área · Botanika · quinta-feira, 04 de setembro',
       'inicio', inicio,
       direita='<button class="bt">Semana</button><button class="bt forte">+ Nova tarefa</button>')
print('Main.dc.html')
