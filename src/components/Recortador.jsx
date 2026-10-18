import { useEffect, useMemo, useRef, useState } from 'react'
import { Minus, Plus } from 'lucide-react'

const SAIDA = 512 // lado da imagem final em pixels

const limitar = (v, min, max) => Math.min(max, Math.max(min, v))

// Recorte quadrado centralizado com ajuste simples: arrastar (ou setas do teclado) e zoom.
// Entrega um Blob 512×512 em WebP (ou JPEG onde o navegador não gera WebP).
export default function Recortador({ arquivo, onCancelar, onConfirmar, onErro }) {
  const dialogRef = useRef(null)
  const [img, setImg] = useState(null)
  const [zoom, setZoom] = useState(1)
  const [pos, setPos] = useState({ x: 0, y: 0 }) // deslocamento do centro da imagem, em px da janela
  const [gerando, setGerando] = useState(false)
  const arrasto = useRef(null)
  const lado = useMemo(() => Math.min(280, Math.max(200, window.innerWidth - 96)), [])

  useEffect(() => {
    const d = dialogRef.current
    if (d && !d.open) d.showModal()
  }, [])

  useEffect(() => {
    let vivo = true
    const url = URL.createObjectURL(arquivo)
    const i = new Image()
    i.onload = () => { if (vivo) setImg(i) }
    i.onerror = () => { if (vivo) onErro?.('Não foi possível abrir essa imagem. Use uma foto JPG, PNG ou WEBP.') }
    i.src = url
    return () => { vivo = false; URL.revokeObjectURL(url) }
  }, [arquivo]) // eslint-disable-line

  const base = img ? lado / Math.min(img.naturalWidth, img.naturalHeight) : 1 // escala que "cobre" a janela
  const escala = base * zoom
  const largura = img ? img.naturalWidth * escala : 0
  const altura = img ? img.naturalHeight * escala : 0
  const limiteX = Math.max(0, (largura - lado) / 2)
  const limiteY = Math.max(0, (altura - lado) / 2)
  const x = limitar(pos.x, -limiteX, limiteX)
  const y = limitar(pos.y, -limiteY, limiteY)

  function mover(dx, dy) { setPos({ x: limitar(x + dx, -limiteX, limiteX), y: limitar(y + dy, -limiteY, limiteY) }) }

  const aoPressionar = (e) => {
    e.currentTarget.setPointerCapture(e.pointerId)
    arrasto.current = { px: e.clientX, py: e.clientY, x, y }
  }
  const aoArrastar = (e) => {
    const a = arrasto.current
    if (!a) return
    setPos({ x: limitar(a.x + e.clientX - a.px, -limiteX, limiteX), y: limitar(a.y + e.clientY - a.py, -limiteY, limiteY) })
  }
  const aoSoltar = () => { arrasto.current = null }
  const aoTeclar = (e) => {
    const passo = e.shiftKey ? 24 : 8
    const mapa = { ArrowLeft: [passo, 0], ArrowRight: [-passo, 0], ArrowUp: [0, passo], ArrowDown: [0, -passo] }
    if (mapa[e.key]) { e.preventDefault(); mover(...mapa[e.key]) }
    if (e.key === '+' || e.key === '=') setZoom((z) => Math.min(3, +(z + 0.1).toFixed(2)))
    if (e.key === '-') setZoom((z) => Math.max(1, +(z - 0.1).toFixed(2)))
  }

  async function confirmar() {
    if (!img) return
    setGerando(true)
    try {
      const c = document.createElement('canvas')
      c.width = c.height = SAIDA
      const ctx = c.getContext('2d')
      ctx.imageSmoothingQuality = 'high'
      const ladoOrigem = lado / escala
      const sx = img.naturalWidth / 2 - x / escala - ladoOrigem / 2
      const sy = img.naturalHeight / 2 - y / escala - ladoOrigem / 2
      ctx.drawImage(img, sx, sy, ladoOrigem, ladoOrigem, 0, 0, SAIDA, SAIDA)
      let blob = await new Promise((ok) => c.toBlob(ok, 'image/webp', 0.86))
      if (!blob || blob.type !== 'image/webp') blob = await new Promise((ok) => c.toBlob(ok, 'image/jpeg', 0.9))
      if (!blob) throw new Error('sem blob')
      onConfirmar(blob)
    } catch {
      onErro?.('Não foi possível preparar a foto. Tente com outra imagem.')
    } finally {
      setGerando(false)
    }
  }

  return (
    <dialog ref={dialogRef} className="dialog crop-dialog" aria-labelledby="crop-titulo"
      onCancel={(e) => { e.preventDefault(); onCancelar() }}>
      <h2 id="crop-titulo">Ajustar foto</h2>
      <p className="muted small">Arraste para enquadrar e use o zoom. A parte clara será a sua foto.</p>

      <div className="crop-view" style={{ width: lado, height: lado }} tabIndex={0} role="group"
        aria-label="Área de enquadramento. Use as setas do teclado para mover e + ou - para o zoom."
        onPointerDown={aoPressionar} onPointerMove={aoArrastar} onPointerUp={aoSoltar} onPointerCancel={aoSoltar} onKeyDown={aoTeclar}>
        {img ? (
          <img src={img.src} alt="" draggable={false}
            style={{ width: largura, height: altura, transform: `translate(${lado / 2 - largura / 2 + x}px, ${lado / 2 - altura / 2 + y}px)` }} />
        ) : <span className="crop-carregando"><span className="spinner" aria-hidden="true" /> Abrindo...</span>}
        <span className="crop-mascara" aria-hidden="true" />
      </div>

      <div className="crop-zoom">
        <button type="button" className="icon-btn" aria-label="Diminuir zoom" onClick={() => setZoom((z) => Math.max(1, +(z - 0.2).toFixed(2)))}><Minus size={18} /></button>
        <input type="range" min="1" max="3" step="0.01" value={zoom} onChange={(e) => setZoom(Number(e.target.value))} aria-label="Zoom" />
        <button type="button" className="icon-btn" aria-label="Aumentar zoom" onClick={() => setZoom((z) => Math.min(3, +(z + 0.2).toFixed(2)))}><Plus size={18} /></button>
      </div>

      <div className="dialog-actions">
        <button type="button" className="btn btn-ghost" onClick={onCancelar}>Cancelar</button>
        <button type="button" className="btn btn-primary" onClick={confirmar} disabled={!img || gerando}>
          {gerando ? <><span className="spinner" aria-hidden="true" /> Preparando...</> : 'Usar esta foto'}
        </button>
      </div>
    </dialog>
  )
}
