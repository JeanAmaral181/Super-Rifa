import { jwtVerify } from 'jose'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl
  const isApi = pathname.startsWith('/api/admin')
  const isPage = pathname.startsWith('/admin') && !isApi

  const token = request.cookies.get('admin_token')?.value

  if (!token) {
    if (isApi) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (isPage) return NextResponse.redirect(new URL('/', request.url))
    return NextResponse.next()
  }

  try {
    const secret = new TextEncoder().encode(process.env.JWT_SECRET!)
    const { payload } = await jwtVerify(token, secret, { algorithms: ['HS256'] })
    if (payload.role !== 'admin') throw new Error('role mismatch')
    return NextResponse.next()
  } catch {
    const res = isApi
      ? NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      : NextResponse.redirect(new URL('/', request.url))
    res.cookies.delete('admin_token')
    return res
  }
}

export const config = {
  // :path+ exige ao menos 1 segmento — /admin em si passa direto e exibe o login próprio da página
  matcher: ['/admin/:path+', '/api/admin/:path*'],
}
