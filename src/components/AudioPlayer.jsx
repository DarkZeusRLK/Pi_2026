import { useEffect, useRef, useState } from 'react'
import { Pause, Play } from 'lucide-react'
import { formatarDuracao } from '../utils/anexos'

// Player próprio: play/pause, barra de progresso clicável (e acessível por teclado) e duração.
// "duracao" (segundos) vem da mensagem: áudios gravados no navegador (WebM) não trazem a duração no arquivo.
export default function AudioPlayer({ src, duracao, rotulo = 'áudio' }) {
  const audio = useRef(null)
  const sondando = useRef(false) // enquanto o navegador descobre a duração, ignora eventos e cliques
  const [tocando, setTocando] = useState(false)
  const [atual, setAtual] = useState(0)
  const [total, setTotal] = useState(duracao || 0)

  useEffect(() => {
    const a = audio.current
    if (!a) return undefined
    const aoCarregar = () => {
      if (Number.isFinite(a.duration) && a.duration > 0) setTotal(a.duration)
      else if (a.duration === Infinity) {
        // truque conhecido: pular para o "fim" força o navegador a descobrir a duração real do WebM
        const voltar = () => {
          a.removeEventListener('timeupdate', voltar)
          a.currentTime = 0
          if (Number.isFinite(a.duration)) setTotal(a.duration)
          setTimeout(() => { sondando.current = false }, 50)
        }
        sondando.current = true
        a.addEventListener('timeupdate', voltar)
        // garantia: se o navegador não avisar, libera o player de qualquer jeito
        setTimeout(() => {
          if (!sondando.current) return
          a.removeEventListener('timeupdate', voltar)
          sondando.current = false
          try { a.currentTime = 0 } catch { /* ignora */ }
        }, 1500)
        a.currentTime = 1e101
      }
    }
    const aoTempo = () => setAtual(a.currentTime)
    const aoFim = () => { if (sondando.current) return; setTocando(false); setAtual(0) }
    const aoPausar = () => { if (!sondando.current) setTocando(false) }
    const aoTocar = () => setTocando(true)
    a.addEventListener('loadedmetadata', aoCarregar)
    a.addEventListener('timeupdate', aoTempo)
    a.addEventListener('ended', aoFim)
    a.addEventListener('pause', aoPausar)
    a.addEventListener('play', aoTocar)
    return () => {
      a.removeEventListener('loadedmetadata', aoCarregar)
      a.removeEventListener('timeupdate', aoTempo)
      a.removeEventListener('ended', aoFim)
      a.removeEventListener('pause', aoPausar)
      a.removeEventListener('play', aoTocar)
    }
  }, [src])

  const duracaoTotal = total || duracao || 0
  const alternar = () => {
    const a = audio.current
    if (!a || sondando.current) return
    if (a.paused) {
      document.querySelectorAll('audio').forEach((x) => { if (x !== a) x.pause() }) // um áudio por vez
      a.play().catch(() => setTocando(false))
    } else a.pause()
  }
  const irPara = (fracao) => {
    const a = audio.current
    if (!a || !duracaoTotal) return
    a.currentTime = Math.min(duracaoTotal, Math.max(0, fracao * duracaoTotal))
    setAtual(a.currentTime)
  }
  const aoClicar = (e) => {
    const r = e.currentTarget.getBoundingClientRect()
    irPara((e.clientX - r.left) / r.width)
  }
  const aoTeclar = (e) => {
    if (e.key === 'ArrowRight') { e.preventDefault(); irPara((atual + 5) / duracaoTotal) }
    if (e.key === 'ArrowLeft') { e.preventDefault(); irPara((atual - 5) / duracaoTotal) }
  }
  const fracao = duracaoTotal ? Math.min(1, atual / duracaoTotal) : 0

  return (
    <div className="player">
      <audio ref={audio} src={src} preload="metadata" />
      <button type="button" className="player-btn" onClick={alternar} aria-label={tocando ? `Pausar ${rotulo}` : `Tocar ${rotulo}`}>
        {tocando ? <Pause size={18} aria-hidden="true" /> : <Play size={18} aria-hidden="true" />}
      </button>
      <div className="player-barra" role="slider" tabIndex={0} aria-label={`Posição do ${rotulo}`} aria-valuemin={0}
        aria-valuemax={Math.round(duracaoTotal)} aria-valuenow={Math.round(atual)}
        aria-valuetext={`${formatarDuracao(atual)} de ${formatarDuracao(duracaoTotal)}`}
        onClick={aoClicar} onKeyDown={aoTeclar}>
        <span className="player-trilho"><span className="player-preenchido" style={{ transform: `scaleX(${fracao})` }} /></span>
      </div>
      <span className="player-tempo">{tocando || atual > 0 ? formatarDuracao(atual) : formatarDuracao(duracaoTotal)}</span>
    </div>
  )
}
