// Redimensiona a foto no navegador antes de enviar (lado maior limitado a "max" pixels).
// Devolve { blob, mime }. GIF não é recomprimido (perderia a animação).
export async function comprimirImagem(arquivo, { max = 1600, qualidade = 0.82 } = {}) {
  if (arquivo.type === 'image/gif') return { blob: arquivo, mime: 'image/gif' }
  const url = URL.createObjectURL(arquivo)
  try {
    const img = await new Promise((ok, erro) => {
      const i = new Image()
      i.onload = () => ok(i)
      i.onerror = () => erro(new Error('imagem inválida'))
      i.src = url
    })
    const escala = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight))
    const c = document.createElement('canvas')
    c.width = Math.max(1, Math.round(img.naturalWidth * escala))
    c.height = Math.max(1, Math.round(img.naturalHeight * escala))
    c.getContext('2d').drawImage(img, 0, 0, c.width, c.height)
    let blob = await new Promise((ok) => c.toBlob(ok, 'image/webp', qualidade))
    if (!blob || blob.type !== 'image/webp') blob = await new Promise((ok) => c.toBlob(ok, 'image/jpeg', qualidade))
    if (!blob) throw new Error('sem blob')
    // se a foto já era pequena e a recompressão não ajudou, mantém o original
    if (escala === 1 && blob.size >= arquivo.size && ['image/jpeg', 'image/png', 'image/webp'].includes(arquivo.type)) {
      return { blob: arquivo, mime: arquivo.type }
    }
    return { blob, mime: blob.type }
  } finally {
    URL.revokeObjectURL(url)
  }
}
