import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from './components/nav'
import { useStore } from './store'

/* Tempo real com Ably. Conecta uma vez (token vem de /api/realtime/token, a chave nunca vai ao navegador)
   e reconecta ao entrar ou sair da conta. Se o serviço não estiver configurado ou a conexão cair,
   "conectado" fica falso e as telas continuam funcionando com o polling de antes. */

const Ctx = createContext({
  estado: 'desativado', conectado: false, cliente: null, reconexoes: 0,
  assinar: () => () => {}, publicarCliente: () => {},
})

export const useRealtime = () => useContext(Ctx)

export function RealtimeProvider({ children }) {
  const { user, config, carregandoSessao, setTempoRealOk } = useStore()
  const [estado, setEstado] = useState('desativado') // desativado | conectando | conectado | reconectando | falhou
  const [cliente, setCliente] = useState(null)
  const [reconexoes, setReconexoes] = useState(0)
  const clienteRef = useRef(null)
  const canais = useRef(new Map())

  useEffect(() => {
    if (!config.carregada || !config.tempoReal || carregandoSessao) return undefined
    let vivo = true
    let c = null
    setEstado('conectando')
    // carrega o SDK só quando o tempo real está ligado (fica fora do pacote principal)
    import('ably').then((mod) => {
      if (!vivo) return
      const Ably = mod.default || mod
      c = new Ably.Realtime({ authUrl: '/api/realtime/token', authMethod: 'GET', echoMessages: false, closeOnUnload: true })
      let jaConectou = false
      c.connection.on((mudanca) => {
        if (!vivo) return
        const atual = mudanca.current
        if (atual === 'connected') {
          setEstado('conectado')
          if (jaConectou) setReconexoes((n) => n + 1) // dados podem ter ficado velhos enquanto estava fora
          jaConectou = true
        } else if (atual === 'disconnected' || atual === 'suspended' || (atual === 'connecting' && jaConectou)) setEstado('reconectando')
        else if (atual === 'failed') setEstado('falhou')
      })
      clienteRef.current = c
      setCliente(c)
    }).catch(() => { if (vivo) setEstado('falhou') })

    return () => {
      vivo = false
      canais.current.clear()
      clienteRef.current = null
      setCliente(null)
      setEstado('desativado')
      try { c?.close() } catch { /* já fechado */ }
    }
  }, [config.carregada, config.tempoReal, carregandoSessao, user?.id])

  const conectado = estado === 'conectado'
  useEffect(() => { setTempoRealOk(conectado) }, [conectado, setTempoRealOk])

  // Assina eventos de um canal (vários componentes podem assinar o mesmo canal; ele só é solto quando o último sai)
  const assinar = useCallback((nome, ouvinte) => {
    const c = clienteRef.current
    if (!c) return () => {}
    let entrada = canais.current.get(nome)
    if (!entrada) {
      const canal = c.channels.get(nome)
      entrada = { canal, ouvintes: new Set() }
      entrada.aoReceber = (msg) => entrada.ouvintes.forEach((fn) => fn(msg.name, msg.data, msg))
      canais.current.set(nome, entrada)
      Promise.resolve(canal.subscribe(entrada.aoReceber)).catch(async (erro) => {
        // permissão negada (40160): conversa nova que ainda não estava no token → pede um token atualizado e tenta de novo
        if (erro?.code === 40160) {
          try { await c.auth.authorize(); await canal.attach() } catch { /* sem tempo real neste canal: fica o polling */ }
        }
      })
    }
    entrada.ouvintes.add(ouvinte)
    return () => {
      entrada.ouvintes.delete(ouvinte)
      if (!entrada.ouvintes.size && canais.current.get(nome) === entrada) {
        canais.current.delete(nome)
        try { entrada.canal.unsubscribe(entrada.aoReceber); entrada.canal.detach().catch(() => {}) } catch { /* cliente já fechado */ }
      }
    }
  }, [])

  const publicarCliente = useCallback((nome, evento, dados) => {
    try { clienteRef.current?.channels.get(nome).publish(evento, dados).catch(() => {}) } catch { /* sem conexão: "digitando" é só enfeite */ }
  }, [])

  const valor = useMemo(() => ({ estado, conectado, cliente, reconexoes, assinar, publicarCliente }), [estado, conectado, cliente, reconexoes, assinar, publicarCliente])
  return (
    <Ctx.Provider value={valor}>
      {children}
      <AssinaturasGlobais />
    </Ctx.Provider>
  )
}

// aoEvento(nomeDoEvento, dados) é chamado a cada evento do canal. Passe nome falsy para não assinar.
export function useCanal(nome, aoEvento) {
  const { assinar, cliente } = useRealtime()
  const ref = useRef(aoEvento)
  useEffect(() => { ref.current = aoEvento })
  useEffect(() => {
    if (!nome || !cliente) return undefined
    return assinar(nome, (ev, dados) => ref.current?.(ev, dados))
  }, [nome, cliente, assinar])
}

// Chama "fn" quando a conexão volta (os dados podem ter ficado velhos enquanto estava fora)
export function useAoReconectar(fn) {
  const { reconexoes } = useRealtime()
  const primeira = useRef(reconexoes)
  const ref = useRef(fn)
  useEffect(() => { ref.current = fn })
  useEffect(() => {
    if (reconexoes !== primeira.current) ref.current?.()
  }, [reconexoes])
}

// Executa "fn" no máximo uma vez por janela (junta rajadas de eventos numa atualização só)
export function useDebounce(fn, ms = 400) {
  const ref = useRef(fn)
  const timer = useRef(null)
  useEffect(() => { ref.current = fn })
  useEffect(() => () => clearTimeout(timer.current), [])
  return useCallback(() => {
    clearTimeout(timer.current)
    timer.current = setTimeout(() => ref.current?.(), ms)
  }, [ms])
}

// Quem está online na conversa (presença). Devolve um Set com os ids dos usuários presentes.
export function usePresenca(nomeCanal, meuId) {
  const { cliente } = useRealtime()
  const [presentes, setPresentes] = useState(() => new Set())
  useEffect(() => {
    if (!nomeCanal || !cliente || !meuId) { setPresentes(new Set()); return undefined }
    const canal = cliente.channels.get(nomeCanal)
    let vivo = true
    const atualizar = async () => {
      try {
        const membros = await canal.presence.get()
        if (vivo) setPresentes(new Set(membros.map((m) => m.clientId)))
      } catch { /* sem presença: só não mostra "online" */ }
    }
    const aoMudar = () => atualizar()
    ;(async () => {
      try {
        await canal.presence.subscribe(aoMudar)
        await canal.presence.enter()
        await atualizar()
      } catch (erro) {
        if (erro?.code === 40160) {
          try { await cliente.auth.authorize(); await canal.presence.subscribe(aoMudar); await canal.presence.enter(); await atualizar() } catch { /* ignora */ }
        }
      }
    })()
    return () => {
      vivo = false
      try { canal.presence.unsubscribe(aoMudar); canal.presence.leave().catch(() => {}) } catch { /* cliente já fechado */ }
    }
  }, [nomeCanal, cliente, meuId])
  return presentes
}

// Avisos que valem para o site todo: contador de não lidas no menu e "Fulana tem interesse em ..."
function AssinaturasGlobais() {
  const { user, setNaoLidas, toast } = useStore()
  const nav = useNavigate()
  useCanal(user ? `usuario:${user.id}` : null, (evento, dados) => {
    if (evento === 'nao-lidas') setNaoLidas(dados.total)
    if (evento === 'interesse') {
      toast(`${dados.nome.split(' ')[0]} tem interesse em “${dados.titulo}”`, {
        duracao: 8000, acao: { texto: 'Ver', fn: () => nav(`/item/${dados.itemId}`) },
      })
    }
  })
  return null
}

// Indicador discreto no topo quando o tempo real cai
export function IndicadorConexao() {
  const { estado } = useRealtime()
  if (estado !== 'reconectando' && estado !== 'falhou') return null
  return (
    <span className="conexao" role="status">
      <span className="conexao-ponto" aria-hidden="true" />
      {estado === 'reconectando' ? 'Reconectando…' : 'Sem tempo real'}
    </span>
  )
}
