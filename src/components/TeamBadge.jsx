export default function TeamBadge({ team, size = 'md' }) {
  if (!team) return <span className="muted">-</span>
  return (
    <span
      className={`team-badge ${size === 'lg' ? 'lg' : ''}`}
      style={{ background: team.color }}
      title={team.nameKo}
    >
      {team.shortLabel}
    </span>
  )
}
