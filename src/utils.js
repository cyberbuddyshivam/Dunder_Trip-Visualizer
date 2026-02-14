/* ═══════════════════════════════════════════════
   API & Utility Functions
   ═══════════════════════════════════════════════ */

/** Reverse geocode using Nominatim (free) */
export async function reverseGeocode(lat, lng) {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=14`,
    );
    const data = await res.json();
    if (data?.display_name) {
      const parts = data.display_name.split(",");
      return parts
        .slice(0, 3)
        .map((s) => s.trim())
        .join(", ");
    }
  } catch (_) {
    /* ignore */
  }
  return `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
}

/** Fetch driving route from OSRM (free, no key needed) */
export async function fetchRoute(startLat, startLng, endLat, endLng) {
  const url = `https://router.project-osrm.org/route/v1/driving/${startLng},${startLat};${endLng},${endLat}?overview=full&geometries=geojson&steps=true`;
  const res = await fetch(url);
  if (!res.ok) throw new Error("Routing API error");
  const data = await res.json();
  if (!data.routes?.length) throw new Error("No route found");
  return data.routes[0];
}

/** Convert GeoJSON [lng, lat] → { lat, lng } */
export function geoJSONToLatLngs(coords) {
  return coords.map(([lng, lat]) => ({ lat, lng }));
}

/** Haversine distance in meters */
export function haversine(a, b) {
  const R = 6371000;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const sinLat = Math.sin(dLat / 2);
  const sinLng = Math.sin(dLng / 2);
  const h =
    sinLat * sinLat +
    Math.cos((a.lat * Math.PI) / 180) *
      Math.cos((b.lat * Math.PI) / 180) *
      sinLng *
      sinLng;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** Build cumulative distance array (cached) */
export function buildCumDist(coords) {
  const cum = [0];
  for (let i = 1; i < coords.length; i++) {
    cum.push(cum[i - 1] + haversine(coords[i - 1], coords[i]));
  }
  return cum;
}

/** Interpolate position along route at progress t ∈ [0,1] */
export function interpolateRoute(coords, cumDist, t) {
  if (coords.length === 0) return { lat: 0, lng: 0 };
  if (t <= 0) return coords[0];
  if (t >= 1) return coords[coords.length - 1];

  const totalDist = cumDist[cumDist.length - 1];
  const targetDist = t * totalDist;

  let lo = 0,
    hi = cumDist.length - 1;
  while (lo < hi - 1) {
    const mid = (lo + hi) >> 1;
    if (cumDist[mid] <= targetDist) lo = mid;
    else hi = mid;
  }

  const segLen = cumDist[hi] - cumDist[lo];
  const frac = segLen > 0 ? (targetDist - cumDist[lo]) / segLen : 0;

  return {
    lat: coords[lo].lat + frac * (coords[hi].lat - coords[lo].lat),
    lng: coords[lo].lng + frac * (coords[hi].lng - coords[lo].lng),
  };
}

/** Format seconds → human string */
export function formatDuration(sec) {
  if (sec < 60) return `${Math.round(sec)}s`;
  if (sec < 3600) return `${Math.floor(sec / 60)} min`;
  const h = Math.floor(sec / 3600);
  const m = Math.round((sec % 3600) / 60);
  return `${h}h ${m}m`;
}

/** Format seconds → m:ss */
export function formatMMSS(sec) {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

/** Compute bearing (degrees) from point A to point B */
export function computeBearing(from, to) {
  const toRad = Math.PI / 180;
  const toDeg = 180 / Math.PI;
  const dLng = (to.lng - from.lng) * toRad;
  const lat1 = from.lat * toRad;
  const lat2 = to.lat * toRad;
  const y = Math.sin(dLng) * Math.cos(lat2);
  const x =
    Math.cos(lat1) * Math.sin(lat2) -
    Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);
  return (Math.atan2(y, x) * toDeg + 360) % 360;
}

/** Split route into traveled and upcoming GeoJSON coords at progress t */
export function splitRouteAtProgress(coords, cumDist, t) {
  if (!coords.length) return { traveled: [], upcoming: [] };
  if (t <= 0)
    return { traveled: [], upcoming: coords.map((c) => [c.lng, c.lat]) };
  if (t >= 1)
    return { traveled: coords.map((c) => [c.lng, c.lat]), upcoming: [] };

  const totalDist = cumDist[cumDist.length - 1];
  const targetDist = t * totalDist;

  let lo = 0,
    hi = cumDist.length - 1;
  while (lo < hi - 1) {
    const mid = (lo + hi) >> 1;
    if (cumDist[mid] <= targetDist) lo = mid;
    else hi = mid;
  }

  const segLen = cumDist[hi] - cumDist[lo];
  const frac = segLen > 0 ? (targetDist - cumDist[lo]) / segLen : 0;
  const interpLng = coords[lo].lng + frac * (coords[hi].lng - coords[lo].lng);
  const interpLat = coords[lo].lat + frac * (coords[hi].lat - coords[lo].lat);
  const interpPoint = [interpLng, interpLat];

  const traveled = [];
  for (let i = 0; i <= lo; i++) traveled.push([coords[i].lng, coords[i].lat]);
  traveled.push(interpPoint);

  const upcoming = [interpPoint];
  for (let i = hi; i < coords.length; i++)
    upcoming.push([coords[i].lng, coords[i].lat]);

  return { traveled, upcoming };
}
