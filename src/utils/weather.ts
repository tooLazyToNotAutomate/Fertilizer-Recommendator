/**
 * Air temperature and humidity from online weather (Open-Meteo: free, no API key).
 * The analyzer has no temperature/humidity sensor, so these two values come from the
 * weather at the user's location (browser asks permission), or Hyderabad if declined.
 */

export interface WeatherNow {
  temperature: number; // °C
  humidity: number; // % relative humidity
  observedAt: Date; // time of the weather model's current reading
  place: string; // "your location" or the fallback city
  fetchedAt: Date;
}

const FALLBACK = { lat: 17.385, lon: 78.4867, place: 'Hyderabad' };

function getPosition(timeoutMs = 6000): Promise<{ lat: number; lon: number; place: string }> {
  return new Promise((resolve) => {
    if (!('geolocation' in navigator)) return resolve(FALLBACK);
    navigator.geolocation.getCurrentPosition(
      // 2 decimals (~1 km) is plenty for weather and keeps the exact position private
      (p) => resolve({ lat: +p.coords.latitude.toFixed(2), lon: +p.coords.longitude.toFixed(2), place: 'your location' }),
      () => resolve(FALLBACK),
      { timeout: timeoutMs, maximumAge: 30 * 60 * 1000 }
    );
  });
}

let cachedPos: Promise<{ lat: number; lon: number; place: string }> | null = null;

export async function fetchWeather(): Promise<WeatherNow> {
  cachedPos ??= getPosition();
  const pos = await cachedPos;
  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${pos.lat}&longitude=${pos.lon}` +
    `&current=temperature_2m,relative_humidity_2m&timezone=auto`;
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) throw new Error(`weather service answered ${res.status}`);
  const j = await res.json();
  const c = j?.current;
  if (typeof c?.temperature_2m !== 'number' || typeof c?.relative_humidity_2m !== 'number')
    throw new Error('weather data missing');
  return {
    temperature: c.temperature_2m,
    humidity: c.relative_humidity_2m,
    observedAt: new Date(c.time),
    place: pos.place,
    fetchedAt: new Date()
  };
}
