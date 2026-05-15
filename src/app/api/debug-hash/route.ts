import bcrypt from 'bcryptjs'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  if (searchParams.get('key') !== 'debug2026') {
    return Response.json({ error: 'forbidden' }, { status: 403 })
  }

  const hash = process.env.ADMIN_PASSWORD_HASH ?? ''
  const valid = hash ? await bcrypt.compare('RaizaRifa2026@', hash) : false

  return Response.json({
    hashLen: hash.length,
    hashStart: hash.slice(0, 7),
    hashEnd: hash.slice(-4),
    valid,
  })
}
