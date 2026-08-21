import { createClient } from '@supabase/supabase-js'
import { Capacitor } from '@capacitor/core'

export const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
export const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabaseConfigError =
  !supabaseUrl || !supabaseAnonKey
    ? 'Supabase 키가 없습니다. .env.local을 설정하거나 로컬 체험 모드로 진행하세요.'
    : ''

export const supabase = supabaseConfigError
  ? null
  : createClient(supabaseUrl, supabaseAnonKey)

export function getAuthRedirectUrl() {
  const explicit = import.meta.env.VITE_KAKAO_REDIRECT_URL
  if (explicit) return explicit
  if (Capacitor.isNativePlatform()) {
    return 'app.ourteam.mobile://auth/callback'
  }
  return window.location.origin + (import.meta.env.BASE_URL || '/')
}

export const LOCAL_SESSION_KEY = 'ourteam-local-session'

export function readLocalSession() {
  try {
    const raw = localStorage.getItem(LOCAL_SESSION_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

export function writeLocalSession(session) {
  localStorage.setItem(LOCAL_SESSION_KEY, JSON.stringify(session))
}

export function clearLocalSession() {
  localStorage.removeItem(LOCAL_SESSION_KEY)
}
