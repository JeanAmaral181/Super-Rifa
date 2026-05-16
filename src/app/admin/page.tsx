'use client'

import { useState, useEffect } from 'react'
import { EXPIRE_MS } from '@/lib/constants'

interface Entry {
  txid: string
  numbers: string[]
  name: string
  phone: string
  status: 'reserved' | 'paid'
  ts: number
}

interface AdminStats {
  available: number
  reserved: number
  paid: number
  expired: number
  revenue: number
  entries: Entry[]
  excludedTxids: string[]
}

type Tab = 'pending' | 'paid' | 'all'

export default function AdminPage() {
  const [authed, setAuthed] = useState<boolean | null>(null)
  const [password, setPassword] = useState('')
  const [loginError, setLoginError] = useState('')
  const [logging, setLogging] = useState(false)

  const [stats, setStats] = useState<AdminStats | null>(null)
  const [tab, setTab] = useState<Tab>('pending')
  const [loadingStats, setLoadingStats] = useState(false)

  const [manualNumbers, setManualNumbers] = useState('')
  const [manualName, setManualName] = useState('')
  const [manualPhone, setManualPhone] = useState('')
  const [addingManual, setAddingManual] = useState(false)

  const [drawResult, setDrawResult] = useState<{
    winnerNumber: number
    winnerName: string
    winnerPhone: string
    totalPaid: number
    winnerIndex: number
    drawnAt: number
    secretSeed: string
    seedCommitment: string
    ticketSnapshot: number[]
    usedCommitReveal: boolean
  } | null>(null)
  const [drawCommitment, setDrawCommitment] = useState<{
    seedCommitment: string
    committedAt: number
  } | null>(null)
  const [drawing, setDrawing] = useState(false)
  const [committing, setCommitting] = useState(false)

  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null)

  function showToast(msg: string, ok = true) {
    setToast({ msg, ok })
    setTimeout(() => setToast(null), 3500)
  }

  async function loadStats() {
    setLoadingStats(true)
    try {
      const res = await fetch('/api/admin/stats')
      if (res.ok) {
        setStats(await res.json())
      } else if (res.status === 401) {
        setAuthed(false)
      }
    } finally {
      setLoadingStats(false)
    }
  }

  async function loadDraw() {
    try {
      const res = await fetch('/api/admin/draw')
      if (res.ok) {
        const d = await res.json()
        setDrawResult(d.result ?? null)
        setDrawCommitment(d.commitment ?? null)
      }
    } catch {
      // silencia — draw é opcional
    }
  }

  async function checkAuth() {
    try {
      const res = await fetch('/api/admin/stats')
      if (res.ok) {
        setAuthed(true)
        const data = await res.json()
        setStats(data)
        await loadDraw()
      } else {
        setAuthed(false)
      }
    } catch {
      setAuthed(false)
    }
  }

  useEffect(() => {
    checkAuth()
  }, [])

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLogging(true)
    setLoginError('')
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      })
      const data = await res.json()
      if (res.ok) {
        setAuthed(true)
        await loadStats()
      } else {
        setLoginError(data.error || 'Senha incorreta')
      }
    } catch {
      setLoginError('Erro de conexão')
    } finally {
      setLogging(false)
    }
  }

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'DELETE' })
    setAuthed(false)
    setStats(null)
    setPassword('')
  }

  async function handleConfirm(txid: string) {
    const res = await fetch('/api/admin/confirm', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ txid }),
    })
    if (res.ok) {
      showToast('Pagamento confirmado!')
      await loadStats()
    } else {
      const d = await res.json()
      showToast(d.error || 'Erro ao confirmar', false)
    }
  }

  async function handleRelease(txid?: string) {
    const msg = txid
      ? 'Liberar esta reserva? Os números voltarão a ficar disponíveis.'
      : 'Liberar TODAS as reservas expiradas?'
    if (!confirm(msg)) return

    const res = await fetch('/api/admin/release', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(txid ? { txid } : {}),
    })
    if (res.ok) {
      const d = await res.json()
      showToast(`${d.count} número(s) liberado(s)`)
      await loadStats()
    } else {
      showToast('Erro ao liberar', false)
    }
  }

  async function handleManual(e: React.FormEvent) {
    e.preventDefault()
    setAddingManual(true)
    try {
      const res = await fetch('/api/admin/manual', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          numbers: manualNumbers,
          name: manualName,
          phone: manualPhone.replace(/\D/g, ''),
        }),
      })
      const data = await res.json()
      if (res.ok) {
        showToast(`${data.count} número(s) adicionado(s)!`)
        setManualNumbers('')
        setManualName('')
        setManualPhone('')
        await loadStats()
      } else {
        showToast(data.error || 'Erro', false)
      }
    } finally {
      setAddingManual(false)
    }
  }

  async function handleUnpay(txid: string, count: number, status: 'reserved' | 'paid') {
    const msg = status === 'paid'
      ? `⚠️ Isso vai APAGAR permanentemente ${count} número(s) PAGOS. Tem certeza?`
      : `Liberar reserva de ${count} número(s)? Os números voltarão a ficar disponíveis.`
    if (!confirm(msg)) return
    const res = await fetch('/api/admin/unpay', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ txid, force: status === 'paid' }),
    })
    if (res.ok) {
      const d = await res.json()
      showToast(`${d.count} número(s) removido(s)`)
      await loadStats()
    } else {
      const d = await res.json()
      showToast(d.error || 'Erro ao desfazer', false)
    }
  }

  async function handleToggleExclude(txid: string, currentlyExcluded: boolean) {
    const res = await fetch('/api/admin/draw/exclude', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ txid, exclude: !currentlyExcluded }),
    })
    if (res.ok) {
      showToast(currentlyExcluded ? 'Incluído no sorteio' : 'Excluído do sorteio (família)')
      await loadStats()
    } else {
      showToast('Erro ao alterar exclusão', false)
    }
  }

  async function handleCommit() {
    setCommitting(true)
    try {
      const res = await fetch('/api/admin/draw/commit', { method: 'POST' })
      const d = await res.json()
      if (res.ok) {
        setDrawCommitment({ seedCommitment: d.seedCommitment, committedAt: d.committedAt })
        showToast('Compromisso gerado! Publique o hash antes de encerrar vendas.')
      } else {
        showToast(d.error || 'Erro ao gerar compromisso', false)
      }
    } finally {
      setCommitting(false)
    }
  }

  async function handleDraw() {
    if (!confirm('Realizar o sorteio agora? Esta ação não pode ser desfeita.')) return
    setDrawing(true)
    try {
      const res = await fetch('/api/admin/draw', { method: 'POST' })
      const d = await res.json()
      if (res.ok) {
        setDrawResult(d.result)
        showToast('🎉 Sorteio realizado!')
      } else {
        showToast(d.error || 'Erro ao sortear', false)
      }
    } finally {
      setDrawing(false)
    }
  }

  const now = Date.now()

  function timeColor(ts: number) {
    const h = (now - ts) / 3600000
    if (h < 12) return '#69f0ae'
    if (h < 36) return '#FFD700'
    return '#ff1744'
  }

  function formatAge(ts: number) {
    const ms = now - ts
    const h = Math.floor(ms / 3600000)
    const m = Math.floor((ms % 3600000) / 60000)
    return h > 0 ? `${h}h ${m}m` : `${m}m`
  }

  function isExpired(entry: Entry) {
    return entry.status === 'reserved' && now - entry.ts > EXPIRE_MS
  }

  const filteredEntries =
    stats?.entries.filter(e => {
      if (tab === 'pending') return e.status === 'reserved'
      if (tab === 'paid') return e.status === 'paid'
      return true
    }) ?? []

  if (authed === null) {
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        style={{ background: '#060620' }}
      >
        <div className="text-gray-400">Verificando acesso...</div>
      </div>
    )
  }

  if (!authed) {
    return (
      <div
        className="min-h-screen flex items-center justify-center px-4"
        style={{ background: '#060620', fontFamily: 'system-ui, sans-serif' }}
      >
        <div className="w-full max-w-sm">
          <div className="text-center mb-8">
            <div className="font-black text-3xl" style={{ color: '#FFD700' }}>
              🔐 Admin
            </div>
            <div className="text-gray-500 text-sm mt-1">Painel da Rifa</div>
          </div>
          <form
            onSubmit={handleLogin}
            className="rounded-2xl p-6"
            style={{
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,215,0,0.3)',
            }}
          >
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="Senha"
              autoFocus
              className="w-full rounded-xl px-4 py-3 text-white mb-4 outline-none"
              style={{
                background: 'rgba(255,255,255,0.07)',
                border: '1px solid rgba(255,215,0,0.2)',
              }}
            />
            {loginError && <div className="text-red-400 text-sm mb-3">{loginError}</div>}
            <button
              type="submit"
              disabled={logging}
              className="w-full py-3 rounded-xl font-black text-black disabled:opacity-70"
              style={{ background: 'linear-gradient(135deg, #FFD700, #FFA500)' }}
            >
              {logging ? 'Verificando...' : 'Entrar'}
            </button>
          </form>
          <div className="text-center mt-4">
            <a href="/" className="text-gray-500 text-sm hover:text-gray-300">
              ← Voltar ao site
            </a>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div
      className="min-h-screen px-4 py-8"
      style={{ background: '#060620', fontFamily: 'system-ui, sans-serif' }}
    >
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="font-black text-2xl" style={{ color: '#FFD700' }}>
              🎛 Painel Admin
            </h1>
            <a href="/" className="text-gray-500 text-sm hover:text-gray-300">
              ← Voltar ao site
            </a>
          </div>
          <button
            onClick={handleLogout}
            className="px-4 py-2 rounded-xl text-sm font-bold"
            style={{
              background: 'rgba(255,23,68,0.15)',
              color: '#ff1744',
              border: '1px solid rgba(255,23,68,0.3)',
            }}
          >
            Sair
          </button>
        </div>

        {/* Stats Cards */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            {[
              { label: 'Aguardando', value: stats.reserved, color: 'rgb(255,140,0)' },
              { label: 'Pagos', value: stats.paid, color: '#69f0ae' },
              {
                label: 'Arrecadado',
                value: `R$ ${stats.revenue.toFixed(2).replace('.', ',')}`,
                color: '#FFD700',
              },
              { label: 'Expirados', value: stats.expired, color: '#ff1744' },
            ].map((item, i) => (
              <div
                key={i}
                className="rounded-2xl p-4"
                style={{
                  background: 'rgba(255,255,255,0.04)',
                  border: '1px solid rgba(255,255,255,0.08)',
                }}
              >
                <div className="font-black text-2xl" style={{ color: item.color }}>
                  {item.value}
                </div>
                <div className="text-gray-400 text-sm mt-1">{item.label}</div>
              </div>
            ))}
          </div>
        )}

        {/* Expired Alert */}
        {stats && stats.expired > 0 && (
          <div
            className="rounded-2xl p-4 mb-6 flex flex-wrap justify-between items-center gap-3"
            style={{
              background: 'rgba(255,23,68,0.08)',
              border: '1px solid rgba(255,23,68,0.4)',
            }}
          >
            <div>
              <span className="font-bold" style={{ color: '#ff1744' }}>
                ⚠️ {stats.expired} reserva(s) expirada(s)
              </span>
              <span className="text-gray-400 text-sm ml-2">(mais de 48 horas)</span>
            </div>
            <button
              onClick={() => handleRelease()}
              className="px-5 py-2 rounded-xl text-sm font-bold text-white"
              style={{ background: '#ff1744' }}
            >
              Liberar todos
            </button>
          </div>
        )}

        <div className="grid md:grid-cols-2 gap-6 mb-6">
          {/* Manual Purchase */}
          <div
            className="rounded-2xl p-5"
            style={{
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,215,0,0.2)',
            }}
          >
            <h2 className="font-bold mb-4" style={{ color: '#FFD700' }}>
              ➕ Adicionar Compra Manual
            </h2>
            <form onSubmit={handleManual} className="space-y-3">
              <input
                value={manualNumbers}
                onChange={e => setManualNumbers(e.target.value)}
                placeholder="Números: 1, 2, 3"
                className="w-full rounded-xl px-3 py-2.5 text-white text-sm outline-none"
                style={{
                  background: 'rgba(255,255,255,0.07)',
                  border: '1px solid rgba(255,255,255,0.08)',
                }}
              />
              <input
                value={manualName}
                onChange={e => setManualName(e.target.value)}
                placeholder="Nome"
                className="w-full rounded-xl px-3 py-2.5 text-white text-sm outline-none"
                style={{
                  background: 'rgba(255,255,255,0.07)',
                  border: '1px solid rgba(255,255,255,0.08)',
                }}
              />
              <input
                value={manualPhone}
                onChange={e => {
                  const digits = e.target.value.replace(/\D/g, '').slice(0, 11)
                  const masked = digits.length <= 2 ? digits : `${digits.slice(0, 2)} ${digits.slice(2)}`
                  setManualPhone(masked)
                }}
                placeholder="11 987654321"
                maxLength={12}
                inputMode="numeric"
                className="w-full rounded-xl px-3 py-2.5 text-white text-sm outline-none font-mono"
                style={{
                  background: 'rgba(255,255,255,0.07)',
                  border: '1px solid rgba(255,255,255,0.08)',
                }}
              />
              <button
                type="submit"
                disabled={addingManual}
                className="w-full py-2.5 rounded-xl font-bold text-black text-sm disabled:opacity-70"
                style={{ background: 'linear-gradient(135deg, #FFD700, #FFA500)' }}
              >
                {addingManual ? 'Adicionando...' : 'Adicionar'}
              </button>
            </form>
          </div>

          {/* Raffle */}
          <div
            className="rounded-2xl p-5"
            style={{
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,215,0,0.2)',
            }}
          >
            <h2 className="font-bold mb-4" style={{ color: '#FFD700' }}>
              🎲 Sorteio
            </h2>

            {drawResult ? (
              /* Resultado final */
              <div className="space-y-3">
                <div
                  className="rounded-xl p-4 text-center"
                  style={{
                    background: 'rgba(105,240,174,0.08)',
                    border: '1px solid rgba(105,240,174,0.4)',
                  }}
                >
                  <div className="text-4xl font-black mb-1" style={{ color: '#69f0ae' }}>
                    #{drawResult.winnerNumber}
                  </div>
                  <div className="text-white font-bold text-lg">{drawResult.winnerName}</div>
                  <a
                    href={`https://wa.me/${drawResult.winnerPhone}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm mt-1 block"
                    style={{ color: '#25D366' }}
                  >
                    📲 {drawResult.winnerPhone}
                  </a>
                  <div className="text-gray-500 text-xs mt-2">
                    {drawResult.winnerIndex + 1}º de {drawResult.totalPaid} bilhetes pagos •{' '}
                    {new Date(drawResult.drawnAt).toLocaleString('pt-BR')}
                  </div>
                </div>
                {/* Auditoria */}
                <details className="text-xs" style={{ color: '#666' }}>
                  <summary className="cursor-pointer hover:text-gray-400">
                    🔍 Dados de auditoria {drawResult.usedCommitReveal ? '(commit-reveal ✅)' : '(crypto.randomInt)'}
                  </summary>
                  <div className="mt-2 space-y-1 font-mono break-all">
                    <div>
                      <span style={{ color: '#555' }}>seed: </span>
                      <span style={{ color: '#888' }}>{drawResult.secretSeed}</span>
                    </div>
                    <div>
                      <span style={{ color: '#555' }}>SHA256(seed): </span>
                      <span style={{ color: '#888' }}>{drawResult.seedCommitment}</span>
                    </div>
                    <div>
                      <span style={{ color: '#555' }}>bilhetes na hora do sorteio: </span>
                      <span style={{ color: '#888' }}>{drawResult.ticketSnapshot.join(', ')}</span>
                    </div>
                  </div>
                </details>
              </div>
            ) : (
              /* Pré-sorteio */
              <div className="space-y-3">
                {drawCommitment ? (
                  <div
                    className="rounded-xl p-3 text-xs font-mono break-all"
                    style={{
                      background: 'rgba(124,77,255,0.08)',
                      border: '1px solid rgba(124,77,255,0.3)',
                      color: '#b39ddb',
                    }}
                  >
                    <div className="font-sans font-bold mb-1" style={{ color: '#ce93d8' }}>
                      ✅ Compromisso gerado — publique antes de encerrar vendas:
                    </div>
                    {drawCommitment.seedCommitment}
                  </div>
                ) : (
                  <button
                    onClick={handleCommit}
                    disabled={committing}
                    className="w-full py-2.5 rounded-xl font-bold text-sm disabled:opacity-70"
                    style={{
                      background: 'rgba(124,77,255,0.2)',
                      color: '#ce93d8',
                      border: '1px solid rgba(124,77,255,0.4)',
                    }}
                  >
                    {committing ? 'Gerando...' : '🔒 Gerar Compromisso (commit-reveal)'}
                  </button>
                )}

                <button
                  onClick={handleDraw}
                  disabled={drawing || !stats || stats.paid === 0}
                  className="w-full py-3 rounded-xl font-black text-black disabled:opacity-50"
                  style={{ background: 'linear-gradient(135deg, #FFD700, #FFA500)' }}
                >
                  {drawing ? 'Sorteando...' : '🎲 Realizar Sorteio'}
                </button>

                {stats && stats.paid === 0 && (
                  <div className="text-gray-600 text-xs text-center">
                    Nenhum número pago ainda
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Records Table */}
        <div
          className="rounded-2xl overflow-hidden"
          style={{
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid rgba(255,255,255,0.08)',
          }}
        >
          {/* Tabs */}
          <div
            className="flex items-center border-b"
            style={{ borderColor: 'rgba(255,255,255,0.08)' }}
          >
            {(
              [
                ['pending', '⏳ Aguardando'],
                ['paid', '✅ Pagos'],
                ['all', '📋 Todos'],
              ] as [Tab, string][]
            ).map(([key, label]) => (
              <button
                key={key}
                onClick={() => setTab(key)}
                className="px-5 py-3 text-sm font-bold transition-colors"
                style={{
                  color: tab === key ? '#FFD700' : '#555',
                  borderBottom: tab === key ? '2px solid #FFD700' : '2px solid transparent',
                }}
              >
                {label}
              </button>
            ))}
            <button
              onClick={loadStats}
              className="ml-auto px-4 py-3 text-gray-500 text-sm hover:text-gray-300"
              title="Atualizar"
            >
              {loadingStats ? '⏳' : '🔄'}
            </button>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                  {['Números', 'Nome', 'WhatsApp', 'Status', 'Tempo', 'Ações'].map(h => (
                    <th
                      key={h}
                      className="text-left px-4 py-3 font-medium"
                      style={{ color: '#555' }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredEntries.length === 0 && (
                  <tr>
                    <td colSpan={6} className="text-center py-10 text-gray-600">
                      Nenhum registro
                    </td>
                  </tr>
                )}
                {filteredEntries.map(entry => (
                  <tr
                    key={entry.txid}
                    style={{
                      borderBottom: '1px solid rgba(255,255,255,0.04)',
                      background: isExpired(entry) ? 'rgba(255,23,68,0.04)' : 'transparent',
                    }}
                  >
                    <td className="px-4 py-3 text-white max-w-[160px]">
                      <div className="text-xs text-gray-400 truncate">
                        {[...entry.numbers]
                          .sort((a, b) => Number(a) - Number(b))
                          .join(', ')}
                      </div>
                      <div className="text-xs text-gray-600 mt-0.5">{entry.numbers.length} nº</div>
                    </td>
                    <td className="px-4 py-3 text-white">{entry.name}</td>
                    <td className="px-4 py-3">
                      <a
                        href={`https://wa.me/${entry.phone}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ color: '#25D366' }}
                      >
                        {entry.phone}
                      </a>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className="px-2 py-1 rounded-full text-xs font-bold"
                        style={{
                          background:
                            entry.status === 'paid'
                              ? 'rgba(105,240,174,0.15)'
                              : 'rgba(255,140,0,0.15)',
                          color:
                            entry.status === 'paid' ? '#69f0ae' : 'rgb(255,140,0)',
                        }}
                      >
                        {entry.status === 'paid' ? '✅ Pago' : '⏳ Reservado'}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs" style={{ color: timeColor(entry.ts) }}>
                      {formatAge(entry.ts)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1.5">
                        {entry.status === 'reserved' && (
                          <button
                            onClick={() => handleConfirm(entry.txid)}
                            className="px-2.5 py-1 rounded-lg text-xs font-bold"
                            style={{
                              background: 'rgba(105,240,174,0.15)',
                              color: '#69f0ae',
                            }}
                            title="Confirmar pagamento"
                          >
                            ✅
                          </button>
                        )}
                        {entry.status === 'paid' && (() => {
                          const isExcluded = stats?.excludedTxids.includes(entry.txid) ?? false
                          return (
                            <>
                              <button
                                onClick={() => handleToggleExclude(entry.txid, isExcluded)}
                                className="px-2.5 py-1 rounded-lg text-xs font-bold"
                                style={{
                                  background: isExcluded
                                    ? 'rgba(255,152,0,0.2)'
                                    : 'rgba(255,255,255,0.06)',
                                  color: isExcluded ? '#FFB300' : '#666',
                                  border: isExcluded
                                    ? '1px solid rgba(255,152,0,0.4)'
                                    : '1px solid rgba(255,255,255,0.08)',
                                }}
                                title={isExcluded ? 'Família (excluído do sorteio) — clique para incluir' : 'Incluir no sorteio (clique para marcar como família)'}
                              >
                                {isExcluded ? '👨‍👩‍👧' : '🎟'}
                              </button>
                              <button
                                onClick={() => handleUnpay(entry.txid, entry.numbers.length, entry.status)}
                                className="px-2.5 py-1 rounded-lg text-xs font-bold"
                                style={{
                                  background: 'rgba(255,23,68,0.15)',
                                  color: '#ff1744',
                                }}
                                title="Desfazer pagamento"
                              >
                                ↩
                              </button>
                            </>
                          )
                        })()}
                        {entry.status === 'reserved' && (
                          <button
                            onClick={() => handleRelease(entry.txid)}
                            className="px-2.5 py-1 rounded-lg text-xs font-bold"
                            style={{
                              background: 'rgba(255,23,68,0.15)',
                              color: '#ff1744',
                            }}
                            title="Liberar reserva"
                          >
                            🗑
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Toast */}
      {toast && (
        <div
          className="fixed bottom-6 left-1/2 -translate-x-1/2 px-6 py-3 rounded-2xl font-bold text-sm z-50 shadow-2xl whitespace-nowrap"
          style={{
            background: toast.ok ? '#69f0ae' : '#ff1744',
            color: toast.ok ? '#000' : '#fff',
          }}
        >
          {toast.msg}
        </div>
      )}
    </div>
  )
}
