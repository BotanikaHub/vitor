/* ======================================================================
   Quem escreve a lista de conferência.

   Isto roda na Vercel, e não no navegador, por um motivo só: a chave da
   Anthropic. O index.html vai inteiro para quem abrir o link e o
   repositório é público — chave ali é chave publicada. Aqui ela é
   variável de ambiente do projeto, definida no painel da Vercel, e não
   aparece em lugar nenhum do que o navegador recebe.

   Sem ANTHROPIC_API_KEY definida, esta função responde 503 e a tela cai
   nas regras dela mesma. É de propósito: a conferência não pode depender
   de a IA estar de pé.
   ====================================================================== */
import Anthropic from '@anthropic-ai/sdk';

const MODELO = 'claude-opus-5';

const SISTEMA = `Você escreve listas de conferência para a operação de e-commerce da
Botanika e da VermeFree — suplementos vendidos em Shopify, com tráfego pago no Meta,
disparos em grupos de WhatsApp, e-mail, Instagram e influenciadores.

A lista é a última coisa que a pessoa lê antes de dizer "está entregue". Enquanto um
item obrigatório estiver aberto, o sistema não deixa concluir. Então cada item precisa:

- ser conferível em menos de um minuto, olhando a entrega pronta;
- ser específico da entrega que está no contexto, e não um conselho genérico;
- citar o número, a data, o cupom, o produto ou a página quando o contexto tiver;
- ser escrito em português do Brasil, na voz de quem trabalha ali, em uma linha curta;
- começar pelo que se olha, e não por "verificar se" ou "garantir que".

Marque obrigatorio: false só para o que é higiene e não impede a entrega (salvar
arquivo, guardar print, anotar aprendizado). Erro que vai ao ar — preço errado, link
quebrado, marca trocada, data fora do cronograma — é sempre obrigatório.

O padrão da área vem no contexto: aproveite o que faz sentido, some o que o contexto
pede, e não repita a mesma coisa com outras palavras. Entre 6 e 14 itens.`;

/* O formato é combinado antes, e não pedido no texto: a resposta já vem
   como este objeto, e não como um JSON dentro de um parágrafo. */
const FORMATO = {
  type: 'json_schema',
  schema: {
    type: 'object',
    additionalProperties: false,
    properties: {
      itens: {
        type: 'array',
        minItems: 6,
        maxItems: 14,
        items: {
          type: 'object',
          additionalProperties: false,
          properties: {
            texto: { type: 'string', description: 'O item, em uma linha curta.' },
            obrigatorio: { type: 'boolean', description: 'true trava a conclusão da entrega.' },
          },
          required: ['texto', 'obrigatorio'],
        },
      },
    },
    required: ['itens'],
  },
};

/* quando não vem pronto, o texto da resposta é o objeto */
function lerTexto(r) {
  const t = (r.content || []).filter((b) => b.type === 'text').map((b) => b.text).join('').trim();
  if (!t) return null;
  try { return JSON.parse(t) } catch {}
  const i = t.indexOf('{'), f = t.lastIndexOf('}');
  if (i < 0 || f <= i) return null;
  try { return JSON.parse(t.slice(i, f + 1)) } catch { return null }
}

export default async function handler(req, res) {
  if (req.method !== 'POST')
    return res.status(405).json({ erro: 'use POST' });

  const chave = process.env.ANTHROPIC_API_KEY;
  if (!chave)
    return res.status(503).json({
      erro: 'ANTHROPIC_API_KEY não está definida neste projeto da Vercel',
    });

  let corpo = req.body;
  if (typeof corpo === 'string') { try { corpo = JSON.parse(corpo) } catch { corpo = null } }
  if (!corpo || typeof corpo !== 'object')
    return res.status(400).json({ erro: 'corpo inválido' });

  const pedido = [
    corpo.tipo === 'campanha'
      ? 'Escreva a conferência de encerramento desta campanha inteira.'
      : 'Escreva a conferência desta tarefa, para antes de ela ser entregue.',
    '',
    'Contexto:',
    JSON.stringify(corpo, null, 2).slice(0, 24000),
  ].join('\n');

  try {
    const cliente = new Anthropic({ apiKey: chave });
    const r = await cliente.messages.create({
      model: MODELO,
      max_tokens: 4000,
      thinking: { type: 'adaptive' },
      system: SISTEMA,
      output_config: { format: FORMATO },
      messages: [{ role: 'user', content: pedido }],
    });

    const bruto = r.parsed_output || lerTexto(r);
    const itens = (bruto?.itens || [])
      .filter((i) => i && String(i.texto || '').trim())
      .map((i) => ({ texto: String(i.texto).trim(), obrigatorio: i.obrigatorio !== false }));

    if (!itens.length)
      return res.status(502).json({ erro: 'a resposta veio sem itens' });

    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).json({ itens, modelo: MODELO });
  } catch (e) {
    console.error('[conferencia]', e);
    return res.status(502).json({ erro: String(e?.message || e) });
  }
}
