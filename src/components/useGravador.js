import { useCallback, useEffect, useRef, useState } from 'react'
import { DURACAO_MAX_AUDIO_SEG, mimeBase } from '../utils/anexos'

// Chrome/Android: audio/webm;codecs=opus. Safari/iOS: audio/mp4.
const CANDIDATOS = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus']

export function mimeSuportado() {
  if (typeof MediaRecorder === 'undefined') return ''
  return CANDIDATOS.find((t) => MediaRecorder.isTypeSupported(t)) || ''
}

export const gravacaoDisponivel = () => typeof MediaRecorder !== 'undefined' && !!navigator.mediaDevices?.getUserMedia

function mensagemDeErro(e) {
  switch (e?.name) {
    case 'NotAllowedError':
    case 'SecurityError':
      return 'O microfone está bloqueado. Toque no cadeado ao lado do endereço do site, permita o microfone e tente de novo.'
    case 'NotFoundError':
    case 'DevicesNotFoundError':
      return 'Não encontramos um microfone neste aparelho.'
    case 'NotReadableError':
      return 'Não foi possível usar o microfone. Feche outros apps que estejam usando e tente de novo.'
    default:
      return 'Não foi possível gravar o áudio. Tente de novo ou envie um arquivo de áudio.'
  }
}

// Grava com MediaRecorder: o microfone só é pedido quando a pessoa toca no botão.
// estado: ocioso → gravando → revisao (ouvir antes de enviar) → ocioso
export function useGravador({ onErro }) {
  const [estado, setEstado] = useState('ocioso')
  const [segundos, setSegundos] = useState(0)
  const [resultado, setResultado] = useState(null) // { blob, url, duracao, mime }
  const rec = useRef(null)
  const stream = useRef(null)
  const timer = useRef(null)
  const pedacos = useRef([])
  const descartar = useRef(false)

  const soltarMicrofone = useCallback(() => {
    clearInterval(timer.current)
    stream.current?.getTracks().forEach((t) => t.stop())
    stream.current = null
  }, [])

  useEffect(() => () => {
    descartar.current = true
    soltarMicrofone()
    try { if (rec.current?.state === 'recording') rec.current.stop() } catch { /* já parado */ }
  }, [soltarMicrofone])

  const parar = useCallback(() => {
    try { if (rec.current?.state === 'recording') rec.current.stop() } catch { /* já parado */ }
  }, [])

  const iniciar = useCallback(async () => {
    if (!gravacaoDisponivel()) {
      onErro?.('Este navegador não grava áudio (ou o site não está em conexão segura). Você ainda pode enviar um arquivo de áudio.')
      return
    }
    try {
      stream.current = await navigator.mediaDevices.getUserMedia({ audio: true })
    } catch (e) {
      onErro?.(mensagemDeErro(e))
      return
    }
    try {
      const tipo = mimeSuportado()
      const r = tipo ? new MediaRecorder(stream.current, { mimeType: tipo }) : new MediaRecorder(stream.current)
      rec.current = r
      pedacos.current = []
      descartar.current = false
      const inicio = Date.now()
      r.ondataavailable = (ev) => { if (ev.data.size) pedacos.current.push(ev.data) }
      r.onstop = () => {
        soltarMicrofone()
        if (descartar.current) { setEstado('ocioso'); setSegundos(0); return }
        const mime = mimeBase(r.mimeType || tipo) || 'audio/webm'
        const blob = new Blob(pedacos.current, { type: mime })
        const duracao = Math.min(DURACAO_MAX_AUDIO_SEG, Math.max(1, Math.round((Date.now() - inicio) / 1000)))
        if (blob.size < 200) { setEstado('ocioso'); onErro?.('Não captamos nenhum som. Tente de novo.'); return }
        setResultado({ blob, url: URL.createObjectURL(blob), duracao, mime })
        setEstado('revisao')
      }
      r.start()
      setSegundos(0)
      setEstado('gravando')
      timer.current = setInterval(() => {
        const s = Math.round((Date.now() - inicio) / 1000)
        setSegundos(Math.min(s, DURACAO_MAX_AUDIO_SEG))
        if (s >= DURACAO_MAX_AUDIO_SEG) parar() // máximo de 2 minutos
      }, 250)
    } catch (e) {
      soltarMicrofone()
      setEstado('ocioso')
      onErro?.(mensagemDeErro(e))
    }
  }, [onErro, parar, soltarMicrofone])

  // Cancela a gravação em andamento ou joga fora o áudio já gravado
  const cancelar = useCallback(() => {
    descartar.current = true
    if (rec.current?.state === 'recording') parar()
    else { setEstado('ocioso'); setSegundos(0) }
    setResultado((r) => { if (r) URL.revokeObjectURL(r.url); return null })
  }, [parar])

  // Entrega o áudio gravado e volta ao estado inicial (quem recebe passa a ser dono da URL)
  const consumir = useCallback(() => {
    const r = resultado
    setResultado(null)
    setEstado('ocioso')
    setSegundos(0)
    return r
  }, [resultado])

  return { estado, segundos, resultado, iniciar, parar, cancelar, consumir }
}
