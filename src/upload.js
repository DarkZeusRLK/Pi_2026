import { upload } from '@vercel/blob/client'

// Envia um arquivo direto do navegador para o Vercel Blob (a rota POST /api/uploads só autoriza).
// Lança Error com mensagem em português; AbortError quando a pessoa cancela.
export async function enviarArquivo(pathname, arquivo, { carga, contentType, onProgresso, sinal } = {}) {
  try {
    return await upload(pathname, arquivo, {
      access: 'public',
      handleUploadUrl: '/api/uploads',
      clientPayload: JSON.stringify(carga || {}),
      contentType: contentType || arquivo.type || undefined,
      onUploadProgress: ({ percentage }) => onProgresso?.(Math.round(percentage)),
      abortSignal: sinal,
    })
  } catch (e) {
    if (sinal?.aborted || e?.name === 'AbortError') throw Object.assign(new Error('Envio cancelado.'), { name: 'AbortError' })
    const msg = String(e?.message || '')
    if (/client token|401|403|Entre na sua conta/i.test(msg)) throw new Error('Não foi possível autorizar o envio. Entre na sua conta de novo e tente outra vez.')
    if (/content.?type|not allowed|type/i.test(msg) && /allow|permit|accept/i.test(msg)) throw new Error('Esse tipo de arquivo não é permitido.')
    if (/size|large|maximum/i.test(msg)) throw new Error('O arquivo é maior do que o permitido.')
    throw new Error('Falha ao enviar o arquivo. Verifique sua conexão e tente de novo.')
  }
}
