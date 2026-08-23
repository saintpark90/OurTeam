import { NavLink } from 'react-router-dom'

const items = [
  {
    to: '/',
    label: '경기',
    end: true,
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-5v-6H10v6H5a1 1 0 0 1-1-1v-9.5Z" />
      </svg>
    ),
  },
  {
    to: '/fan',
    label: '직관',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <circle cx="12" cy="12" r="8.2" />
        <circle cx="12" cy="12" r="3.2" />
      </svg>
    ),
  },
  {
    to: '/groups',
    label: '그룹',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <circle cx="9" cy="9" r="3" />
        <circle cx="16.5" cy="10" r="2.4" />
        <path d="M4.5 18.5c.6-2.6 2.6-4 4.5-4s3.9 1.4 4.5 4" />
        <path d="M13.2 18.5c.4-1.8 1.7-3 3.3-3 1.6 0 2.8 1.1 3.2 3" />
      </svg>
    ),
  },
  {
    to: '/me',
    label: '내 정보',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <circle cx="12" cy="8.5" r="3.2" />
        <path d="M5.5 19c.8-3.2 3.2-5 6.5-5s5.7 1.8 6.5 5" />
      </svg>
    ),
  },
]

export default function BottomNav() {
  return (
    <nav className="bottom-nav" aria-label="주요 메뉴">
      {items.map((item) => (
        <NavLink key={item.to} to={item.to} end={item.end} className={({ isActive }) => (isActive ? 'active' : '')}>
          {item.icon}
          {item.label}
        </NavLink>
      ))}
    </nav>
  )
}
