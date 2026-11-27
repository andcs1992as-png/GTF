import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import type { User } from '@supabase/supabase-js'
import { supabase } from './lib/supabase'

type Profile = {
  user_id: string
  username: string
  character_name: string
  character_image_url: string | null
}
type RankingEntry = {
  user_id: string
  username: string
  character_name: string
  wins: number
  losses: number
  battles_played: number
}

export default function App() {
  const [user, setUser] = useState<User | null>(null)
  const [authReady, setAuthReady] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [ranking, setRanking] = useState<RankingEntry[]>([])
  const [onlineCount, setOnlineCount] = useState(0)
  const [lobbyMessage, setLobbyMessage] = useState('')
  const [rankingLoading, setRankingLoading] = useState(false)

  useEffect(() => {
    let alive = true
    supabase.auth.getSession().then(({ data }) => {
      if (alive) {
        setUser(data.session?.user ?? null)
        setAuthReady(true)
      }
    })
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
      setAuthReady(true)
    })
    return () => {
      alive = false
      listener.subscription.unsubscribe()
    }
  }, [])

  useEffect(() => {
    if (!user) {
      setProfile(null)
      setRanking([])
      setOnlineCount(0)
      return
    }

    let active = true
    async function loadLobby() {
      setRankingLoading(true)
      const [{ data: profileData }, { data: profilesData }, { data: statsData }] = await Promise.all([
        supabase.from('player_profiles').select('user_id, username, character_name, character_image_url').eq('user_id', user!.id).maybeSingle(),
        supabase.from('player_profiles').select('user_id, username, character_name'),
        supabase.from('player_stats').select('user_id, wins, losses, battles_played'),
      ])
      if (!active) return
      if (profileData) setProfile(profileData as Profile)
      const statsByUser = new Map((statsData ?? []).map((stat) => [stat.user_id, stat]))
      const combined = (profilesData ?? []).map((player) => ({
        ...player,
        ...(statsByUser.get(player.user_id) ?? { wins: 0, losses: 0, battles_played: 0 }),
      })) as RankingEntry[]
      combined.sort((a, b) => b.wins - a.wins || b.battles_played - a.battles_played || a.username.localeCompare(b.username))
      setRanking(combined.slice(0, 10))
      setRankingLoading(false)
    }
    loadLobby()
    return () => { active = false }
  }, [user])

  useEffect(() => {
    if (!user) return
    const channel = supabase.channel('gtf-lobby-online', {
      config: { presence: { key: user.id } },
    })
    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState()
        setOnlineCount(Object.keys(state).length)
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track({
            user_id: user.id,
            username: profile?.username ?? user.email?.split('@')[0] ?? 'Jogador',
            online_at: new Date().toISOString(),
          })
        }
      })
    return () => { void supabase.removeChannel(channel) }
  }, [user, profile?.username])

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setMessage('')
    if (!email.trim() || !password) {
      setMessage('Informe seu e-mail e sua senha.')
      return
    }
    setLoading(true)
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
    setLoading(false)
    if (error) {
      setMessage(error.message === 'Invalid login credentials' ? 'E-mail ou senha incorretos.' : 'Não foi possível entrar. Verifique os dados e tente novamente.')
      return
    }
    setPassword('')
  }

  async function handleLogout() {
    await supabase.auth.signOut()
    setLobbyMessage('')
    setMessage('')
  }

  function chooseMode(mode: 'SOLO' | 'VERSUS') {
    if (mode === 'SOLO') {
      setLobbyMessage('O modo SOLO está planejado. A próxima etapa será implementar o combate contra o computador.')
    } else {
      setLobbyMessage('O modo VERSUS está planejado. O Lobby já acompanha jogadores conectados; o pareamento e as batalhas online serão implementados na próxima etapa.')
    }
  }

  if (!authReady) {
    return <main className="login-screen"><section className="login-card loading-card">CARREGANDO GTF...</section></main>
  }

  if (!user) {
    return (
      <main className="login-screen">
        <section className="login-card">
          <header className="brand">
            <div className="brand-mark">GTF</div>
            <p>GENTE TONTA <strong>FIGHT</strong></p>
          </header>
          <div className="heading">
            <span className="eyebrow">ÁREA DO JOGADOR</span>
            <h1>ENTRAR NO JOGO</h1>
            <p>Use seu e-mail e sua senha para continuar.</p>
          </div>
          <form className="login-form" onSubmit={handleSubmit}>
            <label htmlFor="email">E-MAIL</label>
            <input id="email" name="email" type="email" autoComplete="username" placeholder="seu@email.com" value={email} onChange={(event) => { setEmail(event.target.value); setMessage('') }} />
            <label htmlFor="password">SENHA</label>
            <input id="password" name="password" type="password" autoComplete="current-password" placeholder="Digite sua senha" value={password} onChange={(event) => { setPassword(event.target.value); setMessage('') }} />
            <button className="primary-button" type="submit" disabled={loading}>{loading ? 'VERIFICANDO...' : 'ENTRAR'}</button>
            {message && <p className="feedback" role="status">{message}</p>}
          </form>
          <footer>GTF © 2026 · UM JOGO ENTRE AMIGOS</footer>
        </section>
      </main>
    )
  }

  return (
    <main className="lobby-screen">
      <header className="lobby-topbar">
        <div className="lobby-brand"><span>GTF</span><strong>GENTE TONTA <em>FIGHT</em></strong></div>
        <div className="account-area">
          <span className="online-indicator" /> {onlineCount} {onlineCount === 1 ? 'jogador online' : 'jogadores online'}
          <button className="logout-button" onClick={handleLogout}>SAIR</button>
        </div>
      </header>

      <div className="lobby-content">
        <section className="lobby-heading">
          <div><span className="eyebrow">CENTRAL DO JOGADOR</span><h1>LOBBY</h1><p>Escolha como quer entrar na próxima batalha.</p></div>
          <div className="player-welcome">OLÁ, <strong>{profile?.username ?? user.email?.split('@')[0] ?? 'JOGADOR'}</strong></div>
        </section>

        <section className="lobby-grid">
          <article className="panel character-panel">
            <div className="panel-kicker">SEU PERFIL DE COMBATE</div>
            <div className="fighter-placeholder">
              {profile?.character_image_url
                ? <img src={profile.character_image_url} alt="Personagem do jogador" />
                : <svg viewBox="0 0 180 190" role="img" aria-label="Silhueta provisória do personagem"><circle cx="90" cy="43" r="29" fill="currentColor"/><path d="M45 170c2-43 17-70 45-70s43 27 45 70v9H45z" fill="currentColor"/><path d="M62 111 31 153l16 13 29-38M118 111l31 42-16 13-29-38" fill="currentColor"/></svg>}
              <span className="fighter-tag">SEU LUTADOR</span>
            </div>
            <h2>{profile?.character_name ?? 'Lutador sem nome'}</h2>
            <p className="character-note">Seu personagem será exibido aqui. A personalização e a escolha do lutador entram na próxima fase.</p>
            <div className="profile-stats"><div><strong>{ranking.find((entry) => entry.user_id === user.id)?.wins ?? 0}</strong><span>VITÓRIAS</span></div><div><strong>{ranking.find((entry) => entry.user_id === user.id)?.battles_played ?? 0}</strong><span>BATALHAS</span></div></div>
          </article>

          <section className="mode-column">
            <button className="mode-card solo-card" onClick={() => chooseMode('SOLO')}>
              <span className="mode-index">MODO 01</span><span className="mode-icon">1P</span><strong>SOLO</strong><span className="mode-description">Enfrente o computador e prove sua habilidade.</span><span className="mode-action">JOGAR SOZINHO <b>→</b></span>
            </button>
            <button className="mode-card versus-card" onClick={() => chooseMode('VERSUS')}>
              <span className="mode-index">MODO 02</span><span className="mode-icon">VS</span><strong>VERSUS</strong><span className="mode-description">Desafie outro jogador conectado ao GTF.</span><span className="mode-action">ENCONTRAR OPONENTE <b>→</b></span>
            </button>
            {lobbyMessage && <p className="lobby-feedback" role="status">{lobbyMessage}</p>}
          </section>

          <aside className="panel ranking-panel">
            <div className="ranking-title"><div><span className="panel-kicker">OS MELHORES DA ARENA</span><h2>RANKING</h2></div><span className="trophy">🏆</span></div>
            <p className="ranking-subtitle">Classificação por número de vitórias</p>
            {rankingLoading ? <p className="empty-ranking">Carregando classificação...</p> : ranking.length === 0 ? <p className="empty-ranking">Ainda não há jogadores no ranking.</p> : (
              <ol className="ranking-list">
                {ranking.map((entry, index) => (
                  <li className={entry.user_id === user.id ? 'current-player' : ''} key={entry.user_id}>
                    <span className="rank-position">{String(index + 1).padStart(2, '0')}</span>
                    <span className="rank-avatar">{entry.username.slice(0, 1).toUpperCase()}</span>
                    <span className="rank-name"><strong>{entry.username}</strong><small>{entry.character_name}</small></span>
                    <span className="rank-wins"><strong>{entry.wins}</strong><small>VITÓRIAS</small></span>
                  </li>
                ))}
              </ol>
            )}
            <div className="ranking-footnote">As vitórias serão contabilizadas após a implementação das batalhas.</div>
          </aside>
        </section>
        <footer className="lobby-footer">GTF © 2026 · ENTRE NA ARENA. FAÇA HISTÓRIA.</footer>
      </div>
    </main>
  )
}
