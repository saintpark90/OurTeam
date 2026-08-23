import { useState } from 'react'
import TeamBadge from '../components/TeamBadge'
import Avatar from '../components/Avatar'
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
        <div className="profile-hero">
          <Avatar name={display.displayName} url={display.avatarUrl} size={72} />
          <h2>{display.displayName}</h2>
          <p className="muted" style={{ margin: 0 }}>{user.email}</p>
        </div>
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
        <div className="stack">
          <Link to="/privacy">개인정보 처리방침</Link>
          <button type="button" className="btn ghost" onClick={onSignOut}>
            로그아웃
          </button>
        </div>
      </section>
    </div>
  )
}
