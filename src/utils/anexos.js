// Regras dos anexos do chat. Usado no navegador (antes de enviar) e no servidor (ao gravar a mensagem).

const MB = 1024 * 1024

export const CATEGORIAS_ANEXO = {
  imagem: {
    rotulo: 'Foto',
    mimes: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
    max: 5 * MB, // fotos são comprimidas no navegador antes; o limite cobre GIFs
  },
  arquivo: {
    rotulo: 'Documento',
    mimes: [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'text/plain',
    ],
    max: 10 * MB,
  },
  audio: {
    rotulo: 'Áudio',
    mimes: ['audio/webm', 'audio/mp4', 'audio/mpeg', 'audio/ogg', 'audio/wav', 'audio/x-wav', 'audio/aac', 'audio/x-m4a', 'audio/m4a', 'audio/mp3'],
    max: 10 * MB,
  },
}

export const DURACAO_MAX_AUDIO_SEG = 120

const POR_EXTENSAO = {
  jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', gif: 'image/gif',
  pdf: 'application/pdf', doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xls: 'application/vnd.ms-excel',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  txt: 'text/plain',
  mp3: 'audio/mpeg', m4a: 'audio/mp4', wav: 'audio/wav', ogg: 'audio/ogg', webm: 'audio/webm', aac: 'audio/aac',
}

// "audio/webm;codecs=opus" → "audio/webm"
export const mimeBase = (m) => String(m || '').split(';')[0].trim().toLowerCase()

// Alguns sistemas entregam o arquivo sem tipo (ex.: .docx no Windows): usa a extensão como segunda opção.
export function mimeDoArquivo(arquivo) {
  const base = mimeBase(arquivo?.type)
  if (base && base !== 'application/octet-stream') return base
  const ext = String(arquivo?.name || '').split('.').pop().toLowerCase()
  return POR_EXTENSAO[ext] || base
}

export function categoriaDoMime(mime) {
  const m = mimeBase(mime)
  return Object.keys(CATEGORIAS_ANEXO).find((c) => CATEGORIAS_ANEXO[c].mimes.includes(m)) || null
}

export function formatarTamanho(bytes) {
  if (!Number.isFinite(bytes) || bytes < 0) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < MB) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / MB).toFixed(1).replace('.', ',')} MB`
}

// 72 → "1:12"
export function formatarDuracao(seg) {
  const s = Math.max(0, Math.round(Number(seg) || 0))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

// Nome de arquivo é sempre tratado como texto: sem caracteres de controle nem barras
export function limparNomeArquivo(nome) {
  const limpo = String(nome ?? '').replace(/[\u0000-\u001f\u007f\\/]/g, '').trim().slice(0, 200)
  return limpo || 'arquivo'
}

// Texto da última mensagem na lista de conversas
export function previaDaMensagem({ tipo, texto, anexoNome, duracao }) {
  if (tipo === 'imagem') return '📷 Foto'
  if (tipo === 'arquivo') return `📎 ${anexoNome || 'Documento'}`
  if (tipo === 'audio') return `🎤 Áudio${duracao != null ? ` ${formatarDuracao(duracao)}` : ''}`
  return texto || ''
}
