'use client'

import { useState, useEffect } from 'react'

const GREEN = '#00ff41'
const CYAN = '#00d4ff'

const TERMINAL_LINES: { text: string; type: 'cmd' | 'out' | 'cursor' }[] = [
  { text: '$ whoami',                                                      type: 'cmd' },
  { text: 'jean_amaral  ·  Web Developer & Security Researcher',           type: 'out' },
  { text: '$ cat skills.txt',                                              type: 'cmd' },
  { text: 'TypeScript · Next.js · React · Redis · JWT · OWASP',           type: 'out' },
  { text: '$ cat mission.txt',                                             type: 'cmd' },
  { text: 'Building fast, secure, production-grade web applications.',     type: 'out' },
  { text: '$ █',                                                            type: 'cursor' },
]
const DELAYS = [500, 800, 700, 800, 700, 900, 500]

const STACK = [
  { label: 'TypeScript',  color: '#3178c6' },
  { label: 'JavaScript',  color: '#f7df1e' },
  { label: 'Next.js',     color: '#e0e0e0' },
  { label: 'React',       color: '#61dafb' },
  { label: 'Node.js',     color: '#68a063' },
  { label: 'Tailwind CSS',color: '#38bdf8' },
  { label: 'Redis',       color: '#dc382d' },
  { label: 'JWT',         color: '#fb015b' },
  { label: 'Zod',         color: '#7c86d4' },
  { label: 'bcrypt',      color: GREEN     },
  { label: 'Vercel',      color: '#e0e0e0' },
  { label: 'Git',         color: '#f05032' },
]

const SECURITY = [
  'OWASP Top 10',
  'Rate Limiting',
  'JWT Auth',
  'bcrypt Hashing',
  'Input Validation',
  'CSRF Protection',
  'Timing-Attack Defense',
  'EMV Spec Compliance',
]

const PROJECTS = [
  {
    name: 'Super Rifa',
    year: '2026',
    status: 'production',
    desc: 'Plataforma full-stack de rifas com integração PIX seguindo a especificação EMV do BACEN, estado distribuído via Redis com mutex lock, autenticação JWT e rate limiting por IP.',
    tech: ['Next.js 16', 'TypeScript', 'Upstash Redis', 'JWT', 'bcrypt', 'Zod', 'PIX/EMV', 'Vercel'],
    security: [
      'bcrypt com delay mínimo de 500 ms — defesa contra timing attack',
      'Rate limiting por IP no Redis, janela configurável por rota',
      'Cookie HttpOnly + SameSite=Strict para o token JWT admin',
      'Validação Zod em todas as fronteiras de API',
      'Mutex distribuído (Redis NX) para reservas concorrentes',
    ],
    github: 'https://github.com/JeanAmaral181/rifa-raiza',
    live: 'https://rifa-raiza.vercel.app',
  },
]

export default function Portfolio() {
  const [visibleLines, setVisibleLines] = useState(0)

  useEffect(() => {
    if (visibleLines >= TERMINAL_LINES.length) return
    const t = setTimeout(() => setVisibleLines(v => v + 1), DELAYS[visibleLines])
    return () => clearTimeout(t)
  }, [visibleLines])

  return (
    <div style={{ background: '#0a0a0f', minHeight: '100vh', color: '#c0c0c0', fontFamily: 'system-ui, -apple-system, sans-serif' }}>

      {/* ── Nav ──────────────────────────────────────────────────────────── */}
      <nav style={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 50,
        borderBottom: '1px solid rgba(0,255,65,0.10)',
        background: 'rgba(10,10,15,0.92)', backdropFilter: 'blur(12px)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 2rem', height: '56px',
      }}>
        <span style={{ fontFamily: 'monospace', color: GREEN, fontWeight: 700, letterSpacing: '0.04em', fontSize: '0.95rem' }}>
          jean_amaral<span style={{ color: CYAN }}>~$</span>
        </span>
        <div style={{ display: 'flex', gap: '2rem', fontSize: '0.84rem' }}>
          {['about', 'stack', 'projects', 'contact'].map(s => (
            <a key={s} href={`#${s}`}
              className="nav-link"
              style={{ color: '#606060', textDecoration: 'none' }}
            >
              {s}
            </a>
          ))}
          <a href="https://github.com/JeanAmaral181" target="_blank" rel="noopener noreferrer"
            className="nav-link"
            style={{ color: '#606060', textDecoration: 'none' }}
          >
            GitHub ↗
          </a>
        </div>
      </nav>

      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <section id="home" style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '6rem 2rem 4rem' }}>
        <div style={{ maxWidth: '680px', width: '100%' }}>

          {/* Terminal card */}
          <div style={{
            background: '#0d0d14', borderRadius: '8px',
            border: '1px solid rgba(0,255,65,0.20)',
            boxShadow: '0 0 48px rgba(0,255,65,0.06)',
            overflow: 'hidden', marginBottom: '3rem',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '10px 14px', borderBottom: '1px solid rgba(255,255,255,0.05)', background: '#0b0b12' }}>
              <Dot color="#ff5f57" />
              <Dot color="#febc2e" />
              <Dot color="#28c840" />
              <span style={{ marginLeft: '10px', fontSize: '11px', color: '#3a3a4a', fontFamily: 'monospace' }}>
                jean@portfolio — bash
              </span>
            </div>
            <div style={{ padding: '1.4rem 1.6rem', fontFamily: "'Courier New', monospace", fontSize: '0.88rem', lineHeight: 2, minHeight: '11rem' }}>
              {TERMINAL_LINES.slice(0, visibleLines).map((line, i) => (
                <div key={i} style={{ color: line.type === 'out' ? '#a0a0b0' : GREEN }}>
                  {line.text}
                </div>
              ))}
            </div>
          </div>

          {/* Name */}
          <h1 style={{ fontSize: 'clamp(2.4rem, 7vw, 4rem)', fontWeight: 900, margin: '0 0 0.6rem', color: '#f0f0f0', lineHeight: 1.1, letterSpacing: '-0.02em' }}>
            Jean Amaral<br />
            <span style={{ color: GREEN }}>da Silva</span>
          </h1>
          <p style={{ fontSize: '1.05rem', color: '#606070', marginBottom: '2.2rem', lineHeight: 1.5 }}>
            Web Developer · Cybersecurity Researcher · TypeScript
          </p>
          <div style={{ display: 'flex', gap: '0.9rem', flexWrap: 'wrap' }}>
            <a href="#projects" style={{
              padding: '0.72rem 1.6rem', borderRadius: '4px',
              fontWeight: 700, fontSize: '0.88rem', textDecoration: 'none',
              background: GREEN, color: '#000',
            }}>
              Ver projetos
            </a>
            <a href="https://github.com/JeanAmaral181" target="_blank" rel="noopener noreferrer" style={{
              padding: '0.72rem 1.6rem', borderRadius: '4px',
              fontWeight: 700, fontSize: '0.88rem', textDecoration: 'none',
              border: '1px solid rgba(0,255,65,0.35)', color: GREEN,
            }}>
              GitHub ↗
            </a>
          </div>
        </div>
      </section>

      {/* ── About ────────────────────────────────────────────────────────── */}
      <section id="about" style={{ maxWidth: '680px', margin: '0 auto', padding: '5rem 2rem' }}>
        <SectionLabel text="about" />
        <h2 style={{ fontSize: '1.9rem', fontWeight: 800, color: '#f0f0f0', marginBottom: '1.5rem' }}>
          Olá, sou o Jean.
        </h2>
        <p style={{ lineHeight: 1.85, color: '#808090', marginBottom: '1rem', fontSize: '0.95rem' }}>
          Desenvolvedor web focado em aplicações full-stack seguras e prontas para produção. Trabalho com TypeScript, React e Next.js no front e back, Redis para estado distribuído, e Vercel para CI/CD contínuo.
        </p>
        <p style={{ lineHeight: 1.85, color: '#808090', fontSize: '0.95rem' }}>
          Em segurança, aplico as diretrizes OWASP, implemento autenticação robusta com JWT e bcrypt, rate limiting por IP e validação de schema em todas as camadas da aplicação.
        </p>
      </section>

      {/* ── Stack ────────────────────────────────────────────────────────── */}
      <section id="stack" style={{ maxWidth: '760px', margin: '0 auto', padding: '5rem 2rem' }}>
        <SectionLabel text="stack" />
        <h2 style={{ fontSize: '1.9rem', fontWeight: 800, color: '#f0f0f0', marginBottom: '0.4rem' }}>
          Tecnologias
        </h2>
        <p style={{ color: '#444455', marginBottom: '2.5rem', fontSize: '0.84rem', fontFamily: 'monospace' }}>usadas em produção</p>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.65rem', marginBottom: '3rem' }}>
          {STACK.map(s => (
            <span key={s.label} style={{
              padding: '0.38rem 0.8rem', borderRadius: '3px',
              border: `1px solid ${s.color}30`,
              background: `${s.color}0c`,
              color: s.color, fontSize: '0.8rem', fontWeight: 600, fontFamily: 'monospace',
            }}>
              {s.label}
            </span>
          ))}
        </div>

        <div style={{ fontFamily: 'monospace', fontSize: '0.78rem', color: '#303040', marginBottom: '1rem' }}>
          <span style={{ color: GREEN }}>// </span>cybersecurity
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.65rem' }}>
          {SECURITY.map(s => (
            <span key={s} style={{
              padding: '0.38rem 0.8rem', borderRadius: '3px',
              border: '1px solid rgba(0,255,65,0.18)',
              background: 'rgba(0,255,65,0.05)',
              color: GREEN, fontSize: '0.8rem', fontWeight: 600, fontFamily: 'monospace',
            }}>
              {s}
            </span>
          ))}
        </div>
      </section>

      {/* ── Projects ─────────────────────────────────────────────────────── */}
      <section id="projects" style={{ maxWidth: '760px', margin: '0 auto', padding: '5rem 2rem' }}>
        <SectionLabel text="projects" />
        <h2 style={{ fontSize: '1.9rem', fontWeight: 800, color: '#f0f0f0', marginBottom: '2.5rem' }}>
          Projetos
        </h2>

        {PROJECTS.map(p => (
          <div key={p.name} style={{
            background: '#0d0d14', borderRadius: '6px',
            border: '1px solid rgba(0,255,65,0.14)',
            padding: '2rem', marginBottom: '1.5rem',
          }}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '1rem' }}>
              <div>
                <span style={{ fontFamily: 'monospace', color: GREEN, fontWeight: 800, fontSize: '1.05rem' }}>{p.name}</span>
                <span style={{ marginLeft: '0.75rem', fontSize: '0.72rem', color: '#333344', fontFamily: 'monospace' }}>{p.year}</span>
              </div>
              <span style={{
                padding: '0.18rem 0.6rem', borderRadius: '3px',
                background: 'rgba(0,255,65,0.08)', color: GREEN,
                fontSize: '0.68rem', fontFamily: 'monospace',
              }}>
                ● {p.status}
              </span>
            </div>

            <p style={{ color: '#808090', lineHeight: 1.75, marginBottom: '1.5rem', fontSize: '0.88rem' }}>{p.desc}</p>

            {/* Tech tags */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '1.5rem' }}>
              {p.tech.map(t => (
                <span key={t} style={{
                  padding: '0.22rem 0.6rem', borderRadius: '3px',
                  background: 'rgba(0,212,255,0.06)',
                  border: '1px solid rgba(0,212,255,0.14)',
                  color: CYAN, fontSize: '0.74rem', fontFamily: 'monospace',
                }}>{t}</span>
              ))}
            </div>

            {/* Security list */}
            <div style={{ borderTop: '1px solid rgba(255,255,255,0.04)', paddingTop: '1.2rem', marginBottom: '1.5rem' }}>
              <div style={{ fontFamily: 'monospace', fontSize: '0.72rem', color: '#303040', marginBottom: '0.8rem' }}>
                <span style={{ color: GREEN }}>// </span>security implementations
              </div>
              <ul style={{ margin: 0, padding: 0, listStyle: 'none' }}>
                {p.security.map((s, i) => (
                  <li key={i} style={{ fontSize: '0.8rem', color: '#606070', marginBottom: '0.45rem', fontFamily: 'monospace' }}>
                    <span style={{ color: GREEN, marginRight: '0.5rem' }}>›</span>{s}
                  </li>
                ))}
              </ul>
            </div>

            {/* Links */}
            <div style={{ display: 'flex', gap: '1.2rem' }}>
              <a href={p.github} target="_blank" rel="noopener noreferrer"
                style={{ fontSize: '0.82rem', color: GREEN, textDecoration: 'none', fontWeight: 700 }}>
                GitHub ↗
              </a>
              <a href={p.live} target="_blank" rel="noopener noreferrer"
                style={{ fontSize: '0.82rem', color: '#484858', textDecoration: 'none' }}>
                Live demo ↗
              </a>
            </div>
          </div>
        ))}
      </section>

      {/* ── Contact ──────────────────────────────────────────────────────── */}
      <section id="contact" style={{ maxWidth: '680px', margin: '0 auto', padding: '5rem 2rem 8rem' }}>
        <SectionLabel text="contact" />
        <h2 style={{ fontSize: '1.9rem', fontWeight: 800, color: '#f0f0f0', marginBottom: '1.2rem' }}>
          Contato
        </h2>
        <p style={{ color: '#606070', marginBottom: '2.5rem', lineHeight: 1.75, fontSize: '0.92rem' }}>
          Aberto a projetos, colaborações e oportunidades.
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.9rem' }}>
          {[
            { label: 'github',  value: 'github.com/JeanAmaral181',        href: 'https://github.com/JeanAmaral181' },
            { label: 'email',   value: 'jeanamaralsilva23@gmail.com',      href: 'mailto:jeanamaralsilva23@gmail.com' },
          ].map(c => (
            <a key={c.label} href={c.href} target="_blank" rel="noopener noreferrer"
              className="contact-card"
              style={{
                display: 'flex', alignItems: 'center', gap: '1.25rem',
                padding: '1rem 1.25rem', borderRadius: '4px',
                background: '#0d0d14', border: '1px solid rgba(0,255,65,0.10)',
                textDecoration: 'none',
              }}
            >
              <span style={{ fontFamily: 'monospace', color: GREEN, minWidth: '60px', fontSize: '0.78rem' }}>{c.label}</span>
              <span style={{ color: '#606070', fontSize: '0.88rem' }}>{c.value}</span>
            </a>
          ))}
        </div>
      </section>

      {/* ── Footer ───────────────────────────────────────────────────────── */}
      <footer style={{
        borderTop: '1px solid rgba(255,255,255,0.04)',
        padding: '1.5rem 2rem', textAlign: 'center',
        fontSize: '0.74rem', color: '#252530', fontFamily: 'monospace',
      }}>
        Jean Amaral da Silva · Next.js · TypeScript · Vercel
      </footer>
    </div>
  )
}

function Dot({ color }: { color: string }) {
  return <span style={{ width: 11, height: 11, borderRadius: '50%', background: color, display: 'inline-block', flexShrink: 0 }} />
}

function SectionLabel({ text }: { text: string }) {
  return (
    <div style={{ fontFamily: 'monospace', fontSize: '0.74rem', color: '#2a2a38', marginBottom: '0.9rem' }}>
      <span style={{ color: GREEN }}>// </span>{text}
    </div>
  )
}
