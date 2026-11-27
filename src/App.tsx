import { FormEvent, useState } from 'react'
import { supabase } from './lib/supabase'

export default function App() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const [loggedInEmail, setLoggedInEmail] = useState('')

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setMessage('')

    if (!email.trim() || !password) {
      setMessage('Informe seu e-mail e sua senha.')
      return
    }

    setLoading(true)
    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    })
    setLoading(false)

    if (error) {
      setMessage(error.message === 'Invalid login credentials'
        ? 'E-mail ou senha incorretos.'
        : 'Não foi possível entrar. Verifique os dados e tente novamente.')
      return
    }

    setLoggedInEmail(data.user.email ?? email.trim())
    setPassword('')
    setMessage('Login realizado com sucesso!')
  }

  async function handleLogout() {
    await supabase.auth.signOut()
    setLoggedInEmail('')
    setEmail('')
    setMessage('Você saiu da sua conta.')
  }

  return (
    <main className="login-screen">
      <section className="login-card">
        <header className="brand">
          <div className="brand-mark">GTF</div>
          <p>GENTE TONTA <strong>FIGHT</strong></p>
        </header>

        {loggedInEmail ? (
          <div className="welcome">
            <div className="success-icon">✓</div>
            <h1>ACESSO LIBERADO</h1>
            <p>Você entrou como <strong>{loggedInEmail}</strong>.</p>
            <button className="primary-button" onClick={handleLogout}>SAIR</button>
          </div>
        ) : (
          <>
            <div className="heading">
              <span className="eyebrow">ÁREA DO JOGADOR</span>
              <h1>ENTRAR NO JOGO</h1>
              <p>Use seu e-mail e sua senha para continuar.</p>
            </div>

            <form className="login-form" onSubmit={handleSubmit}>
              <label htmlFor="email">E-MAIL</label>
              <input id="email" name="email" type="email" autoComplete="username"
                placeholder="andre@gtf.com" value={email}
                onChange={(event) => { setEmail(event.target.value); setMessage('') }} />

              <label htmlFor="password">SENHA</label>
              <input id="password" name="password" type="password" autoComplete="current-password"
                placeholder="Digite sua senha" value={password}
                onChange={(event) => { setPassword(event.target.value); setMessage('') }} />

              <button className="primary-button" type="submit" disabled={loading}>
                {loading ? 'VERIFICANDO...' : 'ENTRAR'}
              </button>
              {message && <p className="feedback" role="status">{message}</p>}
            </form>
          </>
        )}
        <footer>GTF © 2026 · UM JOGO ENTRE AMIGOS</footer>
      </section>
    </main>
  )
}