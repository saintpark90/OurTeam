import { useEffect, useMemo, useState } from 'react'
import TeamBadge from '../components/TeamBadge'
import { getTeam } from '../lib/teams'
import {
  fetchAllGames,
  fetchMyAttendance,
  fetchPlayerStats,
  listMyGroups,
  toggleAttendance,
  fetchGroupAttendanceForGame,
} from '../lib/store'
import {
  aggregateBatterSeason,
  aggregatePitcherSeason,
  buildBreakdowns,
  favoriteScore,
  getMatchResultKind,
  summarizeAttendance,
  todayKstIso,
} from '../lib/stats'
import { getKoreanDayMark } from '../lib/koreanHolidays'

export default function FanPage({ userId, favoriteTeam }) {
  const [games, setGames] = useState([])
  const [attended, setAttended] = useState([])
  const [groups, setGroups] = useState([])
  const [activeGroup, setActiveGroup] = useState(null)
  const [who, setWho] = useState([])
  const [stats, setStats] = useState([])
  const [month, setMonth] = useState(todayKstIso().slice(0, 7))
  const [pickedGame, setPickedGame] = useState(null)

  const reload = async () => {
    const [all, att, gs] = await Promise.all([
      fetchAllGames(),
      fetchMyAttendance(userId),
      listMyGroups(userId),
    ])
    setGames(all)
    setAttended(att)
    setGroups(gs)
    if (!activeGroup && gs[0]) setActiveGroup(gs[0].id)
    const ids = att.map((a) => a.gameId || a.game?.id).filter(Boolean)
    if (ids.length) setStats(await fetchPlayerStats(ids))
    else setStats([])
  }

  useEffect(() => {
    reload().catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, favoriteTeam])

  const teamGames = games.filter(
    (g) => g.home_team_code === favoriteTeam || g.away_team_code === favoriteTeam,
  )
  const attendedSet = new Set(attended.map((a) => a.gameId || a.game?.id))
  const records = attended
    .map((a) => ({ game: a.game, attendedAt: a.game?.game_date }))
    .filter((r) => r.game)
  const summary = summarizeAttendance(records, favoriteTeam)
  const breakdowns = buildBreakdowns(records, favoriteTeam)
  const attStats = stats.filter((s) => s.team_code === favoriteTeam)
  const batters = aggregateBatterSeason(attStats).sort((a, b) => b.avg - a.avg).slice(0, 5)
  const pitchers = aggregatePitcherSeason(attStats).sort((a, b) => (a.era ?? 99) - (b.era ?? 99)).slice(0, 5)

  const first = new Date(`${month}-01T12:00:00`)
  const startPad = first.getDay()
  const daysInMonth = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate()
  const cells = [
    ...Array.from({ length: startPad }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => `${month}-${String(i + 1).padStart(2, '0')}`),
  ]

  const flavor =
    summary.total === 0
      ? '아직 직관 기록이 없습니다. 달력에서 다녀온 경기를 눌러 표시하세요.'
      : summary.winRate >= 60
        ? '직관만 가면 잘 풀리는 편입니다.'
        : summary.winRate >= 45
          ? '평범한 직관 승률입니다. 다음 경기가 중요합니다.'
          : '직관 승률이 아쉽습니다. 그래도 현장은 남습니다.'

  const onPick = async (game) => {
    if (!game) return
    await toggleAttendance(userId, game)
    await reload()
    setPickedGame(game)
    if (activeGroup) {
      const names = await fetchGroupAttendanceForGame(activeGroup, game.id)
      setWho(names)
    }
  }

  const shiftMonth = (delta) => {
    const [y, m] = month.split('-').map(Number)
    const d = new Date(y, m - 1 + delta, 1)
    setMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
  }

  const monthGames = useMemo(
    () => teamGames.filter((g) => String(g.game_date).startsWith(month)),
    [teamGames, month],
  )

  return (
    <div>
      <section className="hero-card">
        <p className="hero-kicker">나의 직관 승률</p>
        <h2 className="hero-title">{summary.winRate}%</h2>
        <p className="hero-sub">{summary.wins}승 {summary.losses}패 {summary.draws}무 · {summary.total}경기</p>
        <p className="muted" style={{ marginTop: 10 }}>{flavor}</p>
      </section>

      <section className="card">
        <h2>그룹 보기</h2>
        {groups.length === 0 ? <p className="muted">그룹 탭에서 모임을 만들거나 초대코드로 들어가세요.</p> : null}
        <div className="row" style={{ flexWrap: 'wrap' }}>
          {groups.map((g) => (
            <button
              key={g.id}
              type="button"
              className={`group-chip ${activeGroup === g.id ? 'active' : ''}`}
              onClick={() => setActiveGroup(g.id)}
            >
              {g.name}
            </button>
          ))}
        </div>
      </section>

      <section className="card">
        <div className="row space">
          <h2 style={{ margin: 0 }}>{month} 직관 달력</h2>
          <div className="row">
            <button type="button" className="btn ghost compact" onClick={() => shiftMonth(-1)}>이전</button>
            <button type="button" className="btn ghost compact" onClick={() => shiftMonth(1)}>다음</button>
          </div>
        </div>
        <div className="calendar" style={{ marginTop: 12 }}>
          {['일', '월', '화', '수', '목', '금', '토'].map((d) => (
            <div key={d} className="cal-dow">{d}</div>
          ))}
          {cells.map((iso, i) => {
            if (!iso) return <div key={`e${i}`} className="cal-cell empty" />
            const g = monthGames.find((x) => x.game_date === iso)
            const holiday = getKoreanDayMark(iso)
            const kind = getMatchResultKind(g, favoriteTeam)
            return (
              <button
                key={iso}
                type="button"
                className={`cal-cell ${attendedSet.has(g?.id) ? 'mine' : ''}`}
                onClick={() => onPick(g)}
                disabled={!g}
              >
                <div style={{ color: holiday ? 'var(--loss)' : undefined }}>{Number(iso.slice(8))}</div>
                {g ? <TeamBadge team={getTeam(favoriteScore(g, favoriteTeam).opponentCode)} /> : null}
                {g ? <span className={`pill ${kind}`}>{kind === 'win' ? '승' : kind === 'loss' ? '패' : kind === 'draw' ? '무' : '전'}</span> : null}
              </button>
            )
          })}
        </div>
        {pickedGame && activeGroup ? (
          <p className="muted" style={{ marginTop: 12 }}>
            이 경기 그룹 직관: {who.map((w) => w.display_name).join(', ') || '아직 없음'}
          </p>
        ) : null}
      </section>

      <section className="card">
        <h2>구장 / 홈원정 / 요일 / 상대</h2>
        {[
          ['구장', breakdowns.stadiums],
          ['홈·원정', breakdowns.homeAway],
          ['요일', breakdowns.weekday],
          ['상대', breakdowns.opponent],
        ].map(([title, rows]) => (
          <div key={title} style={{ marginBottom: 12 }}>
            <div className="muted">{title}</div>
            <table className="table">
              <tbody>
                {rows.filter((r) => r.total > 0).map((r) => (
                  <tr key={r.label}>
                    <td>{r.label}</td>
                    <td>{r.wins}승 {r.losses}패</td>
                    <td>{r.winRate}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}
      </section>

      <section className="card">
        <h2>내가 본 경기 타자 TOP5</h2>
        {batters.map((b) => (
          <div key={b.playerName} className="list-row">
            <span className="list-row-title">{b.playerName}</span>
            <span className="list-row-trail">{b.avg.toFixed(3)} · {b.hits}안타 {b.homeRuns}홈런 {b.games}G</span>
          </div>
        ))}
        {!batters.length ? <p className="muted">직관 경기 박스스코어가 쌓이면 표시됩니다.</p> : null}
      </section>

      <section className="card">
        <h2>내가 본 경기 투수 TOP5 (ERA)</h2>
        {pitchers.map((p) => (
          <div key={p.playerName} className="list-row">
            <span className="list-row-title">{p.playerName}</span>
            <span className="list-row-trail">ERA {p.era ?? '-'} · {p.wins}승 {p.innings}이닝</span>
          </div>
        ))}
      </section>
    </div>
  )
}
