const KOREAN_DAY_MARKS = {
  '2026-01-01': { kind: 'public', label: '신정' },
  '2026-02-16': { kind: 'public', label: '설날' },
  '2026-02-17': { kind: 'public', label: '설날' },
  '2026-02-18': { kind: 'public', label: '설날' },
  '2026-03-01': { kind: 'both', label: '삼일절' },
  '2026-03-02': { kind: 'public', label: '대체공휴일' },
  '2026-05-01': { kind: 'public', label: '노동절' },
  '2026-05-05': { kind: 'public', label: '어린이날' },
  '2026-05-24': { kind: 'public', label: '부처님오신날' },
  '2026-05-25': { kind: 'public', label: '대체공휴일' },
  '2026-06-06': { kind: 'public', label: '현충일' },
  '2026-07-17': { kind: 'both', label: '제헌절' },
  '2026-08-15': { kind: 'both', label: '광복절' },
  '2026-08-17': { kind: 'public', label: '대체공휴일' },
  '2026-09-24': { kind: 'public', label: '추석' },
  '2026-09-25': { kind: 'public', label: '추석' },
  '2026-09-26': { kind: 'public', label: '추석' },
  '2026-09-28': { kind: 'public', label: '대체공휴일' },
  '2026-10-03': { kind: 'both', label: '개천절' },
  '2026-10-05': { kind: 'public', label: '대체공휴일' },
  '2026-10-09': { kind: 'both', label: '한글날' },
  '2026-12-25': { kind: 'public', label: '성탄절' },
}

export function getKoreanDayMark(iso) {
  return KOREAN_DAY_MARKS[iso] || null
}

export function isKoreanPublicHolidayMark(mark) {
  return mark?.kind === 'public' || mark?.kind === 'both'
}
