import { useEffect, useState } from 'react'

// Cor estável derivada do id (mesmo usuário = mesma cor em qualquer tela)
function matiz(chave) {
  let h = 0
  for (const c of String(chave)) h = (h * 31 + c.charCodeAt(0)) >>> 0
  return h % 360
}

export function iniciais(nome = '') {
  const partes = nome.trim().split(/\s+/).filter(Boolean)
  if (!partes.length) return '?'
  const primeira = partes[0][0]
  const ultima = partes.length > 1 ? partes[partes.length - 1][0] : ''
  return (primeira + ultima).toUpperCase()
}

// Foto do usuário ou, sem foto, as iniciais sobre uma cor estável.
// "usuario" precisa de { id, nome, avatarUrl }; "tamanho" é em pixels.
export default function Avatar({ usuario, tamanho = 40, className = '' }) {
  const [falhou, setFalhou] = useState(false)
  const url = usuario?.avatarUrl
  useEffect(() => { setFalhou(false) }, [url])

  const nome = usuario?.nome || 'Usuário'
  const medidas = { width: tamanho, height: tamanho }

  if (url && !falhou) {
    return (
      <img className={`av av-foto ${className}`} style={medidas} src={url} alt={`Foto de ${nome}`}
        width={tamanho} height={tamanho} loading="lazy" decoding="async" onError={() => setFalhou(true)} />
    )
  }
  return (
    <span className={`av av-ini ${className}`} style={{ ...medidas, fontSize: Math.round(tamanho * 0.4), '--h': matiz(usuario?.id || nome) }}
      role="img" aria-label={`Sem foto: iniciais de ${nome}`}>
      {iniciais(nome)}
    </span>
  )
}
