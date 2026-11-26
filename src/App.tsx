import { FormEvent, useState } from 'react'

export default function App() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [message, setMessage] = useState('')

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!username.trim() || !password) {
      setMessage('Preencha seu usuário e sua senha para continuar.')
      return
    }
    setMessage('A tela está funcionando. A autenticação de contas será conectada na próxima etapa.')
  }

  return (
    <main className="page-shell">
      <div className="ambient ambient-one" />
      <div className="ambient ambient-two" />
      <section className="login-layout" aria-label="Acesso ao Gente Tonta Fight">
        <div className="brand-panel">
          <div className="brand-mark" aria-hidden="true"><span>G</span><i>TF</i></div>
          <p className="eyebrow">PLAYER ACCESS // 001</p>
          <h1>GENTE TONTA<br /><span>FIGHT</span></h1>
          <p className="brand-copy">Entre no jogo. Escolha seu lutador.<br />Resolva tudo na arena.</p>
          <div className="pixel-rule"><span /><span /><span /><span /><span /><span /><span /></div>
          <p className="version">WEB EDITION <b>•</b> BUILD 0.1.0</p>
        </div>

        <div className="form-panel">
          <div className="form-heading">
            <span className="status-dot" />
            <span>ÁREA DO JOGADOR</span>
          </div>
          <h2>Bem-vindo de volta!</h2>
          <p className="subtitle">Informe seus dados para entrar.</p>

          <form onSubmit={handleSubmit}>
            <label htmlFor="username">USUÁRIO</label>
            <div className="input-wrap">
              <span className="input-icon" aria-hidden="true">▣</span>
              <input id="username" name="username" type="text" autoComplete="username"
                placeholder="Digite seu usuário" value={username}
                onChange={(event) => { setUsername(event.target.value); setMessage('') }} />
            </div>

            <label htmlFor="password">SENHA</label>
            <div className="input-wrap">
              <span className="input-icon lock" aria-hidden="true">◆</span>
              <input id="password" name="password" type={showPassword ? 'text' : 'password'}
                autoComplete="current-password" placeholder="Digite sua senha" value={password}
                onChange={(event) => { setPassword(event.target.value); setMessage('') }} />
              <button className="visibility-button" type="button"
                onClick={() => setShowPassword(!showPassword)}
                aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}>
                {showPassword ? 'OCULTAR' : 'MOSTRAR'}
              </button>
            </div>

            <div className="form-options">
              <span className="secure-note"><span>●</span> ACESSO DO JOGADOR</span>
              <button type="button" className="text-button" onClick={() => setMessage('Recuperação de senha estará disponível quando as contas forem ativadas.')}>Esqueceu a senha?</button>
            </div>

            <button className="submit-button" type="submit">
              <span>ENTRAR NO JOGO</span><b aria-hidden="true">→</b>
            </button>
            {message && <p className="feedback" role="status">{message}</p>}
          </form>

          <div className="signup-line">
            Ainda não tem uma conta?
            <button type="button" onClick={() => setMessage('O cadastro de jogadores será implementado na próxima etapa.')}>Criar conta</button>
          </div>
          <p className="legal">GTF © 2026 · UM JOGO ENTRE AMIGOS</p>
        </div>
      </section>
    </main>
  )
}