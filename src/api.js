import { useCallback, useEffect, useRef, useState } from 'react'

export class ErroApi extends Error {
  constructor(msg, status, campo) {
    super(msg)
    this.status = status
    this.campo = campo
  }
}

// Chamada à API do próprio site (/api/...). Lança ErroApi com a mensagem em português vinda do servidor.
export async function api(caminho, { method = 'GET', body } = {}) {
  let res
  try {
    res = await fetch(`/api${caminho}`, {
      method,
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
      credentials: 'same-origin',
    })
  } catch {
    throw new ErroApi('Sem conexão com a internet. Verifique sua rede e tente de novo.', 0)
  }
  const dados = await res.json().catch(() => ({}))
  if (!res.ok) throw new ErroApi(dados.erro || 'Algo deu errado. Tente de novo.', res.status, dados.campo)
  return dados
}

// Hook para carregar dados de uma rota GET. "caminho" null = não carrega.
export function useApi(caminho, { intervalo } = {}) {
  const [dados, setDados] = useState(null)
  const [erro, setErro] = useState(null)
  const [carregando, setCarregando] = useState(!!caminho)
  const atual = useRef(caminho)
  atual.current = caminho

  const recarregar = useCallback(async (silencioso = false) => {
    if (!caminho) return
    if (!silencioso) setCarregando(true)
    try {
      const d = await api(caminho)
      if (atual.current === caminho) { setDados(d); setErro(null) }
    } catch (e) {
      // erro 404 aparece mesmo na atualização silenciosa (ex.: o item foi removido enquanto a pessoa olhava)
      if (atual.current === caminho && (!silencioso || e.status === 404)) setErro(e)
    } finally {
      if (atual.current === caminho) setCarregando(false)
    }
  }, [caminho])

  useEffect(() => { recarregar() }, [recarregar])
  useEffect(() => {
    if (!intervalo || !caminho) return
    const t = setInterval(() => { if (document.visibilityState === 'visible') recarregar(true) }, intervalo)
    return () => clearInterval(t)
  }, [intervalo, caminho, recarregar])

  return { dados, setDados, erro, carregando, recarregar }
}
