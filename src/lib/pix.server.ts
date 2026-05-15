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
    .replace(/[̀-ͯ]/g, '')
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
  const safeTxid = normalize(txid).replace(/ /g, '').substring(0, 25) || 'RIFA'
  const safeDesc = normalize(description).substring(0, 72)

  // Merchant Account Information (field 26)
  let mai = ''
  mai += emvField('00', 'br.gov.bcb.pix')
  mai += emvField('01', key)
  if (safeDesc) mai += emvField('02', safeDesc)

  // Additional Data Field Template (field 62)
  const additionalData = emvField('05', safeTxid)

  let payload = ''
  payload += emvField('00', '01')           // Payload Format Indicator
  payload += emvField('01', '12')           // Point of Initiation Method (dynamic)
  payload += emvField('26', mai)            // Merchant Account Information
  payload += emvField('52', '0000')         // Merchant Category Code
  payload += emvField('53', '986')          // Transaction Currency (BRL)
  payload += emvField('54', amountStr)      // Transaction Amount
  payload += emvField('58', 'BR')           // Country Code
  payload += emvField('59', name)           // Merchant Name
  payload += emvField('60', city)           // Merchant City
  payload += emvField('62', additionalData) // Additional Data Field Template
  payload += '6304'                         // CRC16 placeholder

  return payload + crc16ccitt(payload)
}
