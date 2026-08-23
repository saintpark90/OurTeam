import { useEffect, useMemo, useState } from 'react'
import TeamBadge from '../components/TeamBadge'
import { TEAMS, getTeam } from '../lib/teams'
import { fetchAllGames, fetchPlayerStats, fetchRosterMoves } from '../lib/store'
import {
  aggregatePitcherSeason,
  computeStandings,
  favoriteScore,
  isMatchDecided,
  playoffOutlook,
  teamSeasonRecord,
  todayKstIso,
} from '../lib/stats'
import { fetchStadiumWeather } from '../lib/weather'
import { getKoreanDayMark } from '../lib/koreanHolidays'

function ResultPill({ game, teamCode }) {
  if (!isMatchDecided(game)) return <span className="pill pending">예정</span>
  const { mine, opp } = favoriteScore(game, teamCode)
  if (mine === opp) return <span className="pill draw">무</span>
  if (game.winner_team_code === teamCode) return <span className="pill win">승</span>
  return <span className="pill loss">패</span>
}

function formatKoDate(iso) {
  if (!iso) return ''
  const [, m, d] = iso.split('-')
  return `${Number(m)}월 ${Number(d)}일`
}

function scrollToId(id) {
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

export default function GamesPage({ favoriteTeam, team }) {
  const [games, setGames] = useState([])
  const [stats, setStats] = useState([])
  const [moves, setMoves] = useState([])
  const [weather, setWeather] = useState(null)
  const [error, setError] = useState('')
  const today = todayKstIso()

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const all = await fetchAllGames()
        if (cancelled) return
        setGames(all)
        const teamGames = all.filter(
          (g) => g.home_team_code === favoriteTeam || g.away_team_code === favoriteTeam,
        )
        const ids = teamGames.map((g) => g.id)
        const [st, mv] = await Promise.all([fetchPlayerStats(ids), fetchRosterMoves(favoriteTeam)])
        if (cancelled) return
        setStats(st)
        setMoves(mv)
      } catch (e) {
        if (!cancelled) setError(e.message || '경기를 불러오지 못했습니다.')
      }
    })()
    return () => {
      cancelled = true
    }
  }, [favoriteTeam])

  const teamGames = useMemo(
    () =>
      games
        .filter((g) => g.home_team_code === favoriteTeam || g.away_team_code === favoriteTeam)
        .sort((a, b) => `${a.game_date}${a.game_time}`.localeCompare(`${b.game_date}${b.game_time}`)),
    [games, favoriteTeam],
  )

  const nextGame = teamGames.find((g) => g.game_date >= today && !isMatchDecided(g)) || teamGames.find((g) => g.game_date >= today)
  const lastGame = [...teamGames].reverse().find((g) => g.game_date <= today && isMatchDecided(g))

  useEffect(() => {
    if (!nextGame?.stadium) return
    fetchStadiumWeather(nextGame.stadium).then(setWeather).catch(() => setWeather(null))
  }, [nextGame?.stadium])

  const standings = useMemo(() => computeStandings(games), [games])
  const outlook = playoffOutlook(standings, favoriteTeam)
  const myRec = teamSeasonRecord(games, favoriteTeam)
  const oppCode = nextGame ? favoriteScore(nextGame, favoriteTeam).opponentCode : null
  const oppRec = oppCode ? teamSeasonRecord(games, oppCode) : null
  const pitchers = useMemo(() => aggregatePitcherSeason(stats), [stats])

  const starterFor = (name, teamCode) =>
    pitchers.find((p) => p.playerName === name && p.teamCode === teamCode) ||
    pitchers.find((p) => p.playerName === name)

  const awayStarter = nextGame
    ? starterFor(nextGame.away_starter_name, nextGame.away_team_code)
    : null
  const homeStarter = nextGame
    ? starterFor(nextGame.home_starter_name, nextGame.home_team_code)
    : null

  const month = today.slice(0, 7)
  const monthGames = teamGames.filter((g) => String(g.game_date).startsWith(month))
  const leagueToday = games.filter((g) => g.game_date === today)
  const leagueYday = games.filter((g) => g.game_date < today && isMatchDecided(g)).slice(-10)

  const lastLineup = stats.filter((s) => s.game_uuid === lastGame?.id && s.team_code === favoriteTeam)
  const latestMoveDate = moves[0]?.move_date
  const registered = moves.filter((m) => m.move_date === latestMoveDate && m.move_type === 'register')
  const dropped = moves.filter((m) => m.move_date === latestMoveDate && m.move_type === 'deregister')
  const channel = TEAMS.find((t) => t.code === favoriteTeam)?.channelUrl

  const first = new Date(`${month}-01T12:00:00`)
  const startPad = first.getDay()
  const daysInMonth = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate()
  const cells = [
    ...Array.from({ length: startPad }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => `${month}-${String(i + 1).padStart(2, '0')}`),
  ]

  return (
    <div>
      {error ? <p className="error">{error}</p> : null}

      <section className="hero-card">
        <p className="hero-kicker">{team?.nameKo || '우리 팀'} · 다음 경기</p>
        {nextGame ? (
          <>
            <h2 className="hero-title">{formatKoDate(nextGame.game_date)}</h2>
            <p className="hero-sub">
              {nextGame.game_time || ''} · {nextGame.stadium || '구장 미정'}
            </p>
            <div className="matchup">
              <div className="matchup-side">
                <TeamBadge team={getTeam(nextGame.away_team_code)} size="lg" />
                <span>{getTeam(nextGame.away_team_code)?.nameKo}</span>
              </div>
              <div className="matchup-vs">VS</div>
              <div className="matchup-side">
                <TeamBadge team={getTeam(nextGame.home_team_code)} size="lg" />
                <span>{getTeam(nextGame.home_team_code)?.nameKo}</span>
              </div>
            </div>
          </>
        ) : (
          <>
            <h2 className="hero-title">일정 없음</h2>
            <p className="hero-sub">예정된 경기가 없습니다.</p>
          </>
        )}
      </section>

      <nav className="quick-actions" aria-label="바로가기">
        <button type="button" className="quick-action" onClick={() => scrollToId('today')}>
          <span className="quick-action-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden>
              <rect x="4" y="5" width="16" height="15" rx="3" />
              <path d="M8 3v4M16 3v4M4 10h16" />
            </svg>
          </span>
          오늘
        </button>
        <button type="button" className="quick-action" onClick={() => scrollToId('standings')}>
          <span className="quick-action-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden>
              <path d="M5 19V9M12 19V5M19 19v-7" />
            </svg>
          </span>
          순위
        </button>
        <button type="button" className="quick-action" onClick={() => scrollToId('calendar')}>
          <span className="quick-action-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden>
              <rect x="4" y="6" width="16" height="14" rx="2" />
              <path d="M8 4v4M16 4v4M9 14h6" />
            </svg>
          </span>
          달력
        </button>
        <button type="button" className="quick-action" onClick={() => scrollToId('video')}>
          <span className="quick-action-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden>
              <rect x="3" y="6" width="18" height="12" rx="2" />
              <path d="M10 9.5v5l5-2.5-5-2.5Z" />
            </svg>
          </span>
          영상
        </button>
      </nav>

      <p className="caption">성적은 전날 새벽 배치로 적재된 자체 DB 기준입니다. 실시간 중계는 없습니다.</p>

      <section className="card">
        <h2>선발 투수 (DB 합산)</h2>
        <div className="grid-2">
          {[
            { side: '원정', game: nextGame, name: nextGame?.away_starter_name, team: nextGame?.away_team_code, agg: awayStarter },
            { side: '홈', game: nextGame, name: nextGame?.home_starter_name, team: nextGame?.home_team_code, agg: homeStarter },
          ].map((card) => (
            <div key={card.side} className="weather-chip" style={{ minWidth: 0, textAlign: 'left' }}>
              <div className="muted">{card.side} · {getTeam(card.team)?.nameKo}</div>
              <strong>{card.name && card.name !== 'TBD' ? card.name : '미정'}</strong>
              {card.agg ? (
                <div className="muted">
                  {card.agg.wins}승 {card.agg.losses}패 · ERA {card.agg.era ?? '-'} · {card.agg.innings}이닝 · WHIP {card.agg.whip ?? '-'}
                </div>
              ) : (
                <div className="muted">누적 성적 없음</div>
              )}
            </div>
          ))}
        </div>
      </section>

      <section className="card">
        <h2>날씨 · {weather?.region || nextGame?.stadium || '-'}</h2>
        {weather?.warning ? <p className="error">우천·강풍 가능성이 있습니다. 경기 운영은 구장 안내를 따르세요.</p> : null}
        <div className="weather-bar">
          {(weather?.hours || []).map((h) => (
            <div key={h.time} className="weather-chip">
              <div>{h.hour}시</div>
              <div>{h.temp}°</div>
              <div className="muted">비 {h.rain}%</div>
            </div>
          ))}
          {!weather ? <span className="muted">예보를 불러오는 중이거나 구장 좌표가 없습니다.</span> : null}
        </div>
      </section>

      <section className="card">
        <h2>팀 전력 비교</h2>
        <table className="table">
          <thead>
            <tr>
              <th />
              <th>{getTeam(favoriteTeam)?.nameKo}</th>
              <th>{getTeam(oppCode)?.nameKo || '-'}</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>시즌</td>
              <td>{myRec.wins}승 {myRec.losses}패 {myRec.draws}무</td>
              <td>{oppRec ? `${oppRec.wins}승 ${oppRec.losses}패 ${oppRec.draws}무` : '-'}</td>
            </tr>
            <tr>
              <td>최근5</td>
              <td>{myRec.last5.join(' ') || '-'}</td>
              <td>{oppRec?.last5.join(' ') || '-'}</td>
            </tr>
            <tr>
              <td>득실</td>
              <td>{myRec.runsScored} / {myRec.runsAllowed}</td>
              <td>{oppRec ? `${oppRec.runsScored} / ${oppRec.runsAllowed}` : '-'}</td>
            </tr>
          </tbody>
        </table>
      </section>

      <section className="card" id="today">
        <h2>오늘 리그 일정</h2>
        {leagueToday.length === 0 ? <p className="muted">오늘 저장된 경기가 없습니다.</p> : null}
        {leagueToday.map((g) => (
          <div key={g.id} className="list-row">
            <div className="list-row-main">
              <TeamBadge team={getTeam(g.away_team_code)} />
              <div className="list-row-text">
                <div className="list-row-title">
                  {getTeam(g.away_team_code)?.nameKo} vs {getTeam(g.home_team_code)?.nameKo}
                </div>
                <div className="list-row-meta">{g.stadium || '구장 미정'}</div>
              </div>
            </div>
            <span className="list-row-trail">{g.game_time || ''}</span>
          </div>
        ))}
      </section>

      <section className="card">
        <h2>최근 종료 경기</h2>
        {leagueYday.slice(-8).reverse().map((g) => (
          <div key={g.id} className="list-row">
            <div className="list-row-main">
              <TeamBadge team={getTeam(g.home_team_code)} />
              <div className="list-row-text">
                <div className="list-row-title">
                  {getTeam(g.away_team_code)?.nameKo} {g.away_score} - {g.home_score} {getTeam(g.home_team_code)?.nameKo}
                </div>
                <div className="list-row-meta">{formatKoDate(g.game_date)}</div>
              </div>
            </div>
          </div>
        ))}
      </section>

      <section className="card">
        <h2>직전 경기 라인업 (텍스트)</h2>
        {lastGame ? <p className="muted">{lastGame.game_date} 박스스코어</p> : <p className="muted">종료 경기가 없습니다.</p>}
        {lastLineup.map((row) => (
          <div key={row.id} className="list-row">
            <span className="list-row-title">{row.player_name}</span>
            <span className="list-row-trail">
              {row.role === 'pitcher'
                ? `투 ${row.innings_pitched_outs ? (row.innings_pitched_outs / 3).toFixed(1) : '-'}이닝 ER ${row.earned_runs ?? '-'}`
                : `타 ${row.hits ?? 0}/${row.at_bats ?? 0} 타점 ${row.rbi ?? 0}`}
            </span>
          </div>
        ))}
      </section>

      <section className="card">
        <h2>등/말소 {latestMoveDate || ''}</h2>
        <p className="muted">등록</p>
        {registered.map((m) => (
          <div key={m.id} className="list-row">
            <span className="list-row-title">{m.back_number ?? '-'} {m.player_name}</span>
            <span className="list-row-trail">{m.position || ''}</span>
          </div>
        ))}
        <p className="muted">말소</p>
        {dropped.map((m) => (
          <div key={m.id} className="list-row">
            <span className="list-row-title">{m.back_number ?? '-'} {m.player_name}</span>
            <span className="list-row-trail">{m.position || ''}</span>
          </div>
        ))}
        {!registered.length && !dropped.length ? <p className="muted">최근 등말소가 없습니다.</p> : null}
      </section>

      <section className="card">
        <h2>가을야구 전망</h2>
        {outlook ? (
          <>
            <div className="stat-hero">
              <div className="muted">{outlook.kind === 'magic' ? '매직넘버' : '트래직'} · {outlook.rank}위</div>
              <div className="big">{outlook.number}</div>
            </div>
            <p className="muted">{outlook.text}</p>
          </>
        ) : (
          <p className="muted">시즌 데이터가 더 필요합니다.</p>
        )}
      </section>

      <section className="card" id="calendar">
        <h2>{month} 일정</h2>
        <div className="calendar">
          {['일', '월', '화', '수', '목', '금', '토'].map((d) => (
            <div key={d} className="cal-dow">{d}</div>
          ))}
          {cells.map((iso, i) => {
            if (!iso) return <div key={`e${i}`} className="cal-cell empty" />
            const g = monthGames.find((x) => x.game_date === iso)
            const holiday = getKoreanDayMark(iso)
            return (
              <div key={iso} className="cal-cell">
                <div style={{ color: holiday ? 'var(--loss)' : undefined }}>{Number(iso.slice(8))}</div>
                {g ? (
                  <TeamBadge team={getTeam(favoriteScore(g, favoriteTeam).opponentCode)} />
                ) : null}
                {g ? <ResultPill game={g} teamCode={favoriteTeam} /> : null}
              </div>
            )
          })}
        </div>
      </section>

      <section className="card" id="standings">
        <h2>순위</h2>
        {standings.map((row) => (
          <div key={row.code} className="list-row" style={{ fontWeight: row.code === favoriteTeam ? 800 : 400 }}>
            <div className="list-row-main">
              <TeamBadge team={getTeam(row.code)} />
              <div className="list-row-text">
                <div className="list-row-title">{row.rank} · {getTeam(row.code)?.nameKo}</div>
                <div className="list-row-meta">{row.wins}승 {row.losses}패 {row.draws}무</div>
              </div>
            </div>
            <span className="list-row-trail">{row.winRate}</span>
          </div>
        ))}
      </section>

      <section className="card" id="video">
        <h2>구단 영상</h2>
        <p className="muted">공식 채널로 이동합니다. 하이라이트를 재게시하지 않습니다.</p>
        {channel ? (
          <a className="btn" href={channel} target="_blank" rel="noreferrer" style={{ width: '100%', marginTop: 12 }}>
            YouTube 채널 열기
          </a>
        ) : null}
      </section>
    </div>
  )
}
