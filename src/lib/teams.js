/** 자체 약칭 뱃지용 팔레트. 공식 엠블럼·마스코트 이미지는 사용하지 않습니다. */
export const TEAMS = [
  { code: 'HH', shortLabel: 'HH', nameKo: '한화', color: '#ea580c', channelUrl: 'https://www.youtube.com/@HanwhaEagles_official' },
  { code: 'HT', shortLabel: 'KIA', nameKo: 'KIA', color: '#dc2626', channelUrl: 'https://www.youtube.com/@KIATigers' },
  { code: 'SS', shortLabel: 'SS', nameKo: '삼성', color: '#1d4ed8', channelUrl: 'https://www.youtube.com/@samsunglions' },
  { code: 'LG', shortLabel: 'LG', nameKo: 'LG', color: '#9f1239', channelUrl: 'https://www.youtube.com/@LGTwins' },
  { code: 'OB', shortLabel: 'OB', nameKo: '두산', color: '#1e3a5f', channelUrl: 'https://www.youtube.com/@doosanbears' },
  { code: 'LT', shortLabel: 'LT', nameKo: '롯데', color: '#be123c', channelUrl: 'https://www.youtube.com/@lottegiants' },
  { code: 'SK', shortLabel: 'SSG', nameKo: 'SSG', color: '#e11d48', channelUrl: 'https://www.youtube.com/@ssglanders' },
  { code: 'WO', shortLabel: 'WO', nameKo: '키움', color: '#a21caf', channelUrl: 'https://www.youtube.com/@kiwoomheroes' },
  { code: 'KT', shortLabel: 'KT', nameKo: 'KT', color: '#111827', channelUrl: 'https://www.youtube.com/@ktwiztv' },
  { code: 'NC', shortLabel: 'NC', nameKo: 'NC', color: '#ca8a04', channelUrl: 'https://www.youtube.com/@ncdinos' },
]

export const TEAM_BY_CODE = Object.fromEntries(TEAMS.map((t) => [t.code, t]))

export const TEAM_BY_NAME = Object.fromEntries(TEAMS.map((t) => [t.nameKo, t]))

export const STADIUM_HOME_TEAM = {
  대전: 'HH',
  광주: 'HT',
  대구: 'SS',
  잠실: null,
  고척: 'WO',
  문학: 'SK',
  수원: 'KT',
  사직: 'LT',
  창원: 'NC',
}

export const STADIUM_COORDS = {
  잠실: { region: '서울 잠실', lat: 37.5121, lon: 127.0719 },
  고척: { region: '서울 고척', lat: 37.4982, lon: 126.8671 },
  문학: { region: '인천 문학', lat: 37.4369, lon: 126.6931 },
  수원: { region: '수원', lat: 37.2998, lon: 127.0096 },
  대전: { region: '대전', lat: 36.3171, lon: 127.4281 },
  대구: { region: '대구', lat: 35.841, lon: 128.6811 },
  광주: { region: '광주', lat: 35.168, lon: 126.8891 },
  사직: { region: '부산 사직', lat: 35.1943, lon: 129.0615 },
  창원: { region: '창원', lat: 35.2222, lon: 128.5822 },
  포항: { region: '포항', lat: 36.0147, lon: 129.365 },
  울산: { region: '울산', lat: 35.5351, lon: 129.2582 },
}

export const STADIUM_ORDER = ['잠실', '고척', '문학', '수원', '대구', '사직', '광주', '대전', '창원']

export function getTeam(codeOrName) {
  if (!codeOrName) return null
  return TEAM_BY_CODE[codeOrName] || TEAM_BY_NAME[codeOrName] || null
}

export function resolveStadiumCoords(stadium) {
  const s = String(stadium || '')
  for (const [key, info] of Object.entries(STADIUM_COORDS)) {
    if (s.includes(key)) return info
  }
  return null
}

export function applyTeamAccent(teamCode) {
  const team = TEAM_BY_CODE[teamCode]
  const color = team?.color || '#0070e0'
  document.documentElement.style.setProperty('--accent', color)
  return color
}
