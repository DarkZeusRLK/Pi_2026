import { useEffect, useRef, useState } from 'react'
import { Minus, Plus, X } from 'lucide-react'

// Foto ampliada: zoom (botões ou clique na foto), fecha com Esc, no X ou clicando fora da foto.
export default function Lightbox({ src, alt, onClose }) {
  const ref = useRef(null)
  const [zoom, setZoom] = useState(1)

  useEffect(() => {
    const d = ref.current
    if (d && !d.open) d.showModal()
  }, [])

  const mudar = (z) => setZoom(Math.min(4, Math.max(1, +z.toFixed(2))))

  return (
    <dialog ref={ref} className="lightbox" aria-label="Foto ampliada"
      onCancel={(e) => { e.preventDefault(); onClose() }}
      onClick={(e) => e.target === ref.current && onClose()}>
      <div className="lightbox-barra">
        <button type="button" className="icon-btn" onClick={() => mudar(zoom - 0.5)} disabled={zoom <= 1} aria-label="Diminuir zoom"><Minus size={20} /></button>
        <button type="button" className="icon-btn" onClick={() => mudar(zoom + 0.5)} disabled={zoom >= 4} aria-label="Aumentar zoom"><Plus size={20} /></button>
        <button type="button" className="icon-btn" onClick={onClose} aria-label="Fechar foto" autoFocus><X size={22} /></button>
      </div>
      <div className="lightbox-cena" onClick={(e) => e.target === e.currentTarget && onClose()}>
        <img src={src} alt={alt} onClick={() => mudar(zoom > 1 ? 1 : 2.5)}
          style={zoom > 1 ? { width: `${zoom * 100}%`, maxWidth: 'none', maxHeight: 'none', cursor: 'zoom-out' } : undefined} />
      </div>
    </dialog>
  )
}
