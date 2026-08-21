const secureAvatarUrl = (url) => {
  if (!url || typeof url !== 'string') return ''
  const trimmed = url.trim()
  if (
    typeof window !== 'undefined' &&
    window.location.protocol === 'https:' &&
    /^http:\/\//i.test(trimmed)
  ) {
    return trimmed.replace(/^http:\/\//i, 'https://')
  }
  return trimmed
}

export function getUserDisplayFields(user) {
  if (!user) return { displayName: '회원', avatarUrl: '' }
  const meta = user.user_metadata ?? {}
  const displayName =
    meta.full_name || meta.name || meta.nickname || user.email?.split('@')[0] || '회원'
  const avatarUrl = meta.avatar_url || meta.picture || ''
  return { displayName, avatarUrl: secureAvatarUrl(avatarUrl) }
}

export function isAuthUserUuid(id) {
  if (typeof id !== 'string') return false
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)
}
