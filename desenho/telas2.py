# -*- coding: utf-8 -*-
from gerar import pagina, BOT, VER

# ============================== RESULTADO ==================================
resultado = '''
<div class="g" style="grid-template-columns:repeat(4,1fr);margin-bottom:12px">
  <div class="cx" style="padding:11px 13px">
    <div class="rot">Faturado em setembro</div>
    <div class="num" style="font-size:22px;font-weight:600;letter-spacing:-.02em;margin-top:3px">R$ 168.400</div>
    <div style="font-size:11px;color:#78716C;margin-top:2px">35% da Meta 1</div>
  </div>
  <div class="cx" style="padding:11px 13px">
    <div class="rot">Falta para a Meta 1</div>
    <div class="num" style="font-size:22px;font-weight:600;letter-spacing:-.02em;margin-top:3px">R$ 311.600</div>
    <div style="font-size:11px;color:#78716C;margin-top:2px">R$ 14.164 por dia útil</div>
  </div>
  <div class="cx" style="padding:11px 13px">
    <div class="rot">Ticket médio</div>
    <div class="num" style="font-size:22px;font-weight:600;letter-spacing:-.02em;margin-top:3px">R$ 340</div>
    <div style="font-size:11px;color:#78716C;margin-top:2px">495 pedidos · falta 917</div>
  </div>
  <div class="cx" style="padding:11px 13px">
    <div class="rot">Sessões ontem</div>
    <div class="num mal" style="font-size:22px;font-weight:600;letter-spacing:-.02em;margin-top:3px">409</div>
    <div style="font-size:11px;color:#B91C1C;margin-top:2px">meta 2.000 · caindo desde 31/08</div>
  </div>
</div>

<div class="g" style="grid-template-columns:1fr 400px">
  <div class="cx">
    <div class="cx-t"><h2>Por canal</h2>
      <span class="mais">meta do mês contra o que já entrou</span></div>
    <table>
      <tr><th style="width:30%">Canal</th><th style="width:22%">Andamento</th>
          <th class="d">Meta</th><th class="d">Realizado</th><th class="d">%</th>
          <th class="d">Pedidos</th><th class="d">Verba</th><th class="d">ROAS</th></tr>
      <tr><td><span class="pt" style="background:#14713D;display:inline-block;margin-right:7px"></span>Tráfego direto</td>
          <td><div class="barra"><i style="width:41%;background:#14713D"></i></div></td>
          <td class="d num">100.000</td><td class="d num">41.200</td><td class="d num">41%</td>
          <td class="d num">121</td><td class="d num">18.400</td><td class="d num bom">2,2</td></tr>
      <tr><td><span class="pt" style="background:#2563EB;display:inline-block;margin-right:7px"></span>Influencers</td>
          <td><div class="barra"><i style="width:28%;background:#2563EB"></i></div></td>
          <td class="d num">120.000</td><td class="d num">33.600</td><td class="d num">28%</td>
          <td class="d num">99</td><td class="d num">6.100</td><td class="d num bom">5,5</td></tr>
      <tr><td><span class="pt" style="background:#7C3AED;display:inline-block;margin-right:7px"></span>Instagram</td>
          <td><div class="barra"><i style="width:44%;background:#7C3AED"></i></div></td>
          <td class="d num">70.000</td><td class="d num">30.800</td><td class="d num">44%</td>
          <td class="d num">91</td><td class="d num">—</td><td class="d num" style="color:#A8A29E">—</td></tr>
      <tr><td><span class="pt" style="background:#B45309;display:inline-block;margin-right:7px"></span>Grupo VIP</td>
          <td><div class="barra"><i style="width:19%;background:#B45309"></i></div></td>
          <td class="d num">30.000</td><td class="d num">5.700</td><td class="d num ate">19%</td>
          <td class="d num">17</td><td class="d num">—</td><td class="d num" style="color:#A8A29E">—</td></tr>
      <tr><td><span class="pt" style="background:#0891B2;display:inline-block;margin-right:7px"></span>WhatsApp API</td>
          <td><div class="barra"><i style="width:52%;background:#0891B2"></i></div></td>
          <td class="d num">40.000</td><td class="d num">20.800</td><td class="d num">52%</td>
          <td class="d num">61</td><td class="d num">283</td><td class="d num bom">73,5</td></tr>
      <tr><td><span class="pt" style="background:#DB2777;display:inline-block;margin-right:7px"></span>E-mail</td>
          <td><div class="barra"><i style="width:36%;background:#DB2777"></i></div></td>
          <td class="d num">35.000</td><td class="d num">12.600</td><td class="d num">36%</td>
          <td class="d num">37</td><td class="d num">—</td><td class="d num" style="color:#A8A29E">—</td></tr>
      <tr><td><span class="pt" style="background:#65A30D;display:inline-block;margin-right:7px"></span>Atendimento</td>
          <td><div class="barra"><i style="width:39%;background:#65A30D"></i></div></td>
          <td class="d num">40.000</td><td class="d num">15.700</td><td class="d num">39%</td>
          <td class="d num">46</td><td class="d num">—</td><td class="d num" style="color:#A8A29E">—</td></tr>
      <tr style="background:#FCFCFB"><td style="font-weight:600">Total</td><td></td>
          <td class="d num" style="font-weight:600">435.000</td>
          <td class="d num" style="font-weight:600">160.400</td>
          <td class="d num" style="font-weight:600">37%</td>
          <td class="d num" style="font-weight:600">472</td>
          <td class="d num" style="font-weight:600">24.783</td>
          <td class="d num" style="font-weight:600">6,5</td></tr>
    </table>
  </div>

  <div class="g" style="align-content:start">
    <!-- problema nº4 do documento: ninguém registra o resultado -->
    <div class="cx">
      <div class="cx-t"><h2>O que cada campanha rendeu</h2></div>
      <table>
        <tr><th>Campanha</th><th class="d">Meta</th><th class="d">Feito</th><th class="d">ROAS</th></tr>
        <tr><td>Dia D · 09/09<div style="font-size:10.5px;color:#A8A29E">no ar</div></td>
            <td class="d num">80.000</td><td class="d num" style="color:#A8A29E">—</td><td class="d num" style="color:#A8A29E">—</td></tr>
        <tr><td>Dia D Kids · 31/08<div style="font-size:10.5px;color:#A8A29E">encerrada</div></td>
            <td class="d num">50.000</td><td class="d num bom">55.100</td><td class="d num">3,1</td></tr>
        <tr><td>Recompra · 26 a 28/08<div style="font-size:10.5px;color:#A8A29E">encerrada</div></td>
            <td class="d num">6.000</td><td class="d num bom">7.521</td><td class="d num">—</td></tr>
        <tr><td>Semana do Cliente · 13/09<div style="font-size:10.5px;color:#A8A29E">preparando</div></td>
            <td class="d num">90.000</td><td class="d num" style="color:#A8A29E">—</td><td class="d num" style="color:#A8A29E">—</td></tr>
      </table>
      <div style="padding:9px 13px;border-top:1px solid #F5F5F4;font-size:11px;color:#78716C">
        O criativo que mais rendeu no Dia D Kids: <b style="font-weight:600">UGC pergunta-e-resposta</b>
        · CPI R$ 0,49 · 3% de conversão
      </div>
    </div>

    <div class="cx">
      <div class="cx-t"><h2>Lançar realizado</h2><span class="mais">até integrar a Shopify</span></div>
      <div style="padding:11px 13px;display:flex;flex-direction:column;gap:8px">
        <div style="display:flex;gap:8px">
          <div style="flex:1"><div class="rot" style="margin-bottom:3px">Dia</div>
            <div class="bt num" style="width:100%;text-align:left">04/09/2026</div></div>
          <div style="flex:1"><div class="rot" style="margin-bottom:3px">Canal</div>
            <div class="bt" style="width:100%;text-align:left">Tráfego direto</div></div>
        </div>
        <div style="display:flex;gap:8px">
          <div style="flex:1"><div class="rot" style="margin-bottom:3px">Faturado</div>
            <div class="bt num" style="width:100%;text-align:left">R$ 4.180</div></div>
          <div style="flex:1"><div class="rot" style="margin-bottom:3px">Pedidos</div>
            <div class="bt num" style="width:100%;text-align:left">12</div></div>
        </div>
        <button class="bt forte" style="width:100%">Lançar</button>
      </div>
    </div>
  </div>
</div>
'''
pagina('Resultado.dc.html', 'Resultado', 'Botanika · setembro de 2026 · lançado à mão até a Shopify entrar',
       'resultado', resultado,
       direita='<button class="bt">Setembro</button><button class="bt">Comparar com agosto</button>')

# ============================== CAMPANHAS ==================================
campanhas = '''
<div class="g" style="grid-template-columns:1fr;gap:14px">

  <div class="cx">
    <div class="cx-t"><h2>Com data</h2><span class="mais">têm início, fim e reversão</span></div>
    <table>
      <tr><th style="width:26%">Campanha</th><th style="width:190px">Preparação</th>
          <th class="d">Janela</th><th class="d">Meta</th><th class="d">Verba</th>
          <th class="d">Falta</th><th>Dono</th></tr>
      <tr><td><b style="font-weight:600">DIA D</b><div style="font-size:10.5px;color:#A8A29E">09/09 · dia principal</div></td>
          <td><div class="barra"><i style="width:63%;background:#14713D"></i></div>
              <div style="font-size:10.5px;color:#78716C;margin-top:3px">5 de 8 entregas</div></td>
          <td class="d num">09 a 10/09</td><td class="d num">80.000</td><td class="d num">12.000</td>
          <td class="d"><span class="selo mal" style="background:#FEF2F2">2 vencidas</span></td>
          <td>Gestão Alliance</td></tr>
      <tr><td><b style="font-weight:600">SEMANA DO CLIENTE</b><div style="font-size:10.5px;color:#A8A29E">13 a 19/09</div></td>
          <td><div class="barra"><i style="width:14%;background:#B45309"></i></div>
              <div style="font-size:10.5px;color:#78716C;margin-top:3px">1 de 7 entregas</div></td>
          <td class="d num">13 a 20/09</td><td class="d num">90.000</td><td class="d num">15.000</td>
          <td class="d"><span class="selo ate" style="background:#FFFBEB">começa em 9d</span></td>
          <td>Gestão Alliance</td></tr>
      <tr><td><b style="font-weight:600">DIA D KIDS</b><div style="font-size:10.5px;color:#A8A29E">26 a 30/09</div></td>
          <td><div class="barra"><i style="width:0%;background:#D6D3D1"></i></div>
              <div style="font-size:10.5px;color:#78716C;margin-top:3px">0 de 8 entregas</div></td>
          <td class="d num">26/09 a 01/10</td><td class="d num">50.000</td><td class="d num">8.000</td>
          <td class="d" style="color:#A8A29E">—</td><td>Gestão Alliance</td></tr>
    </table>
  </div>

  <div class="cx" style="border-color:#D6D3D1">
    <div class="cx-t" style="background:#FCFCFB">
      <h2>Perpétuo</h2>
      <span class="mais">70% do faturamento · não tem data de fim, e é o que mais atrasa</span></div>
    <table>
      <tr><th style="width:26%">Frente</th><th style="width:190px">Esta semana</th>
          <th class="d">Meta/mês</th><th class="d">Realizado</th><th class="d">Cadência</th><th>Dono</th></tr>
      <tr><td>Tráfego direto</td>
          <td><div class="barra"><i style="width:100%;background:#14713D"></i></div>
              <div style="font-size:10.5px;color:#78716C;margin-top:3px">4 de 4 · em dia</div></td>
          <td class="d num">100.000</td><td class="d num">41.200</td>
          <td class="d num">toda segunda</td><td>Pedro</td></tr>
      <tr><td>Grupos de WhatsApp</td>
          <td><div class="barra"><i style="width:40%;background:#B91C1C"></i><i style="width:60%;background:#D6D3D1"></i></div>
              <div style="font-size:10.5px;color:#B91C1C;margin-top:3px">2 de 5 · 3 vencidas</div></td>
          <td class="d num">50.000</td><td class="d num">18.900</td>
          <td class="d num">diária</td><td>Sarah</td></tr>
      <tr><td>E-mail</td>
          <td><div class="barra"><i style="width:71%;background:#B45309"></i><i style="width:29%;background:#D6D3D1"></i></div>
              <div style="font-size:10.5px;color:#78716C;margin-top:3px">5 de 7 · 2 hoje</div></td>
          <td class="d num">35.000</td><td class="d num">12.600</td>
          <td class="d num">diária</td><td>Sarah</td></tr>
      <tr><td>Orgânico · Instagram</td>
          <td><div class="barra"><i style="width:86%;background:#14713D"></i><i style="width:14%;background:#D6D3D1"></i></div>
              <div style="font-size:10.5px;color:#78716C;margin-top:3px">6 de 7</div></td>
          <td class="d num">70.000</td><td class="d num">30.800</td>
          <td class="d num">diária</td><td>Ítalo</td></tr>
      <tr><td>Lives</td>
          <td><div class="barra"><i style="width:100%;background:#14713D"></i></div>
              <div style="font-size:10.5px;color:#78716C;margin-top:3px">14 de 14 · duas por dia</div></td>
          <td class="d num">—</td><td class="d num" style="color:#A8A29E">—</td>
          <td class="d num">2× ao dia</td><td>Larissa</td></tr>
    </table>
  </div>

  <div class="cx">
    <div class="cx-t"><h2>Projetos</h2><span class="mais">sem data natural — melhorias de site, automação, estrutura</span></div>
    <table>
      <tr><th style="width:34%">Projeto</th><th style="width:190px">Andamento</th>
          <th class="d">Aberto há</th><th class="d">Tarefas</th><th>Dono</th><th>Fase</th></tr>
      <tr><td>Landing page com VSL e quiz</td>
          <td><div class="barra"><i style="width:22%;background:#2563EB"></i></div></td>
          <td class="d num">14 dias</td><td class="d num">2 de 9</td><td>Pedro</td>
          <td><span class="selo" style="background:#F5F5F4;color:#57534E">Planejamento</span></td></tr>
      <tr><td>Captura de aniversário e dados do cliente</td>
          <td><div class="barra"><i style="width:0%;background:#D6D3D1"></i></div></td>
          <td class="d num mal">28 dias</td><td class="d num">0 de 4</td><td>Sarah</td>
          <td><span class="selo mal" style="background:#FEF2F2">Parado</span></td></tr>
      <tr><td>Conversão e ticket · pop-up, carrinho, imagens</td>
          <td><div class="barra"><i style="width:58%;background:#2563EB"></i></div></td>
          <td class="d num">21 dias</td><td class="d num">7 de 12</td><td>Pedro</td>
          <td><span class="selo" style="background:#EFF6FF;color:#1D4ED8">Desenvolvimento</span></td></tr>
    </table>
  </div>
</div>
'''
pagina('Campanhas.dc.html', 'Campanhas', 'Botanika · com data, perpétuo e projetos — os três tipos de trabalho',
       'campanhas', campanhas,
       direita='<button class="bt">Setembro</button><button class="bt forte">+ Nova campanha</button>')
print('ok')
