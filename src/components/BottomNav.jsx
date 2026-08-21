import { NavLink } from 'react-router-dom'

const items = [
  { to: '/', label: '경기', end: true },
  { to: '/fan', label: '직관' },
  { to: '/groups', label: '그룹' },
  { to: '/me', label: '내 정보' },
]

export default function BottomNav() {
  return (
    <nav className="bottom-nav" aria-label="주요 메뉴">
      {items.map((item) => (
        <NavLink key={item.to} to={item.to} end={item.end} className={({ isActive }) => (isActive ? 'active' : '')}>
          {item.label}
        </NavLink>
      ))}
    </nav>
  )
}
