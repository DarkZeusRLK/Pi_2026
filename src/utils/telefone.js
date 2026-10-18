// Telefone brasileiro: máscara, normalização e validação.
// Usado no navegador (campos) e no servidor (/api/auth/cadastro e /api/auth/perfil), então não pode depender de React nem do DOM.

export const EXEMPLO_TELEFONE = '(43) 99999-0000'

// Só os dígitos, já sem DDI (+55), sem zero à esquerda e limitado a 11.
export function somenteDigitos(valor) {
  const texto = String(valor ?? '')
  let d = texto.replace(/\D/g, '')
  if (/^\s*(\+|00)\s*55/.test(texto) || (d.length > 11 && d.startsWith('55'))) d = d.slice(2)
  return d.replace(/^0+/, '').slice(0, 11)
}

// (43) 99989-1733 (celular, 11 dígitos) ou (43) 3472-1234 (fixo, 10 dígitos); vai formatando enquanto digita.
export function formatarTelefone(valor) {
  const d = somenteDigitos(valor)
  if (!d) return ''
  if (d.length <= 2) return `(${d}`
  const ddd = d.slice(0, 2)
  if (d.length <= 6) return `(${ddd}) ${d.slice(2)}`
  const corte = d.length === 11 ? 7 : 6
  return `(${ddd}) ${d.slice(2, corte)}-${d.slice(corte)}`
}

// Mensagem de erro em português, ou '' se estiver certo. Campo vazio é aceito (o telefone é opcional).
export function erroTelefone(valor) {
  const d = somenteDigitos(valor)
  if (!d) return ''
  const dica = `Use DDD + número. Exemplo: ${EXEMPLO_TELEFONE}`
  if (d.length < 10) return `Telefone incompleto. ${dica}`
  if (d.length > 11) return `Telefone com dígitos demais. ${dica}`
  const ddd = Number(d.slice(0, 2))
  if (ddd < 11 || ddd > 99) return `DDD inválido. ${dica}`
  if (d.length === 11 && d[2] !== '9') return `Celular com 11 dígitos começa com 9 depois do DDD. ${dica}`
  return ''
}

export function telefoneValido(valor) {
  const d = somenteDigitos(valor)
  return d.length > 0 && erroTelefone(d) === ''
}

// Posição do cursor logo depois do n-ésimo dígito do texto formatado.
export function posicaoAposDigitos(formatado, n) {
  if (n <= 0) return formatado.startsWith('(') ? 1 : 0
  let vistos = 0
  for (let i = 0; i < formatado.length; i++) {
    if (/\d/.test(formatado[i]) && ++vistos === n) return i + 1
  }
  return formatado.length
}
