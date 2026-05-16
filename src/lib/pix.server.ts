function emvField(id: string, value: string): string {
  const len = value.length.toString().padStart(2, '0')
  return `${id}${len}${value}`
}

function crc16ccitt(str: string): string {
  let crc = 0xffff
  for (let i = 0; i < str.length; i++) {
    crc ^= str.charCodeAt(i) << 8
    for (let j = 0; j < 8; j++) {
      if (crc & 0x8000) {
        crc = ((crc << 1) ^ 0x1021) & 0xffff
      } else {
        crc = (crc << 1) & 0xffff
      }
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, '0')
}

function normalize(str: string): string {
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9 ]/g, '')
    .trim()
}

export function generatePixEMV(params: {
  key: string
  merchantName: string
  merchantCity: string
  amount: number
  txid: string
  description: string
}): string {
  const { key, merchantName, merchantCity, amount, txid, description } = params

  const name = normalize(merchantName).substring(0, 25)
  const city = normalize(merchantCity).substring(0, 15)
  const amountStr = amount.toFixed(2)

  // txid: apenas alfanumérico, máx 25 chars (spec BACEN field 62, subfield 05)
  const safeTxid = txid.replace(/[^A-Za-z0-9]/g, '').substring(0, 25) || 'RIFA'

  // Merchant Account Information (field 26) — valor total deve ser ≤ 99 chars
  // (field EMV usa 2 dígitos decimais para o tamanho: máx "99")
  const maiBase = emvField('00', 'br.gov.bcb.pix') + emvField('01', key)

  let mai = maiBase
  if (description) {
    const safeDesc = normalize(description)
    if (safeDesc) {
      // Overhead do subfield 02: 2 (ID) + 2 (len) = 4 chars
      const maxDescLen = 99 - maiBase.length - 4
      if (maxDescLen > 0) {
        mai += emvField('02', safeDesc.substring(0, Math.min(72, maxDescLen)))
      }
      // Se não couber, omite a descrição silenciosamente (é campo opcional)
    }
  }

  // Additional Data Field Template (field 62)
  const additionalData = emvField('05', safeTxid)

  let payload = ''
  payload += emvField('00', '01')           // Payload Format Indicator
  payload += emvField('01', '11')           // Point of Initiation Method (estático)
  payload += emvField('26', mai)            // Merchant Account Information
  payload += emvField('52', '0000')         // Merchant Category Code
  payload += emvField('53', '986')          // Transaction Currency (BRL)
  payload += emvField('54', amountStr)      // Transaction Amount
  payload += emvField('58', 'BR')           // Country Code
  payload += emvField('59', name)           // Merchant Name
  payload += emvField('60', city)           // Merchant City
  payload += emvField('62', additionalData) // Additional Data Field Template
  payload += '6304'                         // placeholder CRC16

  return payload + crc16ccitt(payload)
}
