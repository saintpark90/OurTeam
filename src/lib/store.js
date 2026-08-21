import { supabase, readLocalSession } from './supabase'
import { getTeam } from './teams'
import { todayKstIso } from './stats'

const STORE_KEY = 'ourteam-local-db'

function uid() {
  return crypto.randomUUID ? crypto.randomUUID() : `id-${Date.now()}-${Math.random()}`
}

function seedGames() {
  const today = todayKstIso()
  const d = new Date(`${today}T12:00:00+09:00`)
  const iso = (offset) => {
    const x = new Date(d)
    x.setDate(x.getDate() + offset)
    return x.toISOString().slice(0, 10)
  }
  const pairs = [
    ['HH', 'LG', iso(-3), 4, 2, '대전'],
    ['HT', 'SS', iso(-3), 3, 5, '광주'],
    ['OB', 'LT', iso(-2), 1, 1, '잠실'],
    ['SK', 'KT', iso(-2), 7, 3, '문학'],
    ['WO', 'NC', iso(-1), 2, 6, '고척'],
    ['HH', 'HT', iso(-1), 5, 4, '대전'],
    ['LG', 'SS', iso(0), null, null, '잠실'],
    ['HH', 'OB', iso(1), null, null, '잠실'],
    ['LT', 'KT', iso(1), null, null, '사직'],
    ['NC', 'SK', iso(2), null, null, '창원'],
  ]
  return pairs.map(([away, home, date, as, hs, stadium], i) => {
    const decided = typeof as === 'number'
    let winner = null
    if (decided) {
      if (as > hs) winner = away
      else if (hs > as) winner = home
    }
    const id = uid()
    const gameId = `${date.replaceAll('-', '')}${away}${home}0`
    return {
      id,
      game_id: gameId,
      season: 2026,
      game_date: date,
      game_time: '18:30',
      stadium,
      away_team_code: away,
      home_team_code: home,
      away_score: as,
      home_score: hs,
      winner_team_code: winner,
      game_status: decided ? '종료' : '예정',
      away_starter_name: decided ? `${getTeam(away)?.nameKo} 선발` : 'TBD',
      home_starter_name: decided ? `${getTeam(home)?.nameKo} 선발` : 'TBD',
      sort: i,
    }
  })
}

function seedStats(games) {
  const rows = []
  for (const g of games) {
    if (typeof g.away_score !== 'number') continue
    for (const side of [
      { code: g.away_team_code, starter: true },
      { code: g.home_team_code, starter: true },
    ]) {
      rows.push({
        id: uid(),
        game_uuid: g.id,
        player_name: `${getTeam(side.code)?.shortLabel} 투수`,
        team_code: side.code,
        role: 'pitcher',
        is_starter: true,
        innings_pitched_outs: 18,
        earned_runs: 2,
        hits_allowed: 5,
        walks_allowed: 2,
        strikeouts: 6,
        wins: g.winner_team_code === side.code ? 1 : 0,
        losses: g.winner_team_code && g.winner_team_code !== side.code ? 1 : 0,
        saves: 0,
        holds: 0,
      })
      rows.push({
        id: uid(),
        game_uuid: g.id,
        player_name: `${getTeam(side.code)?.shortLabel} 타자`,
        team_code: side.code,
        role: 'batter',
        is_starter: false,
        at_bats: 4,
        hits: 2,
        doubles: 1,
        triples: 0,
        home_runs: 0,
        rbi: 1,
        runs: 1,
        walks: 0,
        strikeouts: 1,
        stolen_bases: 0,
      })
    }
  }
  return rows
}

function emptyLocal() {
  const games = seedGames()
  return {
    games,
    stats: seedStats(games),
    moves: [
      {
        id: uid(),
        move_date: todayKstIso(),
        team_code: 'HH',
        player_name: '예시선수',
        back_number: 0,
        position: '투수',
        move_type: 'register',
      },
    ],
    groups: [],
    members: [],
    attendance: [],
    profiles: {},
  }
}

function loadLocal() {
  try {
    const raw = localStorage.getItem(STORE_KEY)
    if (raw) return JSON.parse(raw)
  } catch {
    /* ignore */
  }
  const seeded = emptyLocal()
  saveLocal(seeded)
  return seeded
}

function saveLocal(db) {
  localStorage.setItem(STORE_KEY, JSON.stringify(db))
}

function useRemote() {
  if (readLocalSession()?.user?.id === 'local-user') return false
  return Boolean(supabase)
}

export async function fetchAllGames() {
  if (useRemote()) {
    const { data, error } = await supabase.from('games').select('*').order('game_date', { ascending: true })
    if (error) throw error
    return data || []
  }
  return loadLocal().games
}

export async function fetchPlayerStats(gameUuids) {
  if (!gameUuids?.length) return []
  if (useRemote()) {
    const { data, error } = await supabase.from('game_player_stats').select('*').in('game_uuid', gameUuids)
    if (error) throw error
    return data || []
  }
  const db = loadLocal()
  const set = new Set(gameUuids)
  return db.stats.filter((s) => set.has(s.game_uuid))
}

export async function fetchRosterMoves(teamCode) {
  if (useRemote()) {
    const { data, error } = await supabase
      .from('roster_moves')
      .select('*')
      .eq('team_code', teamCode)
      .order('move_date', { ascending: false })
      .limit(40)
    if (error) throw error
    return data || []
  }
  return loadLocal().moves.filter((m) => m.team_code === teamCode)
}

export async function loadProfile(userId) {
  if (useRemote()) {
    const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle()
    if (error) throw error
    return data
  }
  return loadLocal().profiles[userId] || null
}

export async function saveFavoriteTeam(userId, teamCode, displayName, email, avatarUrl) {
  if (useRemote()) {
    const { error } = await supabase.from('profiles').upsert({
      id: userId,
      favorite_team_code: teamCode,
      display_name: displayName,
      email,
      avatar_url: avatarUrl,
      updated_at: new Date().toISOString(),
    })
    if (error) throw error
    return
  }
  const db = loadLocal()
  db.profiles[userId] = {
    id: userId,
    favorite_team_code: teamCode,
    display_name: displayName,
    email,
    avatar_url: avatarUrl,
  }
  saveLocal(db)
}

export async function fetchMyAttendance(userId) {
  if (useRemote()) {
    const { data, error } = await supabase
      .from('user_attendance')
      .select('id, game_id, games(*)')
      .eq('user_id', userId)
    if (error) throw error
    return (data || []).map((row) => ({ id: row.id, gameId: row.game_id, game: row.games }))
  }
  const db = loadLocal()
  return db.attendance
    .filter((a) => a.user_id === userId)
    .map((a) => ({
      id: a.id,
      gameId: a.game_id,
      game: db.games.find((g) => g.id === a.game_id),
    }))
}

export async function toggleAttendance(userId, game) {
  if (useRemote()) {
    const { data: existing } = await supabase
      .from('user_attendance')
      .select('id')
      .eq('user_id', userId)
      .eq('game_id', game.id)
      .maybeSingle()
    if (existing?.id) {
      await supabase.from('user_attendance').delete().eq('id', existing.id)
      return false
    }
    await supabase.from('user_attendance').insert({ user_id: userId, game_id: game.id })
    return true
  }
  const db = loadLocal()
  const idx = db.attendance.findIndex((a) => a.user_id === userId && a.game_id === game.id)
  if (idx >= 0) {
    db.attendance.splice(idx, 1)
    saveLocal(db)
    return false
  }
  db.attendance.push({ id: uid(), user_id: userId, game_id: game.id })
  saveLocal(db)
  return true
}

export async function listMyGroups(userId) {
  if (useRemote()) {
    const { data, error } = await supabase.rpc('list_my_groups')
    if (error) throw error
    return data || []
  }
  const db = loadLocal()
  const ids = db.members.filter((m) => m.user_id === userId).map((m) => m.group_id)
  return db.groups.filter((g) => ids.includes(g.id))
}

export async function createGroup(userId, name) {
  const invite = Math.random().toString(36).slice(2, 8).toUpperCase()
  if (useRemote()) {
    const { data, error } = await supabase.rpc('create_club_group', { p_name: name })
    if (error) throw error
    return data
  }
  const db = loadLocal()
  const group = { id: uid(), name, invite_code: invite, created_by: userId }
  db.groups.push(group)
  db.members.push({ group_id: group.id, user_id: userId, role: 'owner' })
  saveLocal(db)
  return group
}

export async function joinGroup(userId, inviteCode) {
  if (useRemote()) {
    const { data, error } = await supabase.rpc('join_club_group', { p_invite_code: inviteCode.trim() })
    if (error) throw error
    return data
  }
  const db = loadLocal()
  const group = db.groups.find((g) => g.invite_code.toUpperCase() === inviteCode.trim().toUpperCase())
  if (!group) throw new Error('초대코드가 올바르지 않습니다.')
  if (!db.members.some((m) => m.group_id === group.id && m.user_id === userId)) {
    db.members.push({ group_id: group.id, user_id: userId, role: 'member' })
    saveLocal(db)
  }
  return group
}

export async function leaveGroup(userId, groupId) {
  if (useRemote()) {
    const { error } = await supabase.rpc('leave_club_group', { p_group_id: groupId })
    if (error) throw error
    return
  }
  const db = loadLocal()
  db.members = db.members.filter((m) => !(m.group_id === groupId && m.user_id === userId))
  saveLocal(db)
}

export async function fetchGroupMembers(groupId) {
  if (useRemote()) {
    const { data, error } = await supabase.rpc('list_group_members', { p_group_id: groupId })
    if (error) throw error
    return data || []
  }
  const db = loadLocal()
  return db.members
    .filter((m) => m.group_id === groupId)
    .map((m) => ({
      user_id: m.user_id,
      role: m.role,
      display_name: db.profiles[m.user_id]?.display_name || '회원',
    }))
}

export async function fetchGroupLeaderboard(groupId) {
  if (useRemote()) {
    const { data, error } = await supabase.rpc('get_group_leaderboard', { p_group_id: groupId })
    if (error) throw error
    return data || []
  }
  const db = loadLocal()
  const memberIds = db.members.filter((m) => m.group_id === groupId).map((m) => m.user_id)
  return memberIds.map((uid_) => {
    const rows = db.attendance.filter((a) => a.user_id === uid_)
    let wins = 0
    let losses = 0
    let draws = 0
    for (const a of rows) {
      const g = db.games.find((x) => x.id === a.game_id)
      if (!g || typeof g.away_score !== 'number') continue
      const fav = db.profiles[uid_]?.favorite_team_code
      if (!fav) continue
      if (g.away_score === g.home_score) draws += 1
      else if (g.winner_team_code === fav) wins += 1
      else if (g.home_team_code === fav || g.away_team_code === fav) losses += 1
    }
    const total = wins + losses + draws
    return {
      user_id: uid_,
      display_name: db.profiles[uid_]?.display_name || '회원',
      wins,
      losses,
      draws,
      games: total,
      win_rate: total ? Number(((wins / total) * 100).toFixed(1)) : 0,
    }
  })
}

export async function fetchGroupAttendanceForGame(groupId, gameId) {
  if (useRemote()) {
    const { data, error } = await supabase.rpc('list_group_attendance_for_game', {
      p_group_id: groupId,
      p_game_id: gameId,
    })
    if (error) throw error
    return data || []
  }
  const db = loadLocal()
  const memberIds = new Set(db.members.filter((m) => m.group_id === groupId).map((m) => m.user_id))
  return db.attendance
    .filter((a) => a.game_id === gameId && memberIds.has(a.user_id))
    .map((a) => ({
      user_id: a.user_id,
      display_name: db.profiles[a.user_id]?.display_name || '회원',
    }))
}
