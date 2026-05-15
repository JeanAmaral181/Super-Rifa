import { cookies } from 'next/headers'

export async function DELETE() {
  const cookieStore = await cookies()
  cookieStore.delete('admin_token')
  return Response.json({ success: true })
}
