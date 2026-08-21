import { resolveStadiumCoords } from './teams'

export async function fetchStadiumWeather(stadium) {
  const coords = resolveStadiumCoords(stadium)
  if (!coords) return null
  const url = new URL('https://api.open-meteo.com/v1/forecast')
  url.searchParams.set('latitude', String(coords.lat))
  url.searchParams.set('longitude', String(coords.lon))
  url.searchParams.set('hourly', 'temperature_2m,precipitation_probability,wind_speed_10m')
  url.searchParams.set('timezone', 'Asia/Seoul')
  url.searchParams.set('forecast_days', '2')
  const res = await fetch(url.toString())
  if (!res.ok) return null
  const body = await res.json()
  const hours = []
  const t = body.hourly?.time || []
  for (let i = 0; i < t.length; i += 1) {
    const hour = Number(String(t[i]).slice(11, 13))
    if (hour < 17 || hour > 22) continue
    hours.push({
      time: t[i],
      hour,
      temp: body.hourly.temperature_2m?.[i],
      rain: body.hourly.precipitation_probability?.[i],
      wind: body.hourly.wind_speed_10m?.[i],
    })
    if (hours.length >= 6) break
  }
  const rainMax = Math.max(0, ...hours.map((h) => h.rain || 0))
  const windMax = Math.max(0, ...hours.map((h) => h.wind || 0))
  return { region: coords.region, hours, rainMax, windMax, warning: rainMax >= 60 || windMax >= 12 }
}
