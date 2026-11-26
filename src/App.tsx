import { FormEvent, useState } from 'react'

export default function App() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [message, setMessage] = useState('')

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!username.trim() || !password) {
      setMessage('Informe seu login e sua senha.')
      return
    }
    setMessage('Interface pronta. A autenticação real será conectada na próxima etapa.')
  }

  return (
    <main className="login-screen">
      <div className="login-panel">
        <header className="game-logo" aria-label="Gente Tonta Fight">
          <span>GENTE TONTA</span>
          <strong>FIGHT</strong>
        </header>
        <form className="login-form" onSubmit={handleSubmit}>
          <label htmlFor="username">LOGIN</label>
          <input id="username" name="username" type="text" autoComplete="username"
            value={username} onChange={(event) => { setUsername(event.target.value); setMessage('') }} />
          <label htmlFor="password">SENHA</label>
          <input id="password" name="password" type="password" autoComplete="current-password"
            value={password} onChange={(event) => { setPassword(event.target.value); setMessage('') }} />
          <button className="enter-button" type="submit">ENTRAR</button>
          {message && <p className="feedback" role="status">{message}</p>}
        </form>
      </div>
    </main>
  )
}