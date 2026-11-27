import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import type { User } from '@supabase/supabase-js'
import { supabase } from './lib/supabase'

type Profile = {
  user_id: string
  username: string
  character_name: string
  character_image_url: string | null
  selected_character_id?: string | null
}
type RankingEntry = {
  user_id: string
  username: string
  character_name: string
  wins: number
  losses: number
  battles_played: number
}
type Fighter = { id: string; display_name: string; description: string; image_url: string | null }
type QueueEntry = {
  id: string
  status: 'waiting' | 'matched' | 'in_match' | 'cancelled' | 'expired'
  opponent_id: string | null
  match_id: string | null
  character_id?: string | null
  opponent_character_id?: string | null
  opponent_selected?: boolean
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
  const [catalog, setCatalog] = useState<Fighter[]>([])
  const [chosen, setChosen] = useState('')
  const [mode, setMode] = useState<'SOLO' | 'VERSUS' | null>(null)
  const [view, setView] = useState<'lobby' | 'select' | 'queue'>('lobby')
  const [queueEntry, setQueueEntry] = useState<QueueEntry | null>(null)
  const [queueLoading, setQueueLoading] = useState(false)
  const [queueError, setQueueError] = useState('')
  const [opponentName, setOpponentName] = useState('')

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
      const [{ data: profileData }, { data: profilesData }, { data: statsData }, { data: fighters }] = await Promise.all([
        supabase.from('player_profiles').select('user_id, username, character_name, character_image_url, selected_character_id').eq('user_id', user!.id).maybeSingle(),
        supabase.from('player_profiles').select('user_id, username, character_name'),
        supabase.from('player_stats').select('user_id, wins, losses, battles_played'),
        supabase.from('character_catalog').select('id,display_name,description,image_url').order('sort_order'),
      ])
      if (!active) return
      if (profileData) setProfile(profileData as Profile)
      setCatalog(fighters ?? [])
      const statsByUser = new Map((statsData ?? []).map((stat) => [stat.user_id, stat]))
      const combined = (profilesData ?? []).map((player) => ({
        ...player,
        ...(statsByUser.get(player.user_id) ?? { wins: 0, losses: 0, battles_played: 0 }),
      })) as RankingEntry[]
      combined.sort((a, b) => b.wins - a.wins || b.battles_played - a.battles_played || a.username.localeCompare(b.username))
      setRanking(combined.slice(0, 10))
      setRankingLoading(false)
    }
    void loadLobby()
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

  useEffect(() => {
    if (!user || view !== 'queue' || !queueEntry?.id) return
    let active = true

    const refreshQueue = async () => {
      const { data, error } = await supabase
        .from('matchmaking_queue')
        .select('id,status,opponent_id,match_id,character_id')
        .eq('id', queueEntry.id)
        .maybeSingle()
      if (!active || error || !data) return
      const entry = data as QueueEntry
      setQueueEntry(entry)
      if (entry.status === 'matched' && !entry.character_id && view === 'queue') {
        setChosen('')
        setView('select')
      }
    }

    const channel = supabase
      .channel(`gtf-matchmaking-${queueEntry.id}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'matchmaking_queue',
        filter: `player_id=eq.${user.id}`,
      }, () => { void refreshQueue() })
      .subscribe()

    const poll = window.setInterval(() => { void refreshQueue() }, 5000)
    const heartbeat = window.setInterval(async () => {
      const { data, error } = await supabase.rpc('matchmaking_enter', { p_character_id: null })
      if (!active || error || !data) return
      setQueueEntry(data as QueueEntry)
    }, 30000)

    void refreshQueue()
    return () => {
      active = false
      window.clearInterval(poll)
      window.clearInterval(heartbeat)
      void supabase.removeChannel(channel)
    }
  }, [user, view, queueEntry?.id, chosen])

  useEffect(() => {
    if (!queueEntry?.opponent_id || !['matched', 'in_match'].includes(queueEntry.status)) {
      setOpponentName('')
      return
    }
    let active = true
    supabase.from('player_profiles').select('username')
      .eq('user_id', queueEntry.opponent_id).maybeSingle()
      .then(({ data }) => {
        if (active) setOpponentName(data?.username ?? 'Adversário encontrado')
      })
    return () => { active = false }
  }, [queueEntry?.opponent_id, queueEntry?.status])

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
    if (queueEntry?.status === 'waiting') await supabase.rpc('matchmaking_cancel')
    await supabase.auth.signOut()
    setLobbyMessage('')
    setMessage('')
    setQueueEntry(null)
  }

  async function chooseMode(nextMode: 'SOLO' | 'VERSUS') {
    setMode(nextMode)
    setChosen(nextMode === 'SOLO' ? (profile?.selected_character_id ?? catalog[0]?.id ?? '') : '')
    setQueueEntry(null)
    setQueueError('')
    setLobbyMessage('')
    if (nextMode === 'VERSUS') {
      setQueueLoading(true)
      const { data, error } = await supabase.rpc('matchmaking_start_new')
      setQueueLoading(false)
      if (error) {
        setQueueError('Não foi possível iniciar a busca por adversário. Tente novamente.')
        setView('lobby')
        return
      }
      setQueueEntry(data as QueueEntry)
      setView((data as QueueEntry).status === 'matched' ? 'select' : 'queue')
      return
    }
    setView('select')
  }

  async function saveFighter() {
    if (!chosen) return
    const fighter = catalog.find((item) => item.id === chosen)
    if (!fighter) return

    if (mode === 'VERSUS') {
      if (!queueEntry || queueEntry.status !== 'matched') return
      setQueueLoading(true)
      setQueueError('')
      const { data, error } = await supabase.rpc('matchmaking_choose_character', { p_character_id: chosen })
      setQueueLoading(false)
      if (error) {
        setQueueError('Não foi possível confirmar seu personagem. Tente novamente.')
        return
      }
      setQueueEntry(data as QueueEntry)
      setView('queue')
      return
    }

    setLobbyMessage(`Lutador escolhido para esta partida: ${fighter.display_name}. O combate SOLO será implementado na próxima etapa.`)
    setView('lobby')
  }

  async function cancelQueue() {
    setQueueLoading(true)
    const { data, error } = await supabase.rpc('matchmaking_cancel')
    setQueueLoading(false)
    if (error) {
      setQueueError('Não foi possível cancelar a busca. Tente novamente.')
      return
    }
    const result = data as QueueEntry
    if (result?.status === 'matched' || result?.status === 'in_match') {
      setQueueEntry(result)
      return
    }
    setQueueEntry(result ?? null)
    setView('lobby')
    setLobbyMessage('Busca por adversário cancelada.')
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
            <h1>ENTRAR NO JOGO</h1>
          </div>
          <form className="login-form" onSubmit={handleSubmit}>
            <label htmlFor="email">E-MAIL</label>
            <input id="email" name="email" type="email" autoComplete="username" placeholder="seu@email.com" value={email} onChange={(event) => { setEmail(event.target.value); setMessage('') }} />
            <label htmlFor="password">SENHA</label>
            <input id="password" name="password" type="password" autoComplete="current-password" placeholder="Digite sua senha" value={password} onChange={(event) => { setPassword(event.target.value); setMessage('') }} />
            <button className="primary-button" type="submit" disabled={loading}>{loading ? 'VERIFICANDO...' : 'ENTRAR'}</button>
            {message && <p className="feedback" role="status">{message}</p>}
          </form>
        </section>
      </main>
    )
  }

  if (view === 'select') {
    const versusMatched = mode === 'VERSUS' && queueEntry?.status === 'matched'
    const selectedFighter = catalog.find((fighter) => fighter.id === chosen)

    return (
      <main className="lobby-screen">
        <header className="lobby-topbar">
          <div className="lobby-brand"><span>GTF</span><strong>GENTE TONTA <em>FIGHT</em></strong></div>
          <button className="logout-button" onClick={() => setView('lobby')}>VOLTAR</button>
        </header>
        <section className="selection-content">
          <div className="selection-heading">
            <span className="eyebrow">MODO {mode}</span>
            <h1>ESCOLHA SEU LUTADOR</h1>
            <p>{versusMatched ? `Adversário encontrado: ${opponentName || 'jogador conectado'}. Agora cada um escolhe seu próprio lutador.` : 'Selecione um personagem no centro. A prévia ao lado muda imediatamente; seu personagem principal do Lobby não será alterado.'}</p>
          </div>

          <div className="selection-layout">
            <div className="selection-center">
              <div className="selection-grid-label"><span>SELEÇÃO DE PERSONAGENS</span><small>{catalog.length} LUTADORES DISPONÍVEIS</small></div>
              <div className="character-grid">
                {catalog.map((fighter, i) => (
                  <button key={fighter.id} className={chosen === fighter.id ? 'character-option selected' : 'character-option'} onClick={() => setChosen(fighter.id)} aria-pressed={chosen === fighter.id}>
                    <span className="character-number">{String(i + 1).padStart(2, '0')}</span>
                    <span className="character-art">{fighter.image_url ? <img src={fighter.image_url} alt={fighter.display_name} /> : <span className="fighter-silhouette">GTF</span>}</span>
                    <strong>{fighter.display_name}</strong>
                    {chosen === fighter.id && <span className="selected-check">✓ SELECIONADO</span>}
                  </button>
                ))}
              </div>
            </div>

            <aside className="selection-preview">
              <span className="preview-kicker">SUA ESCOLHA</span>
              <div className="preview-art">
                {selectedFighter?.image_url
                  ? <img src={selectedFighter.image_url} alt={selectedFighter.display_name} />
                  : <div className="preview-placeholder"><span>GTF</span><small>PERSONAGEM</small></div>}
              </div>
              <span className="preview-label">LUTADOR SELECIONADO</span>
              <h2>{selectedFighter?.display_name ?? 'Selecione um lutador'}</h2>
              <p>{selectedFighter?.description ?? 'Escolha um personagem na grade ao lado para visualizar sua seleção.'}</p>
              <div className="preview-status"><span /> PRONTO PARA A BATALHA</div>
            </aside>
          </div>

          {versusMatched && <p className="selection-match-note"><strong>VS {opponentName || 'ADVERSÁRIO'}</strong> · A escolha é individual e simultânea.</p>}
          {queueError && <p className="feedback" role="alert">{queueError}</p>}
          <div className="selection-actions">
            <button className="logout-button" onClick={() => setView('lobby')}>CANCELAR</button>
            <button className="primary-button selection-confirm" disabled={!chosen || queueLoading} onClick={saveFighter}>{queueLoading ? 'CONFIRMANDO...' : mode === 'VERSUS' ? 'CONFIRMAR LUTADOR' : 'CONFIRMAR LUTADOR'}</button>
          </div>
        </section>
      </main>
    )
  }

  if (view === 'queue') {
    const matched = queueEntry?.status === 'matched' || queueEntry?.status === 'in_match'
    const bothSelected = queueEntry?.status === 'in_match'
    const ended = queueEntry?.status === 'cancelled' || queueEntry?.status === 'expired'
    return (
      <main className="lobby-screen">
        <section className="searching-card">
          <div className="search-pulse">VS</div>
          <span className="eyebrow">MODO VERSUS</span>
          <h1>{bothSelected ? 'PERSONAGENS CONFIRMADOS!' : matched ? 'AGUARDANDO SELEÇÃO' : ended ? 'BUSCA ENCERRADA' : 'PROCURANDO ADVERSÁRIO'}</h1>
          <p>{bothSelected ? `Você e ${opponentName || 'seu adversário'} escolheram seus lutadores. A partida está pronta para a próxima etapa.` : matched ? `${opponentName || 'Adversário encontrado'} já está pareado com você. Sua escolha foi registrada; aguardando o personagem do outro jogador.` : ended ? 'Sua busca foi encerrada. Você pode voltar ao Lobby e iniciar outra.' : 'Você está na fila. Assim que outro jogador disponível entrar, o pareamento será automático.'}</p>
          <div className="search-status">{matched ? `PARTIDA ${queueEntry?.match_id?.slice(0, 8).toUpperCase() ?? 'CONFIRMADA'} · ${bothSelected ? 'AMBOS PRONTOS' : 'ESCOLHA DE PERSONAGENS'}` : ended ? 'SEM PAREAMENTO ATIVO' : 'FILA ATIVA · AGUARDANDO JOGADOR'}</div>
          {queueError && <p className="feedback" role="alert">{queueError}</p>}
          {!matched && !ended
            ? <button className="logout-button" disabled={queueLoading} onClick={cancelQueue}>{queueLoading ? 'CANCELANDO...' : 'CANCELAR BUSCA'}</button>
            : bothSelected ? <button className="logout-button" onClick={() => { setQueueEntry(null); setView('lobby') }}>VOLTAR AO LOBBY</button> : <span className="search-status">AGUARDANDO O OUTRO JOGADOR...</span>}
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
            <p className="character-note">Este é seu personagem principal. A escolha de cada partida é independente e não altera seu perfil.</p>
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
