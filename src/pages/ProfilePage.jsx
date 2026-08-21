import { useState } from 'react'
import TeamBadge from '../components/TeamBadge'
import { TEAMS } from '../lib/teams'
import { applyTeamAccent } from '../lib/teams'
import { saveFavoriteTeam } from '../lib/store'
import { getUserDisplayFields } from '../lib/userDisplay'
import { Link } from 'react-router-dom'

export default function ProfilePage({ user, favoriteTeam, onSignOut, onTeamChange }) {
  const display = getUserDisplayFields(user)
  const [saving, setSaving] = useState(false)

  return (
    <div>
      <section className="card">
        <h2>내 정보</h2>
        <p><strong>{display.displayName}</strong></p>
        <p className="muted">{user.email}</p>
      </section>
      <section className="card">
        <h2>응원 구단 변경</h2>
        <div className="grid-teams">
          {TEAMS.map((team) => (
            <button
              key={team.code}
              type="button"
              className={`team-pick ${favoriteTeam === team.code ? 'selected' : ''}`}
              disabled={saving}
              onClick={async () => {
                setSaving(true)
                try {
                  await saveFavoriteTeam(user.id, team.code, display.displayName, user.email, display.avatarUrl)
                  applyTeamAccent(team.code)
                  onTeamChange(team.code)
                } finally {
                  setSaving(false)
                }
              }}
            >
              <TeamBadge team={team} />
              <span>{team.nameKo}</span>
            </button>
          ))}
        </div>
      </section>
      <section className="card">
        <Link to="/privacy">개인정보 처리방침</Link>
        <div style={{ height: 12 }} />
        <button type="button" className="btn ghost" onClick={onSignOut} style={{ width: '100%' }}>
          로그아웃
        </button>
      </section>
    </div>
  )
}
