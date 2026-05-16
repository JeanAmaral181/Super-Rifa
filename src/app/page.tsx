'use client'

import { useState, useEffect, useCallback, useRef } from 'react'

type NumberStatus = 'available' | 'selected' | 'reserved' | 'paid'
type TakenNumbers = Record<string, { status: 'reserved' | 'paid' }>

interface Stats {
  available: number
  reserved: number
  paid: number
}

interface Toast {
  message: string
  type: 'success' | 'error' | 'info'
}

interface PixData {
  pixString: string
  qrCode: string
  amount: number
  txid: string
  numbers: number[]
  buyerName: string
}

interface SavedPurchase {
  txid: string
  numbers: number[]
  amount: number
  buyerName: string
  savedAt: number
  liveStatus?: 'paid' | 'reserved' | 'not_found'
}

const TOTAL = 1600
const PRICE = 15
const MAX_SELECT = 50
const WA_ADMIN = '5511968623522'

const PRIZES = [
  { place: '🥇 1º Lugar', name: 'iPhone 15 128GB',   desc: 'O Grande Prêmio! 🏆',  emoji: '📱' },
  { place: '🥈 2º Lugar', name: 'iPhone 11',           desc: 'O Favorito! ❤️',        emoji: '📱' },
  { place: '🥉 3º Lugar', name: 'R$ 200,00 na conta', desc: 'Dinheiro na Mão! 💰',   emoji: '💰' },
  { place: '4º Lugar',    name: 'R$ 150,00 na conta', desc: 'Vale muito! 💵',         emoji: '💵' },
  { place: '5º Lugar',    name: 'R$ 100,00 na conta', desc: 'Boa sorte! 🍀',          emoji: '🍀' },
  { place: '6º Lugar',    name: 'R$ 50,00 na conta',  desc: 'Toda ajuda conta! 🎁',  emoji: '🎁' },
]

const CONFETTI_COLORS = ['#FFD700', '#FFA500', '#FF6B6B', '#69f0ae', '#4FC3F7', '#CE93D8']

export default function Home() {
  const [taken, setTaken] = useState<TakenNumbers>({})
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [stats, setStats] = useState<Stats>({ available: TOTAL, reserved: 0, paid: 0 })
  const [loading, setLoading] = useState(true)
  const [toast, setToast] = useState<Toast | null>(null)

  const [buyModal, setBuyModal] = useState(false)
  const [pixModal, setPixModal] = useState(false)
  const [verifyModal, setVerifyModal] = useState(false)

  const [buyerName, setBuyerName] = useState('')
  const [buyerPhone, setBuyerPhone] = useState('')
  const [buying, setBuying] = useState(false)

  const [pixData, setPixData] = useState<PixData | null>(null)
  const [pendingPayment, setPendingPayment] = useState(false)

  const [verifyQuery, setVerifyQuery] = useState('')
  const [verifyResults, setVerifyResults] = useState<
    Array<{ number: string; status: string }>
  >([])
  const [verifying, setVerifying] = useState(false)

  const [purchases, setPurchases] = useState<SavedPurchase[]>([])

  const toastRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  function showToast(message: string, type: Toast['type'] = 'info') {
    setToast({ message, type })
    if (toastRef.current) clearTimeout(toastRef.current)
    toastRef.current = setTimeout(() => setToast(null), 3500)
  }

  async function fetchNumbers() {
    try {
      const res = await fetch('/api/numbers')
      if (!res.ok) return
      const data = await res.json()
      setTaken(data.taken)
      setStats(data.stats)
    } catch {
      // silent on network errors
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchNumbers()
    const interval = setInterval(fetchNumbers, 30000)
    return () => clearInterval(interval)
  }, [])

  // Recupera PIX pendente do localStorage ao carregar a página
  useEffect(() => {
    try {
      const raw = localStorage.getItem('rifa_pix_pending')
      if (!raw) return
      const saved = JSON.parse(raw) as PixData & { savedAt: number }
      const age = Date.now() - saved.savedAt
      if (age < 47 * 3600 * 1000) {
        setPixData(saved)
        setPendingPayment(true)
      } else {
        localStorage.removeItem('rifa_pix_pending')
      }
    } catch {
      localStorage.removeItem('rifa_pix_pending')
    }
  }, [])

  // Carrega compras salvas do localStorage
  useEffect(() => {
    try {
      const raw = localStorage.getItem('rifa_compras')
      if (!raw) return
      const saved = JSON.parse(raw) as SavedPurchase[]
      if (Array.isArray(saved)) setPurchases(saved)
    } catch {
      // ignore parse errors
    }
  }, [])

  // Verifica status ao vivo de cada compra salva
  useEffect(() => {
    if (purchases.length === 0) return
    let cancelled = false
    async function checkStatuses() {
      const updated = await Promise.all(
        purchases.map(async (p) => {
          try {
            const res = await fetch(`/api/numbers/receipt?txid=${encodeURIComponent(p.txid)}`)
            if (cancelled) return p
            if (res.ok) {
              const d = await res.json()
              return { ...p, liveStatus: d.status as 'paid' | 'reserved' }
            }
            if (res.status === 404) return { ...p, liveStatus: 'not_found' as const }
          } catch { /* ignore */ }
          return p
        })
      )
      if (!cancelled) setPurchases(updated)
    }
    checkStatuses()
    return () => { cancelled = true }
  }, [purchases.length]) // eslint-disable-line react-hooks/exhaustive-deps

  function savePurchasesToStorage(list: SavedPurchase[]) {
    try {
      localStorage.setItem('rifa_compras', JSON.stringify(list))
    } catch { /* ignore */ }
  }

  function addPurchase(pix: PixData) {
    const entry: SavedPurchase = {
      txid: pix.txid,
      numbers: pix.numbers,
      amount: pix.amount,
      buyerName: pix.buyerName,
      savedAt: Date.now(),
    }
    setPurchases(prev => {
      const already = prev.some(p => p.txid === pix.txid)
      if (already) return prev
      const next = [entry, ...prev]
      savePurchasesToStorage(next)
      return next
    })
  }

  function removePurchase(txid: string) {
    setPurchases(prev => {
      const next = prev.filter(p => p.txid !== txid)
      savePurchasesToStorage(next)
      return next
    })
  }

  // Persiste no localStorage sempre que pixData mudar
  useEffect(() => {
    if (pixData) {
      localStorage.setItem('rifa_pix_pending', JSON.stringify({ ...pixData, savedAt: Date.now() }))
    }
  }, [pixData])

  function getStatus(n: number): NumberStatus {
    if (selected.has(n)) return 'selected'
    const entry = taken[String(n)]
    if (!entry) return 'available'
    return entry.status
  }

  const handleNumberClick = useCallback(
    (n: number) => {
      if (taken[String(n)]) return
      setSelected(prev => {
        const next = new Set(prev)
        if (next.has(n)) {
          next.delete(n)
        } else {
          if (next.size >= MAX_SELECT) {
            showToast(`Máximo de ${MAX_SELECT} números por compra`, 'error')
            return prev
          }
          next.add(n)
        }
        return next
      })
    },
    [taken]
  )

  function handleRandom() {
    const available: number[] = []
    for (let i = 1; i <= TOTAL; i++) {
      if (!taken[String(i)]) available.push(i)
    }
    if (available.length === 0) {
      showToast('Nenhum número disponível', 'error')
      return
    }
    // SUBSTITUI a seleção atual pelos novos 5 números — não acumula
    const shuffled = [...available].sort(() => Math.random() - 0.5)
    const picks = shuffled.slice(0, Math.min(5, shuffled.length))
    setSelected(new Set(picks))
    showToast('5 números sorteados! Pode clicar em cada um para trocar.', 'success')
  }

  function handleClearSelection() {
    setSelected(new Set())
  }

  // Máscara: "XX 9XXXXXXXX" (DDD + espaço + 9 dígitos) ou "XX XXXXXXXX" (DDD + 8 dígitos fixo)
  function maskPhone(value: string): string {
    const digits = value.replace(/\D/g, '').slice(0, 11)
    if (digits.length <= 2) return digits
    return `${digits.slice(0, 2)} ${digits.slice(2)}`
  }

  async function handleBuy() {
    if (!buyerName.trim()) {
      showToast('Informe seu nome', 'error')
      return
    }
    const phone = buyerPhone.replace(/\D/g, '')
    if (phone.length < 10 || phone.length > 11) {
      showToast('WhatsApp inválido — use o formato: 11 987654321', 'error')
      return
    }
    if (!/^[1-9][0-9]9\d{7,8}$/.test(phone)) {
      showToast('Número inválido — DDD + 9 + número (ex: 11 987654321)', 'error')
      return
    }

    setBuying(true)
    try {
      const numbers = Array.from(selected)

      const resReserve = await fetch('/api/numbers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ numbers, name: buyerName.trim(), phone }),
      })
      const reserveData = await resReserve.json()
      if (!resReserve.ok) {
        showToast(reserveData.error || 'Erro ao reservar números', 'error')
        return
      }

      const resPix = await fetch('/api/pix/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ txid: reserveData.txid, buyerName: buyerName.trim() }),
      })
      const pixResp = await resPix.json()
      if (!resPix.ok) {
        showToast(pixResp.error || 'Erro ao gerar PIX', 'error')
        return
      }

      setPixData({
        pixString: pixResp.pixString,
        qrCode: pixResp.qrCode,
        amount: pixResp.amount,
        txid: reserveData.txid,
        numbers,
        buyerName: buyerName.trim(),
      })

      setSelected(new Set())
      setBuyModal(false)
      setPixModal(true)
      await fetchNumbers()
    } catch {
      showToast('Erro de conexão. Tente novamente.', 'error')
    } finally {
      setBuying(false)
    }
  }

  async function handleVerify() {
    const q = verifyQuery.trim()
    if (q.length < 3) return
    setVerifying(true)
    try {
      const res = await fetch(`/api/numbers/status?q=${encodeURIComponent(q)}`)
      const data = await res.json()
      setVerifyResults(data.results ?? [])
      setVerifyModal(true)
    } catch {
      showToast('Erro ao verificar', 'error')
    } finally {
      setVerifying(false)
    }
  }

  const selectedCount = selected.size
  const totalAmount = selectedCount * PRICE

  return (
    <div
      className="min-h-screen"
      style={{ background: '#060620', fontFamily: 'system-ui, -apple-system, sans-serif' }}
    >
      {/* Confetti */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
        {CONFETTI_COLORS.map((color, ci) =>
          Array.from({ length: 4 }, (_, i) => {
            const idx = ci * 4 + i
            return (
              <div
                key={idx}
                className="confetti-piece"
                style={{
                  left: `${(idx * 4.8) % 100}%`,
                  animationDelay: `${(idx * 0.25) % 4}s`,
                  animationDuration: `${3.5 + (idx % 5) * 0.5}s`,
                  background: color,
                  width: idx % 3 === 0 ? '6px' : '10px',
                  height: idx % 3 === 0 ? '12px' : '8px',
                }}
              />
            )
          })
        )}
      </div>

      <div className="relative z-10 pb-28">
        {/* Banner de pagamento pendente */}
        {pendingPayment && pixData && !pixModal && (
          <div
            onClick={() => setPixModal(true)}
            className="sticky top-0 z-30 flex items-center justify-between px-4 py-3 cursor-pointer"
            style={{ background: 'rgba(255,140,0,0.92)', backdropFilter: 'blur(8px)' }}
          >
            <span className="text-black font-bold text-sm">
              💳 Você tem um pagamento pendente — toque para ver o PIX
            </span>
            <span className="text-black font-black text-lg">→</span>
          </div>
        )}

        {/* Hero */}
        <section className="text-center pt-12 pb-8 px-4">
          <h1
            className="text-5xl md:text-7xl font-black mb-3 tracking-tight"
            style={{
              background: 'linear-gradient(135deg, #FFD700 0%, #FFA500 50%, #FFD700 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}
          >
            🎊 Super Rifa 🎊
          </h1>
          <p className="text-white text-xl md:text-2xl font-bold mb-5">
            Participe Já e Mude Seu Dia!
          </p>
          <div
            className="inline-block px-6 py-2 rounded-full text-sm font-bold"
            style={{
              background: 'rgba(255,215,0,0.12)',
              border: '1px solid rgba(255,215,0,0.6)',
              color: '#FFD700',
            }}
          >
            🎁 R$ 15,00 por número &bull; 1.600 cotas disponíveis
          </div>
        </section>

        {/* Prize Cards */}
        <section className="max-w-4xl mx-auto px-4 mb-8">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {PRIZES.map((prize, i) => (
              <div
                key={i}
                className="prize-card rounded-2xl p-6 text-center"
                style={{
                  background: 'rgba(255,215,0,0.04)',
                  border: '2px solid rgba(255,215,0,0.7)',
                }}
              >
                <div className="text-5xl mb-3">{prize.emoji}</div>
                <div
                  className="font-bold text-xs mb-2 px-3 py-1 rounded-full inline-block"
                  style={{ background: 'rgba(255,215,0,0.15)', color: '#FFD700' }}
                >
                  {prize.place}
                </div>
                <div className="text-white font-bold text-lg mb-1">{prize.name}</div>
                <div className="text-gray-400 text-sm">{prize.desc}</div>
              </div>
            ))}
          </div>
        </section>

        {/* Stats Bar */}
        <section className="max-w-2xl mx-auto px-4 mb-6">
          <div
            className="rounded-2xl p-4 grid grid-cols-3 gap-4"
            style={{
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.08)',
            }}
          >
            <div className="text-center">
              <div className="text-3xl font-black text-white">{stats.available}</div>
              <div className="text-gray-400 text-sm mt-1">Disponíveis</div>
            </div>
            <div
              className="text-center border-x"
              style={{ borderColor: 'rgba(255,255,255,0.08)' }}
            >
              <div className="text-3xl font-black" style={{ color: 'rgb(255,140,0)' }}>
                {stats.reserved}
              </div>
              <div className="text-gray-400 text-sm mt-1">Aguardando</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-black" style={{ color: '#69f0ae' }}>
                {stats.paid}
              </div>
              <div className="text-gray-400 text-sm mt-1">Pagos</div>
            </div>
          </div>
        </section>

        {/* Number Grid */}
        <section className="max-w-4xl mx-auto px-4 mb-8">
          <div className="flex justify-between items-center mb-3">
            <h2 className="text-white font-bold text-lg">Escolha seus números:</h2>
            {selectedCount > 0 && (
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold" style={{ color: '#FFD700' }}>
                  {selectedCount} selecionado{selectedCount > 1 ? 's' : ''}
                </span>
                <button
                  onClick={handleClearSelection}
                  title="Limpar seleção"
                  className="text-xs px-2 py-1 rounded-lg font-bold"
                  style={{ background: 'rgba(255,23,68,0.15)', color: '#ff6b6b' }}
                >
                  ✕ Limpar
                </button>
              </div>
            )}
          </div>

          {loading ? (
            <div className="text-center text-gray-400 py-16">
              <div className="text-3xl mb-2">⏳</div>
              Carregando números...
            </div>
          ) : (
            <div
              className="overflow-y-auto rounded-2xl p-3"
              style={{
                maxHeight: '420px',
                background: 'rgba(255,255,255,0.02)',
                border: '1px solid rgba(255,255,255,0.06)',
              }}
            >
              <div
                className="grid gap-1"
                style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(46px, 1fr))' }}
              >
                {Array.from({ length: TOTAL }, (_, i) => i + 1).map(n => {
                  const status = getStatus(n)
                  const isClickable = status === 'available' || status === 'selected'
                  return (
                    <button
                      key={n}
                      onClick={() => handleNumberClick(n)}
                      disabled={!isClickable}
                      className="rounded-lg text-xs font-bold py-2 transition-all duration-100"
                      style={{
                        background:
                          status === 'selected'
                            ? '#FFD700'
                            : status === 'reserved'
                              ? 'rgba(255,140,0,.45)'
                              : status === 'paid'
                                ? 'rgba(255,23,68,.45)'
                                : 'rgba(255,255,255,0.07)',
                        color:
                          status === 'selected'
                            ? '#000'
                            : status === 'available'
                              ? '#aaa'
                              : '#fff',
                        cursor: isClickable ? 'pointer' : 'not-allowed',
                        transform: status === 'selected' ? 'scale(1.05)' : 'scale(1)',
                        boxShadow:
                          status === 'selected' ? '0 0 8px rgba(255,215,0,0.5)' : 'none',
                      }}
                    >
                      {n}
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          <div className="mt-3 flex flex-wrap gap-3">
            {[
              { label: 'Disponível', bg: 'rgba(255,255,255,0.07)' },
              { label: 'Selecionado', bg: '#FFD700' },
              { label: 'Reservado', bg: 'rgba(255,140,0,.45)' },
              { label: 'Pago', bg: 'rgba(255,23,68,.45)' },
            ].map(item => (
              <span key={item.label} className="flex items-center gap-1.5 text-gray-400 text-xs">
                <span className="inline-block w-4 h-4 rounded" style={{ background: item.bg }} />
                {item.label}
              </span>
            ))}
          </div>
        </section>

        {/* How to Participate */}
        <section className="max-w-2xl mx-auto px-4 mb-8">
          <h2 className="text-white font-bold text-xl mb-6 text-center">Como Participar</h2>
          <div className="grid grid-cols-3 gap-6">
            {[
              { icon: '🔢', title: 'Escolha números', desc: 'Selecione de 1 a 50 números da grade' },
              { icon: '📝', title: 'Informe dados', desc: 'Digite seu nome e WhatsApp' },
              { icon: '💸', title: 'Pague via PIX', desc: 'QR Code gerado instantaneamente' },
            ].map((item, i) => (
              <div key={i} className="text-center">
                <div
                  className="w-14 h-14 rounded-full mx-auto mb-3 flex items-center justify-center text-2xl"
                  style={{
                    background: 'rgba(255,215,0,0.1)',
                    border: '2px solid rgba(255,215,0,0.5)',
                  }}
                >
                  {item.icon}
                </div>
                <div className="text-white font-bold text-sm mb-1">{item.title}</div>
                <div className="text-gray-400 text-xs">{item.desc}</div>
              </div>
            ))}
          </div>
        </section>

        {/* Verify Payment */}
        <section className="max-w-md mx-auto px-4 mb-8">
          <h2 className="text-white font-bold text-lg mb-4 text-center">Verificar Pagamento</h2>
          <div className="flex gap-2">
            <input
              type="text"
              value={verifyQuery}
              onChange={e => setVerifyQuery(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleVerify()}
              placeholder="Digite seu nome ou WhatsApp..."
              className="flex-1 rounded-xl px-4 py-3 text-white text-sm outline-none"
              style={{
                background: 'rgba(255,255,255,0.07)',
                border: '1px solid rgba(255,215,0,0.25)',
              }}
            />
            <button
              onClick={handleVerify}
              disabled={verifying || verifyQuery.trim().length < 3}
              className="px-5 py-3 rounded-xl font-bold text-black text-sm transition-opacity disabled:opacity-50"
              style={{ background: 'linear-gradient(135deg, #FFD700, #FFA500)' }}
            >
              {verifying ? '...' : '🔍'}
            </button>
          </div>
        </section>

        {/* Minhas Compras */}
        {purchases.length > 0 && (
          <section className="max-w-md mx-auto px-4 mb-8">
            <h2 className="text-white font-bold text-lg mb-4 text-center">Minhas Compras</h2>
            <div className="space-y-3">
              {purchases.map(p => (
                <div
                  key={p.txid}
                  className="rounded-2xl p-4"
                  style={{
                    background: 'rgba(255,255,255,0.04)',
                    border: p.liveStatus === 'paid'
                      ? '1px solid rgba(105,240,174,0.4)'
                      : p.liveStatus === 'not_found'
                        ? '1px solid rgba(255,23,68,0.3)'
                        : '1px solid rgba(255,215,0,0.2)',
                  }}
                >
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <div className="text-white font-bold text-sm">{p.buyerName}</div>
                      <div className="text-gray-500 text-xs font-mono">{p.txid}</div>
                    </div>
                    <span
                      className="px-2 py-1 rounded-full text-xs font-bold ml-2 shrink-0"
                      style={{
                        background: p.liveStatus === 'paid'
                          ? 'rgba(105,240,174,0.15)'
                          : p.liveStatus === 'not_found'
                            ? 'rgba(255,23,68,0.15)'
                            : 'rgba(255,215,0,0.12)',
                        color: p.liveStatus === 'paid'
                          ? '#69f0ae'
                          : p.liveStatus === 'not_found'
                            ? '#ff1744'
                            : '#FFD700',
                      }}
                    >
                      {p.liveStatus === 'paid'
                        ? '✅ Confirmado'
                        : p.liveStatus === 'not_found'
                          ? '❌ Não encontrado'
                          : p.liveStatus === 'reserved'
                            ? '⏳ Aguardando'
                            : '🔄 Verificando...'}
                    </span>
                  </div>
                  <div className="text-gray-400 text-xs mb-1">
                    {p.numbers.length} número{p.numbers.length > 1 ? 's' : ''} •{' '}
                    <span style={{ color: '#FFD700' }}>R$ {p.amount.toFixed(2).replace('.', ',')}</span>
                  </div>
                  <div className="text-gray-600 text-xs mb-3 break-all">
                    {p.numbers.slice(0, 20).join(', ')}{p.numbers.length > 20 ? `… +${p.numbers.length - 20}` : ''}
                  </div>
                  <button
                    onClick={() => removePurchase(p.txid)}
                    className="text-xs text-gray-600 hover:text-gray-400"
                  >
                    Remover da lista
                  </button>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Footer */}
        <footer className="text-center py-8">
          <a href="/admin" style={{ color: 'rgba(255,255,255,0.06)', fontSize: '11px' }}>
            admin
          </a>
        </footer>
      </div>

      {/* Sticky Buy Button */}
      <div
        className="fixed bottom-0 left-0 right-0 p-4 z-20"
        style={{ background: 'linear-gradient(to top, #060620 60%, transparent)' }}
      >
        <div className="max-w-md mx-auto flex gap-2">
          <button
            onClick={handleRandom}
            className="px-4 py-3 rounded-xl font-bold text-sm shrink-0"
            style={{ background: 'rgba(255,255,255,0.09)', color: '#ccc' }}
          >
            🎲 Aleatório
          </button>
          <button
            disabled={selectedCount === 0}
            onClick={() => setBuyModal(true)}
            className="flex-1 py-3 rounded-xl font-black text-sm transition-all duration-200"
            style={{
              background:
                selectedCount > 0
                  ? 'linear-gradient(135deg, #FFD700, #FFA500)'
                  : 'rgba(255,255,255,0.06)',
              boxShadow:
                selectedCount > 0 ? '0 4px 24px rgba(255,165,0,0.45)' : 'none',
              color: selectedCount > 0 ? '#000' : '#444',
            }}
          >
            {selectedCount > 0
              ? `🛒 Comprar ${selectedCount} número${selectedCount > 1 ? 's' : ''} • R$ ${totalAmount.toFixed(2).replace('.', ',')}`
              : '🛒 Selecione os números'}
          </button>
        </div>
      </div>

      {/* Buy Modal */}
      {buyModal && (
        <Modal onClose={() => setBuyModal(false)} title="Seus dados">
          <div className="space-y-4">
            <div>
              <label className="text-gray-400 text-sm block mb-1.5">Nome completo</label>
              <input
                type="text"
                value={buyerName}
                onChange={e => setBuyerName(e.target.value)}
                placeholder="Ex: João Silva"
                className="w-full rounded-xl px-4 py-3 text-white outline-none"
                style={{
                  background: 'rgba(255,255,255,0.07)',
                  border: '1px solid rgba(255,215,0,0.25)',
                }}
                autoFocus
              />
            </div>
            <div>
              <label className="text-gray-400 text-sm block mb-1.5">
                WhatsApp
              </label>
              <input
                type="tel"
                value={buyerPhone}
                onChange={e => setBuyerPhone(maskPhone(e.target.value))}
                placeholder="11 987654321"
                maxLength={12}
                inputMode="numeric"
                className="w-full rounded-xl px-4 py-3 text-white outline-none font-mono text-lg tracking-widest"
                style={{
                  background: 'rgba(255,255,255,0.07)',
                  border: '1px solid rgba(255,215,0,0.25)',
                }}
              />
              <div className="text-gray-600 text-xs mt-1">DDD + número — ex: 11 987654321</div>
            </div>
            <div
              className="rounded-xl p-4 text-sm"
              style={{
                background: 'rgba(255,215,0,0.05)',
                border: '1px solid rgba(255,215,0,0.2)',
              }}
            >
              <div className="text-gray-400 mb-2">Resumo</div>
              <div className="text-gray-300">
                {selectedCount} número{selectedCount > 1 ? 's' : ''} selecionado
                {selectedCount > 1 ? 's' : ''}
              </div>
              <div className="text-white font-black text-2xl mt-1">
                R$ {totalAmount.toFixed(2).replace('.', ',')}
              </div>
            </div>
            <button
              onClick={handleBuy}
              disabled={buying}
              className="w-full py-3 rounded-xl font-black text-black disabled:opacity-70 transition-opacity"
              style={{ background: 'linear-gradient(135deg, #FFD700, #FFA500)' }}
            >
              {buying ? '⏳ Processando...' : '💸 Gerar QR Code PIX'}
            </button>
          </div>
        </Modal>
      )}

      {/* PIX Modal */}
      {pixModal && pixData && (
        <Modal
          onClose={() => {
            setPixModal(false)
            setPendingPayment(true)
            showToast(`Reserva salva! Código: ${pixData.txid}`, 'info')
          }}
          title="Pague via PIX"
        >
          <div className="space-y-5 text-center">
            <div>
              <div className="text-gray-400 text-sm">Valor total</div>
              <div className="text-3xl font-black" style={{ color: '#69f0ae' }}>
                R$ {pixData.amount.toFixed(2).replace('.', ',')}
              </div>
            </div>

            <img
              src={pixData.qrCode}
              alt="QR Code PIX"
              className="mx-auto rounded-xl"
              style={{ width: 200, height: 200 }}
            />

            <div>
              <div className="text-gray-400 text-sm mb-1">Chave PIX (e-mail)</div>
              <div className="text-white font-bold">raizagdor@gmail.com</div>
            </div>

            <div>
              <div className="text-gray-400 text-sm mb-2">Código Pix — Copia e Cola</div>
              <button
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(pixData.pixString)
                    showToast('Código copiado!', 'success')
                  } catch {
                    showToast('Não foi possível copiar automaticamente — selecione e copie manualmente.', 'error')
                  }
                }}
                className="w-full text-left text-xs rounded-xl p-3 break-all transition-opacity hover:opacity-80"
                style={{ background: 'rgba(255,255,255,0.07)', color: '#ccc' }}
              >
                {pixData.pixString}
              </button>
              <div className="text-gray-500 text-xs mt-1">Toque para copiar</div>
            </div>

            <a
              href={`https://wa.me/${WA_ADMIN}?text=${encodeURIComponent(
                `Olá! Realizei o pagamento da rifa.\n\n` +
                  `👤 Nome: ${pixData.buyerName}\n` +
                  `🔢 Números: ${pixData.numbers.join(', ')}\n` +
                  `💰 Valor: R$ ${pixData.amount.toFixed(2)}\n` +
                  `🔑 Referência: ${pixData.txid}`
              )}`}
              target="_blank"
              rel="noopener noreferrer"
              className="block w-full py-3 rounded-xl font-bold text-white text-sm"
              style={{ background: '#25D366' }}
            >
              📲 Enviar Comprovante no WhatsApp
            </a>

            <div
              className="rounded-xl px-4 py-3 text-sm"
              style={{ background: 'rgba(255,140,0,0.1)', color: 'rgb(255,140,0)' }}
            >
              ⏳ Reserva válida por 48 horas — código: <span className="font-mono font-bold">{pixData.txid}</span>
            </div>

            <button
              onClick={() => {
                if (pixData) addPurchase(pixData)
                localStorage.removeItem('rifa_pix_pending')
                setPendingPayment(false)
                setPixData(null)
                setPixModal(false)
                showToast('Salvo em Minhas Compras! Aguarde a confirmação.', 'success')
              }}
              className="w-full py-2 rounded-xl text-sm font-bold"
              style={{ background: 'rgba(255,255,255,0.06)', color: '#888' }}
            >
              ✅ Já paguei — fechar
            </button>
          </div>
        </Modal>
      )}

      {/* Verify Modal */}
      {verifyModal && (
        <Modal onClose={() => setVerifyModal(false)} title="Resultado da busca">
          {verifyResults.length === 0 ? (
            <div className="text-center text-gray-400 py-6">
              Nenhum número encontrado para &ldquo;{verifyQuery}&rdquo;
            </div>
          ) : (
            <div className="space-y-2">
              {verifyResults.map((r, i) => (
                <div
                  key={i}
                  className="flex justify-between items-center rounded-xl px-4 py-3 text-sm"
                  style={{ background: 'rgba(255,255,255,0.05)' }}
                >
                  <span className="text-white font-bold">#{r.number}</span>
                  <span
                    className="font-bold text-xs px-2 py-1 rounded-full"
                    style={{
                      background:
                        r.status === 'paid'
                          ? 'rgba(105,240,174,0.15)'
                          : 'rgba(255,140,0,0.15)',
                      color: r.status === 'paid' ? '#69f0ae' : 'rgb(255,140,0)',
                    }}
                  >
                    {r.status === 'paid' ? '✅ Pago' : '⏳ Reservado'}
                  </span>
                </div>
              ))}
            </div>
          )}
        </Modal>
      )}

      {/* Toast */}
      {toast && (
        <div
          className="fixed bottom-24 left-1/2 -translate-x-1/2 px-6 py-3 rounded-2xl font-bold text-sm z-50 shadow-2xl whitespace-nowrap"
          style={{
            background:
              toast.type === 'success'
                ? '#69f0ae'
                : toast.type === 'error'
                  ? '#ff1744'
                  : '#1a237e',
            color: toast.type === 'success' ? '#000' : '#fff',
          }}
        >
          {toast.message}
        </div>
      )}
    </div>
  )
}

function Modal({
  onClose,
  title,
  children,
}: {
  onClose: () => void
  title: string
  children: React.ReactNode
}) {
  return (
    <div
      className="fixed inset-0 flex items-center justify-center z-40 p-4"
      style={{ background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)' }}
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div
        className="w-full max-w-sm rounded-2xl p-6 relative"
        style={{
          background: '#0b0b2e',
          border: '2px solid rgba(255,215,0,0.7)',
          maxHeight: '90vh',
          overflowY: 'auto',
        }}
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-500 hover:text-white text-xl leading-none"
        >
          ✕
        </button>
        <h3 className="font-bold text-xl mb-5" style={{ color: '#FFD700' }}>
          {title}
        </h3>
        {children}
      </div>
    </div>
  )
}
