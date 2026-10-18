// Vercel Blob: armazenamento de fotos de perfil e anexos do chat.
// Sem BLOB_READ_WRITE_TOKEN o envio de arquivos fica desativado (o resto do site continua funcionando).
import { del, head } from '@vercel/blob'

export const blobAtivo = () => !!process.env.BLOB_READ_WRITE_TOKEN

// Token: vercel_blob_rw_<idDaLoja>_<aleatório>. As URLs públicas ficam em https://<idDaLoja>.public.blob.vercel-storage.com/...
function baseDaLoja() {
  if (process.env.BLOB_PUBLIC_BASE_URL) return process.env.BLOB_PUBLIC_BASE_URL.replace(/\/+$/, '')
  const id = (process.env.BLOB_READ_WRITE_TOKEN || '').split('_')[3]
  return id ? `https://${id.toLowerCase()}.public.blob.vercel-storage.com` : null
}

// Aceita a URL só se for do nosso Blob Store e estiver dentro da pasta esperada (ex.: avatares/<idDoUsuario>/).
export function urlDaLoja(url, pastaEsperada) {
  const base = baseDaLoja()
  if (!base || typeof url !== 'string' || url.length > 600) return false
  if (!url.startsWith(`${base}/`)) return false
  try {
    const caminho = decodeURIComponent(new URL(url).pathname.slice(1))
    if (caminho.includes('..') || caminho.includes('//')) return false
    return caminho.startsWith(pastaEsperada)
  } catch { return false }
}

export async function apagarBlob(url) {
  if (!url || !blobAtivo() || !urlDaLoja(url, '')) return
  try { await del(url) } catch (e) { console.error('Não foi possível apagar o arquivo antigo do Blob:', e.message) }
}

// Tamanho e tipo reais do arquivo no Blob (null se não existir)
export async function infoDoBlob(url) {
  try {
    const h = await head(url)
    return { size: h.size, contentType: h.contentType }
  } catch { return null }
}
