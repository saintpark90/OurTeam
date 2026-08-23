export default function Avatar({ name, url, size }) {
  const initial = (name || '?').trim().slice(0, 1)
  const style = size ? { width: size, height: size, fontSize: size * 0.38 } : undefined
  if (url) {
    return <img className="avatar" src={url} alt="" style={style} />
  }
  return (
    <span className="avatar-fallback" style={style} aria-hidden>
      {initial}
    </span>
  )
}
