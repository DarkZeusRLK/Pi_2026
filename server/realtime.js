// Tempo real com Ably. O Vercel não mantém WebSocket aberto, então:
// - o servidor só PUBLICA (SDK REST do Ably) depois de gravar no banco, que continua sendo a fonte da verdade;
// - o navegador conecta direto no Ably usando um token de curta duração e permissões mínimas (GET /api/realtime/token).
// A ABLY_API_KEY nunca sai do servidor. Sem ela, nada aqui faz efeito e o site usa polling.
import Ably from 'ably'

export const tempoRealAtivo = () => !!process.env.ABLY_API_KEY

let rest
const cliente = () => (rest ??= new Ably.Rest({ key: process.env.ABLY_API_KEY }))

const TEMPO_MAX_MS = 3000

// Publica sem nunca derrubar a requisição: se o Ably falhar, quem usa o site continua com o polling.
export async function publicar(canal, evento, dados) {
  if (!tempoRealAtivo()) return
  try {
    await Promise.race([
      cliente().channels.get(canal).publish(evento, dados),
      new Promise((_, rej) => setTimeout(() => rej(new Error('tempo esgotado')), TEMPO_MAX_MS)),
    ])
  } catch (e) {
    console.error(`Ably: não foi possível publicar ${evento} em ${canal}:`, e.message)
  }
}

export const publicarVarios = (itens) => Promise.all(itens.map(([canal, evento, dados]) => publicar(canal, evento, dados)))

// Permissões mínimas:
//  mural                     → só ler (todos, inclusive visitantes)
//  usuario:{id}              → só ler (só o próprio usuário)
//  conversa:{id}             → ler + presença ("online"), só para quem participa
//  conversa:{id}:digitando   → ler + publicar ("digitando…"), só para quem participa
// Mensagens do chat nunca são publicadas pelo navegador: só o servidor publica, depois de gravar.
export function montarCapability(usuarioId, conversaIds) {
  const cap = { mural: ['subscribe'] }
  if (usuarioId) {
    cap[`usuario:${usuarioId}`] = ['subscribe']
    for (const id of conversaIds) {
      cap[`conversa:${id}`] = ['subscribe', 'presence']
      cap[`conversa:${id}:digitando`] = ['subscribe', 'publish']
    }
  }
  return cap
}

export function pedirToken(clientId, capability) {
  return cliente().auth.createTokenRequest({ clientId, capability: JSON.stringify(capability), ttl: 60 * 60 * 1000 })
}
