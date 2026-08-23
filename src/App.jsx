import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { Capacitor } from '@capacitor/core'
import { App as CapApp } from '@capacitor/app'
import { Browser } from '@capacitor/browser'
import ThemeToggle from './components/ThemeToggle'
import BottomNav from './components/BottomNav'
import TeamBadge from './components/TeamBadge'
import Avatar from './components/Avatar'
import { TEAMS, applyTeamAccent } from './lib/teams'
import {
  supabase,
  supabaseConfigError,
  getAuthRedirectUrl,
  readLocalSession,
  writeLocalSession,
  clearLocalSession,
} from './lib/supabase'
import { getUserDisplayFields } from './lib/userDisplay'
import { loadProfile, saveFavoriteTeam } from './lib/store'
import GamesPage from './pages/GamesPage'
import FanPage from './pages/FanPage'
import GroupsPage from './pages/GroupsPage'
import ProfilePage from './pages/ProfilePage'
import PrivacyPolicyPage from './pages/PrivacyPolicyPage'

const PAGE_TITLES = {
  '/fan': '직관',
  '/groups': '그룹',
  '/me': '내 정보',
  '/privacy': '개인정보',
}

function LoginScreen({ onLocal, onKakao, authError }) {
  return (
    <div className="login-screen">
      <div className="login-hero">
        <div className="row space">
          <h1>OurTeam</h1>
          <ThemeToggle />
        </div>
        <p>응원 구단 기록과 직관 모임을 한곳에서.</p>
      </div>
      <div className="login-body">
        {supabaseConfigError ? <p className="muted">{supabaseConfigError}</p> : null}
        {authError ? <p className="error">{authError}</p> : null}
        <div className="stack">
          {supabase ? (
            <button type="button" className="btn kakao" onClick={onKakao}>
              카카오로 계속하기
            </button>
          ) : null}
          <button type="button" className="btn ghost" onClick={onLocal}>
            로컬 체험 모드
          </button>
        </div>
        <p className="muted" style={{ marginTop: 20 }}>
          구단 공식 로고·선수 사진은 사용하지 않습니다.
        </p>
      </div>
    </div>
  )
}

function Onboarding({ user, onDone }) {
  const [picked, setPicked] = useState(null)
  const display = getUserDisplayFields(user)
  return (
    <div className="onboard-screen">
      <div className="onboard-hero">
        <h1>응원 구단을 고르세요</h1>
        <p>처음 한 번만 고르면, 그 구단 일정과 직관 승률을 보여 줍니다. 나중에 바꿀 수 있습니다.</p>
      </div>
      <div className="onboard-body">
        <div className="grid-teams">
          {TEAMS.map((team) => (
            <button
              key={team.code}
              type="button"
              className={`team-pick ${picked === team.code ? 'selected' : ''}`}
              onClick={() => setPicked(team.code)}
            >
              <TeamBadge team={team} />
              <span>{team.nameKo}</span>
            </button>
          ))}
        </div>
        <div style={{ height: 20 }} />
        <button
          type="button"
          className="btn"
          disabled={!picked}
          onClick={async () => {
            await saveFavoriteTeam(user.id, picked, display.displayName, user.email, display.avatarUrl)
            onDone(picked)
          }}
          style={{ width: '100%' }}
        >
          시작하기
        </button>
      </div>
    </div>
  )
}

function Shell({ user, favoriteTeam, onSignOut, onTeamChange }) {
  const team = TEAMS.find((t) => t.code === favoriteTeam)
  const display = getUserDisplayFields(user)
  const location = useLocation()
  const pageTitle = PAGE_TITLES[location.pathname]

  return (
    <div className="app-shell">
      <header className="app-top">
        <div className="greeting">
          {pageTitle ? (
            <h1 className="greeting-title">{pageTitle}</h1>
          ) : (
            <>
              <p className="greeting-kicker">Hello</p>
              <h1 className="greeting-title">{display.displayName}</h1>
            </>
          )}
        </div>
        <div className="app-top-actions">
          <ThemeToggle />
          <Avatar name={display.displayName} url={display.avatarUrl} />
        </div>
      </header>
      <main className="content">
        <Routes>
          <Route path="/" element={<GamesPage favoriteTeam={favoriteTeam} team={team} />} />
          <Route path="/fan" element={<FanPage userId={user.id} favoriteTeam={favoriteTeam} />} />
          <Route path="/groups" element={<GroupsPage userId={user.id} favoriteTeam={favoriteTeam} />} />
          <Route
            path="/me"
            element={
              <ProfilePage
                user={user}
                favoriteTeam={favoriteTeam}
                onSignOut={onSignOut}
                onTeamChange={onTeamChange}
              />
            }
          />
          <Route path="/privacy" element={<PrivacyPolicyPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
      <BottomNav />
    </div>
  )
}

export default function App() {
  const [session, setSession] = useState(() => readLocalSession())
  const [profile, setProfile] = useState(null)
  const [authError, setAuthError] = useState('')
  const [ready, setReady] = useState(!supabase)

  const user = session?.user

  useEffect(() => {
    if (!supabase) return undefined
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setSession(data.session)
      setReady(true)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((_e, next) => {
      setSession(next)
    })
    return () => sub.subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (!Capacitor.isNativePlatform() || !supabase) return undefined
    const listener = CapApp.addListener('appUrlOpen', async ({ url }) => {
      try {
        const parsed = new URL(url)
        const code = parsed.searchParams.get('code')
        if (code) {
          await supabase.auth.exchangeCodeForSession(code)
          await Browser.close()
        }
      } catch {
        /* ignore */
      }
    })
    return () => {
      listener.then((h) => h.remove())
    }
  }, [])

  useEffect(() => {
    if (!user) {
      setProfile(null)
      return
    }
    loadProfile(user.id)
      .then((row) => setProfile(row))
      .catch(() => setProfile(null))
  }, [user])

  const favoriteTeam = profile?.favorite_team_code
  useEffect(() => {
    if (favoriteTeam) applyTeamAccent(favoriteTeam)
  }, [favoriteTeam])

  const signOut = async () => {
    clearLocalSession()
    if (supabase) await supabase.auth.signOut()
    setSession(null)
    setProfile(null)
  }

  const onKakao = async () => {
    setAuthError('')
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'kakao',
      options: {
        redirectTo: getAuthRedirectUrl(),
        skipBrowserRedirect: Capacitor.isNativePlatform(),
      },
    })
    if (error) {
      setAuthError(error.message)
      return
    }
    if (Capacitor.isNativePlatform() && data?.url) {
      await Browser.open({ url: data.url })
    }
  }

  const onLocal = () => {
    const local = {
      user: {
        id: 'local-user',
        email: 'local@ourteam.app',
        user_metadata: { name: '로컬 팬' },
      },
    }
    writeLocalSession(local)
    setSession(local)
  }

  if (!ready) return <div className="splash">불러오는 중…</div>
  if (!user) {
    return <LoginScreen onLocal={onLocal} onKakao={onKakao} authError={authError} />
  }
  if (!favoriteTeam) {
    return (
      <Onboarding
        user={user}
        onDone={(code) => setProfile((prev) => ({ ...(prev || {}), favorite_team_code: code }))}
      />
    )
  }
  return (
    <Shell
      user={user}
      favoriteTeam={favoriteTeam}
      onSignOut={signOut}
      onTeamChange={(code) => setProfile((p) => ({ ...p, favorite_team_code: code }))}
    />
  )
}
