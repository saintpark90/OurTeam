import { getKoreanDayMark, isKoreanPublicHolidayMark } from './koreanHolidays'
import { STADIUM_ORDER, getTeam } from './teams'

const pct = (wins, total) => {
  if (!total) return 0
  return Number(((wins / total) * 100).toFixed(1))
}

export const isMatchCancelled = (game) => {
  if (!game?.game_status) return false
  return /취소|노게임|무효|제외/.test(String(game.game_status))
}

export const isMatchDecided = (game) => {
  if (!game || isMatchCancelled(game)) return false
  if (game.winner_team_code) return true
  return typeof game.away_score === 'number' && typeof game.home_score === 'number'
}

export const isDraw = (game) => {
  if (!isMatchDecided(game)) return false
  if (typeof game.away_score === 'number' && typeof game.home_score === 'number') {
    return game.away_score === game.home_score
  }
  return false
}

export function favoriteScore(game, favoriteCode) {
  if (!game || !favoriteCode) return { mine: null, opp: null, opponentCode: null, homeAway: null }
  if (game.home_team_code === favoriteCode) {
    return {
      mine: game.home_score,
      opp: game.away_score,
      opponentCode: game.away_team_code,
      homeAway: 'HOME',
    }
  }
  if (game.away_team_code === favoriteCode) {
    return {
      mine: game.away_score,
      opp: game.home_score,
      opponentCode: game.home_team_code,
      homeAway: 'AWAY',
    }
  }
  return { mine: null, opp: null, opponentCode: null, homeAway: null }
}

export function isFavoriteWin(game, favoriteCode) {
  if (!isMatchDecided(game) || isDraw(game)) return false
  return game.winner_team_code === favoriteCode
}

export function isFavoriteLoss(game, favoriteCode) {
  return isMatchDecided(game) && !isFavoriteWin(game, favoriteCode) && !isDraw(game)
}

export function getMatchResultKind(game, favoriteCode) {
  if (!game) return 'none'
  if (isMatchCancelled(game)) return 'cancelled'
  if (!isMatchDecided(game)) return 'pending'
  if (isDraw(game)) return 'draw'
  if (isFavoriteWin(game, favoriteCode)) return 'win'
  if (game.home_team_code === favoriteCode || game.away_team_code === favoriteCode) return 'loss'
  return 'pending'
}

export function getMatchScoreLine(game, favoriteCode) {
  const { mine, opp } = favoriteScore(game, favoriteCode)
  if (typeof mine !== 'number' || typeof opp !== 'number') return null
  return `${mine}:${opp}`
}

const dayBucket = (dateString) => {
  if (!dateString) return '평일'
  const iso = String(dateString).slice(0, 10)
  const day = new Date(`${iso}T12:00:00`).getDay()
  const isWeekend = day === 0 || day === 6
  const isPublicHoliday = isKoreanPublicHolidayMark(getKoreanDayMark(iso))
  if (isWeekend || isPublicHoliday) return '주말(공휴일)'
  return '평일'
}

const sortRowsByWinRateDesc = (rows) =>
  [...rows].sort(
    (a, b) =>
      b.winRate - a.winRate ||
      b.total - a.total ||
      b.wins - a.wins ||
      String(a.label).localeCompare(String(b.label), 'ko'),
  )

export function summarizeAttendance(records, favoriteCode) {
  let wins = 0
  let losses = 0
  let draws = 0
  const decided = []
  for (const rec of records) {
    const game = rec.game || rec.match
    if (!game || !isMatchDecided(game)) continue
    decided.push({ game, attendedAt: rec.attendedAt || game.game_date })
    if (isDraw(game)) draws += 1
    else if (isFavoriteWin(game, favoriteCode)) wins += 1
    else if (isFavoriteLoss(game, favoriteCode)) losses += 1
  }
  const total = wins + losses + draws
  return { wins, losses, draws, total, winRate: pct(wins, total), decided }
}

function buildGroupRows(records, favoriteCode, keySelector) {
  const bucket = new Map()
  records.forEach((record) => {
    const game = record.game
    if (!game || !isMatchDecided(game)) return
    const key = keySelector(record)
    const current = bucket.get(key) ?? { label: key, total: 0, wins: 0, losses: 0, draws: 0 }
    current.total += 1
    if (isFavoriteWin(game, favoriteCode)) current.wins += 1
    else if (isFavoriteLoss(game, favoriteCode)) current.losses += 1
    else if (isDraw(game)) current.draws += 1
    bucket.set(key, current)
  })
  return sortRowsByWinRateDesc(
    [...bucket.values()].map((row) => ({ ...row, winRate: pct(row.wins, row.total) })),
  )
}

export function buildBreakdowns(records, favoriteCode) {
  const stadiumBucket = new Map()
  records.forEach((record) => {
    const game = record.game
    if (!game || !isMatchDecided(game)) return
    const key = game.stadium || '미상'
    const current = stadiumBucket.get(key) ?? { label: key, total: 0, wins: 0, losses: 0, draws: 0 }
    current.total += 1
    if (isFavoriteWin(game, favoriteCode)) current.wins += 1
    else if (isFavoriteLoss(game, favoriteCode)) current.losses += 1
    else if (isDraw(game)) current.draws += 1
    stadiumBucket.set(key, current)
  })
  const withRates = [...stadiumBucket.values()].map((row) => ({
    ...row,
    winRate: pct(row.wins, row.total),
  }))
  const dataMap = new Map(withRates.map((r) => [r.label, r]))
  const stadiums = STADIUM_ORDER.map((name) => {
    const existing = dataMap.get(name)
    if (existing) {
      dataMap.delete(name)
      return existing
    }
    return { label: name, total: 0, wins: 0, losses: 0, draws: 0, winRate: 0 }
  }).concat(sortRowsByWinRateDesc([...dataMap.values()]))

  return {
    stadiums,
    homeAway: buildGroupRows(records, favoriteCode, (r) => favoriteScore(r.game, favoriteCode).homeAway || '기타'),
    weekday: buildGroupRows(records, favoriteCode, (r) => dayBucket(r.game.game_date)),
    opponent: buildGroupRows(records, favoriteCode, (r) => {
      const code = favoriteScore(r.game, favoriteCode).opponentCode
      return getTeam(code)?.nameKo || code || '미상'
    }),
  }
}

export function aggregatePitcherSeason(statRows) {
  const map = new Map()
  for (const row of statRows) {
    if (row.role !== 'pitcher') continue
    const key = `${row.team_code}:${row.player_name}`
    const cur = map.get(key) ?? {
      playerName: row.player_name,
      teamCode: row.team_code,
      games: 0,
      starterGames: 0,
      wins: 0,
      losses: 0,
      saves: 0,
      holds: 0,
      outs: 0,
      earnedRuns: 0,
      hitsAllowed: 0,
      walksAllowed: 0,
      strikeouts: 0,
    }
    cur.games += 1
    if (row.is_starter) cur.starterGames += 1
    cur.wins += row.wins || 0
    cur.losses += row.losses || 0
    cur.saves += row.saves || 0
    cur.holds += row.holds || 0
    cur.outs += row.innings_pitched_outs || 0
    cur.earnedRuns += row.earned_runs || 0
    cur.hitsAllowed += row.hits_allowed || 0
    cur.walksAllowed += row.walks_allowed || 0
    cur.strikeouts += row.strikeouts || 0
    map.set(key, cur)
  }
  return [...map.values()].map((p) => {
    const innings = p.outs / 3
    const era = innings > 0 ? Number(((p.earnedRuns * 9) / innings).toFixed(2)) : null
    const whip = innings > 0 ? Number(((p.hitsAllowed + p.walksAllowed) / innings).toFixed(2)) : null
    return { ...p, innings: Number(innings.toFixed(1)), era, whip }
  })
}

export function aggregateBatterSeason(statRows) {
  const map = new Map()
  for (const row of statRows) {
    if (row.role !== 'batter') continue
    const key = `${row.team_code}:${row.player_name}`
    const cur = map.get(key) ?? {
      playerName: row.player_name,
      teamCode: row.team_code,
      games: 0,
      atBats: 0,
      hits: 0,
      doubles: 0,
      triples: 0,
      homeRuns: 0,
      rbi: 0,
      runs: 0,
      walks: 0,
      strikeouts: 0,
      stolenBases: 0,
    }
    cur.games += 1
    cur.atBats += row.at_bats || 0
    cur.hits += row.hits || 0
    cur.doubles += row.doubles || 0
    cur.triples += row.triples || 0
    cur.homeRuns += row.home_runs || 0
    cur.rbi += row.rbi || 0
    cur.runs += row.runs || 0
    cur.walks += row.walks || 0
    cur.strikeouts += row.strikeouts || 0
    cur.stolenBases += row.stolen_bases || 0
    map.set(key, cur)
  }
  return [...map.values()].map((b) => ({
    ...b,
    avg: b.atBats > 0 ? Number((b.hits / b.atBats).toFixed(3)) : 0,
  }))
}

export function teamSeasonRecord(games, teamCode) {
  let w = 0
  let l = 0
  let d = 0
  let rs = 0
  let ra = 0
  const last = []
  const decided = games
    .filter((g) => (g.home_team_code === teamCode || g.away_team_code === teamCode) && isMatchDecided(g))
    .sort((a, b) => String(a.game_date).localeCompare(String(b.game_date)))
  for (const g of decided) {
    const { mine, opp } = favoriteScore(g, teamCode)
    if (typeof mine === 'number') rs += mine
    if (typeof opp === 'number') ra += opp
    if (isDraw(g)) {
      d += 1
      last.push('D')
    } else if (isFavoriteWin(g, teamCode)) {
      w += 1
      last.push('W')
    } else {
      l += 1
      last.push('L')
    }
  }
  const total = w + l + d
  return {
    wins: w,
    losses: l,
    draws: d,
    total,
    winRate: pct(w, Math.max(w + l, 1)),
    runsScored: rs,
    runsAllowed: ra,
    last5: last.slice(-5).reverse(),
  }
}

export function computeStandings(games) {
  const codes = ['HH', 'HT', 'SS', 'LG', 'OB', 'LT', 'SK', 'WO', 'KT', 'NC']
  const rows = codes.map((code) => {
    const rec = teamSeasonRecord(games, code)
    return { code, ...rec }
  })
  rows.sort((a, b) => b.winRate - a.winRate || b.wins - a.wins || a.losses - b.losses)
  return rows.map((row, i) => ({ ...row, rank: i + 1 }))
}

/** 5위 포스트시즌 컷 기준 응원팀 매직/트래직 넘버 */
export function playoffOutlook(standings, favoriteCode, remainingGames) {
  const mine = standings.find((s) => s.code === favoriteCode)
  if (!mine) return null
  const fifth = standings[4]
  const sixth = standings[5]
  if (!fifth || !sixth) return null
  const remaining = remainingGames ?? Math.max(0, 144 - (mine.wins + mine.losses + mine.draws))
  if (mine.rank <= 5) {
    const magic = Math.max(0, (sixth.wins + remaining) - mine.wins + 1)
    return {
      kind: 'magic',
      rank: mine.rank,
      number: magic,
      text: `${getTeam(favoriteCode)?.nameKo}가 ${magic}경기만 더 이기거나, 6위가 그만큼 지면 가을야구가 확정되는 계산입니다. (자체 DB 승패 기준)`,
    }
  }
  const tragic = Math.max(0, (fifth.wins + remaining) - mine.wins + 1)
  return {
    kind: 'tragic',
    rank: mine.rank,
    number: tragic,
    text: `현재 ${mine.rank}위. 5위와의 격차를 줄이려면 앞으로 ${tragic}승 이상이 필요한 자체 계산입니다.`,
  }
}

export function todayKstIso() {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Seoul' })
}
