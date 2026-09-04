# -*- coding: utf-8 -*-
from gerar import pagina, BOT, VER

# =============================== CONTEÚDO ==================================
def celula(hora, canal, texto, cor, estado):
    selos = {'ok':'<span class="selo bom" style="background:#F0FDF4">aprovado</span>',
             'esp':'<span class="selo ate" style="background:#FFFBEB">esperando</span>',
             'falta':'<span class="selo mal" style="background:#FEF2F2">sem material</span>',
             'sai':'<span class="selo" style="background:#F5F5F4;color:#57534E">no ar</span>'}
    return f'''<div style="border-left:2px solid {cor};background:#fff;border:1px solid #E7E5E4;
       border-left:2px solid {cor};border-radius:4px;padding:6px 7px;margin-bottom:5px">
      <div style="display:flex;gap:5px;align-items:center;margin-bottom:3px">
        <span class="num" style="font-size:10px;color:#78716C">{hora}</span>
        <span style="font-size:9.5px;text-transform:uppercase;letter-spacing:.06em;color:{cor};font-weight:600">{canal}</span>
      </div>
      <div style="font-size:11.5px;line-height:1.35;margin-bottom:4px">{texto}</div>
      {selos[estado]}</div>'''

dias = [
 ('SEG','01', [celula('09h','E-mail','Perpétuo · benefício do dia','#DB2777','sai'),
               celula('19h','Live','Larissa · Botanika','#7C3AED','sai')]),
 ('TER','02', [celula('10h','Story','Sequência de prova social','#7C3AED','sai'),
               celula('19h','Live','Larissa · Botanika','#7C3AED','sai')]),
 ('QUA','03', [celula('09h','API','Grupos · aquecimento Dia D','#0891B2','sai'),
               celula('14h','Feed','Carrossel de objeções','#7C3AED','sai')]),
 ('QUI','04', [celula('09h','E-mail','Antecipação Dia D','#DB2777','ok'),
               celula('12h','Story','Contagem · faltam 5 dias','#7C3AED','esp'),
               celula('19h','Live','Larissa · Botanika','#7C3AED','ok')]),
 ('SEX','05', [celula('10h','Feed','Grupo VIP · condições','#7C3AED','falta'),
               celula('18h','API','Segmento VIP · convite','#0891B2','esp')]),
 ('SÁB','06', [celula('11h','Story','Bastidores da produção','#7C3AED','falta')]),
 ('DOM','07', [celula('16h','Feed','Depoimento em vídeo','#7C3AED','esp')]),
]
grade = ''.join(f'''<div style="border-right:1px solid #E7E5E4;padding:8px 7px;min-height:400px;
   {'background:#FCFCFB' if d[0] in ('SÁB','DOM') else ''}">
   <div style="display:flex;align-items:baseline;gap:5px;margin-bottom:8px">
     <span style="font-size:9.5px;font-weight:600;letter-spacing:.08em;color:#A8A29E">{d[0]}</span>
     <span class="num" style="font-size:14px;font-weight:600;{'color:#14713D' if d[1]=='04' else ''}">{d[1]}</span>
   </div>{''.join(d[2])}</div>''' for d in dias)

conteudo = f'''
<div class="g" style="grid-template-columns:repeat(4,1fr);margin-bottom:12px">
  <div class="cx" style="padding:11px 13px"><div class="rot">Peças esta semana</div>
    <div class="num" style="font-size:22px;font-weight:600;margin-top:3px">14</div>
    <div style="font-size:11px;color:#78716C;margin-top:2px">5 canais</div></div>
  <div class="cx" style="padding:11px 13px"><div class="rot">Sem material</div>
    <div class="num mal" style="font-size:22px;font-weight:600;margin-top:3px">2</div>
    <div style="font-size:11px;color:#B91C1C;margin-top:2px">saem em menos de 48h</div></div>
  <div class="cx" style="padding:11px 13px"><div class="rot">Esperando aprovação</div>
    <div class="num ate" style="font-size:22px;font-weight:600;margin-top:3px">3</div>
    <div style="font-size:11px;color:#78716C;margin-top:2px">com Gabriel</div></div>
  <div class="cx" style="padding:11px 13px"><div class="rot">Limite do dia</div>
    <div class="num" style="font-size:22px;font-weight:600;margin-top:3px">2 <span style="font-size:13px;color:#A8A29E">de 2</span></div>
    <div style="font-size:11px;color:#78716C;margin-top:2px">APIs · e 1 de 2 e-mails</div></div>
</div>

<div class="cx">
  <div class="cx-t"><h2>01 a 07 de setembro</h2>
    <span class="mais">o que sai, em que canal, em que hora — com o material anexado</span></div>
  <div style="display:grid;grid-template-columns:repeat(7,1fr)">{grade}</div>
</div>

<div class="g" style="grid-template-columns:1fr 1fr;margin-top:12px">
  <div class="cx">
    <div class="cx-t"><h2>Material que a Sarah está esperando</h2>
      <span class="mais">o anexo é o que destrava o próximo</span></div>
    <table>
      <tr><th>Peça</th><th>De quem</th><th class="d">Precisa em</th><th class="d">Anexo</th></tr>
      <tr><td>Copy · 8 mensagens de venda Dia D</td><td>Pedro</td>
          <td class="d num mal">hoje 18h</td>
          <td class="d"><span class="selo mal" style="background:#FEF2F2">falta</span></td></tr>
      <tr><td>Artes · banner e tarja do site</td><td>Ítalo</td>
          <td class="d num ate">amanhã 12h</td>
          <td class="d"><span class="selo ate" style="background:#FFFBEB">2 de 4</span></td></tr>
      <tr><td>Criativos em vídeo · tráfego</td><td>Ítalo</td>
          <td class="d num">05/09 18h</td>
          <td class="d"><span class="selo bom" style="background:#F0FDF4">4 arquivos</span></td></tr>
      <tr><td>Roteiro da live de sexta</td><td>Polyana</td>
          <td class="d num">05/09 12h</td>
          <td class="d"><span class="selo bom" style="background:#F0FDF4">1 arquivo</span></td></tr>
    </table>
  </div>
  <div class="cx">
    <div class="cx-t"><h2>Rendimento por canal · últimos 7 dias</h2></div>
    <table>
      <tr><th>Canal</th><th class="d">Peças</th><th class="d">Cliques</th>
          <th class="d">Vendas</th><th class="d">Faturado</th></tr>
      <tr><td>Link na bio</td><td class="d num">7</td><td class="d num">84</td>
          <td class="d num">28</td><td class="d num bom">12.430</td></tr>
      <tr><td>Stories</td><td class="d num">21</td><td class="d num">43</td>
          <td class="d num">3</td><td class="d num">3.000</td></tr>
      <tr><td>WhatsApp API</td><td class="d num">6</td><td class="d num">—</td>
          <td class="d num">14</td><td class="d num bom">7.477</td></tr>
      <tr><td>E-mail</td><td class="d num">9</td><td class="d num">—</td>
          <td class="d num">11</td><td class="d num">4.180</td></tr>
      <tr><td>Grupos</td><td class="d num">14</td><td class="d num">—</td>
          <td class="d num">9</td><td class="d num">1.803</td></tr>
    </table>
  </div>
</div>
'''
pagina('Conteudo.dc.html', 'Conteúdo', 'Botanika · calendário editorial · semana de 01 a 07 de setembro',
       'conteudo', conteudo,
       direita='<button class="bt">Semana</button><button class="bt">Mês</button><button class="bt forte">+ Peça</button>')

# ============================== ATENDIMENTO ================================
atendimento = '''
<div class="g" style="grid-template-columns:repeat(5,1fr);margin-bottom:12px">
  <div class="cx" style="padding:11px 13px"><div class="rot">Na fila agora</div>
    <div class="num mal" style="font-size:22px;font-weight:600;margin-top:3px">12</div>
    <div style="font-size:11px;color:#B91C1C;margin-top:2px">a mais antiga há 34 min</div></div>
  <div class="cx" style="padding:11px 13px"><div class="rot">Resposta média</div>
    <div class="num ate" style="font-size:22px;font-weight:600;margin-top:3px">10 min</div>
    <div style="font-size:11px;color:#78716C;margin-top:2px">subiu · era 4 min</div></div>
  <div class="cx" style="padding:11px 13px"><div class="rot">Atendimentos na semana</div>
    <div class="num" style="font-size:22px;font-weight:600;margin-top:3px">124</div>
    <div style="font-size:11px;color:#78716C;margin-top:2px">77 viraram oportunidade</div></div>
  <div class="cx" style="padding:11px 13px"><div class="rot">Vendas fechadas</div>
    <div class="num bom" style="font-size:22px;font-weight:600;margin-top:3px">23</div>
    <div style="font-size:11px;color:#78716C;margin-top:2px">14 no site · 9 na Guru</div></div>
  <div class="cx" style="padding:11px 13px"><div class="rot">Faturado na semana</div>
    <div class="num" style="font-size:22px;font-weight:600;margin-top:3px">R$ 15.072</div>
    <div style="font-size:11px;color:#78716C;margin-top:2px">30% do canal no mês</div></div>
</div>

<div class="g" style="grid-template-columns:1fr 380px">
  <div class="g">
    <div class="cx">
      <div class="cx-t"><h2>Fila</h2><span class="mais">quem está esperando, e há quanto tempo</span></div>
      <table>
        <tr><th style="width:26%">Pessoa</th><th>Último que ela disse</th>
            <th class="d">Esperando</th><th>Assunto</th><th>Com</th></tr>
        <tr><td>Márcia S.<div style="font-size:10.5px;color:#A8A29E" class="num">(31) 9•••• 4412</div></td>
            <td style="color:#57534E">"o kids serve pra criança de 3 anos?"</td>
            <td class="d num mal" style="font-weight:600">34 min</td>
            <td><span class="selo" style="background:#F5F5F4;color:#57534E">Protocolo</span></td><td>—</td></tr>
        <tr><td>Renata L.<div style="font-size:10.5px;color:#A8A29E" class="num">(11) 9•••• 8890</div></td>
            <td style="color:#57534E">"não consigo finalizar, dá erro no cartão"</td>
            <td class="d num mal" style="font-weight:600">21 min</td>
            <td><span class="selo mal" style="background:#FEF2F2">Erro no site</span></td><td>Lissia</td></tr>
        <tr><td>Joana P.<div style="font-size:10.5px;color:#A8A29E" class="num">(21) 9•••• 1203</div></td>
            <td style="color:#57534E">"chegou hoje, quantos dias pra ver efeito?"</td>
            <td class="d num ate">12 min</td>
            <td><span class="selo" style="background:#F5F5F4;color:#57534E">Pós-venda</span></td><td>Poly</td></tr>
        <tr><td>Carla M.<div style="font-size:10.5px;color:#A8A29E" class="num">(47) 9•••• 7781</div></td>
            <td style="color:#57534E">"tem cupom pro kit de 3?"</td>
            <td class="d num">6 min</td>
            <td><span class="selo bom" style="background:#F0FDF4">Oportunidade</span></td><td>Poly</td></tr>
      </table>
    </div>

    <div class="cx">
      <div class="cx-t"><h2>Carrinho abandonado</h2><span class="mais">53 esta semana</span></div>
      <div style="padding:12px 13px">
        <div class="barra" style="height:10px;border-radius:4px">
          <i style="width:51%;background:#D6D3D1" title="se esconderam"></i>
          <i style="width:19%;background:#B45309"></i>
          <i style="width:17%;background:#15803D"></i>
          <i style="width:13%;background:#F0EFED"></i>
        </div>
        <div style="display:flex;gap:16px;margin-top:9px;font-size:11.5px">
          <span><span class="pt" style="background:#D6D3D1;display:inline-block;margin-right:5px"></span>
            27 se esconderam</span>
          <span><span class="pt" style="background:#B45309;display:inline-block;margin-right:5px"></span>
            10 sem contato</span>
          <span><span class="pt" style="background:#15803D;display:inline-block;margin-right:5px"></span>
            9 finalizaram · <b class="num" style="font-weight:600">R$ 5.940</b></span>
          <span><span class="pt" style="background:#F0EFED;display:inline-block;margin-right:5px"></span>
            7 em recuperação</span>
        </div>
      </div>
    </div>
  </div>

  <div class="g" style="align-content:start">
    <div class="cx">
      <div class="cx-t"><h2>Por que não compraram</h2><span class="mais">semana</span></div>
      <table>
        <tr><td>Questão financeira</td><td class="d num">4</td></tr>
        <tr><td>Cliente internacional</td><td class="d num">5</td></tr>
        <tr><td>Não foi indicado pro caso</td><td class="d num">5</td></tr>
        <tr><td>Dúvida no protocolo</td><td class="d num">7</td></tr>
        <tr><td>Erro no site</td><td class="d num mal" style="font-weight:600">9</td></tr>
      </table>
      <div style="padding:9px 13px;border-top:1px solid #F5F5F4;font-size:11px;color:#B91C1C">
        9 desistências por erro no site nesta semana — vale virar tarefa.
      </div>
    </div>
    <div class="cx">
      <div class="cx-t"><h2>Recompra</h2><span class="mais">cupom RECOMPRA</span></div>
      <div style="padding:12px 13px">
        <div style="display:flex;align-items:baseline;gap:8px">
          <span class="num" style="font-size:22px;font-weight:600">9</span>
          <span style="font-size:12px;color:#78716C">pedidos ·</span>
          <span class="num bom" style="font-size:15px;font-weight:600">R$ 7.521</span>
        </div>
        <div style="font-size:11px;color:#78716C;margin-top:5px">
          26, 27 e 28/08 · a ação puxou o pico do dia 1º
        </div>
      </div>
    </div>
    <div class="cx">
      <div class="cx-t"><h2>Quem está no plantão</h2></div>
      <div style="padding:10px 13px;display:flex;flex-direction:column;gap:9px">
        <div style="display:flex;align-items:center;gap:9px">
          <span class="av">LI</span>
          <div style="flex:1"><div style="font-size:12px;font-weight:500">Lissia</div>
            <div style="font-size:10.5px;color:#A8A29E">6 em atendimento</div></div>
          <span class="pt" style="background:#15803D"></span>
        </div>
        <div style="display:flex;align-items:center;gap:9px">
          <span class="av">PO</span>
          <div style="flex:1"><div style="font-size:12px;font-weight:500">Poly</div>
            <div style="font-size:10.5px;color:#A8A29E">4 em atendimento</div></div>
          <span class="pt" style="background:#15803D"></span>
        </div>
      </div>
    </div>
  </div>
</div>
'''
pagina('Atendimento.dc.html', 'Atendimento', 'Botanika · fila, carrinho abandonado e recuperação · 04 de setembro',
       'atendimento', atendimento,
       direita='<button class="bt">Hoje</button><button class="bt">Semana</button>')
print('ok')
