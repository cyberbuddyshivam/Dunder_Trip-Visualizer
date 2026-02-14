/* ═══════════════════════════════════════════════
   API & Utility Functions
   ═══════════════════════════════════════════════ */
import turfAlong from "@turf/along";
import turfLength from "@turf/length";
import { lineString as turfLineString } from "@turf/helpers";

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

/** Forward geocode – search by place name using Nominatim */
export async function forwardGeocode(query) {
  if (!query || query.trim().length < 2) return [];
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=5&addressdetails=1`,
    );
    const data = await res.json();
    return data.map((item) => ({
      lat: parseFloat(item.lat),
      lng: parseFloat(item.lon),
      label: item.display_name,
      shortLabel: [
        item.address?.city ||
          item.address?.town ||
          item.address?.village ||
          item.name,
        item.address?.state,
        item.address?.country,
      ]
        .filter(Boolean)
        .slice(0, 3)
        .join(", "),
    }));
  } catch (_) {
    return [];
  }
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

/**
 * Build a Turf LineString + cache its total length (km).
 * Call once per route; store the result in the state.
 */
export function buildTurfLine(rawCoords) {
  // rawCoords = [[lng, lat], …]
  const line = turfLineString(rawCoords);
  const totalKm = turfLength(line, { units: "kilometers" });
  return { line, totalKm };
}

/**
 * Interpolate position along route at progress t ∈ [0,1].
 * Uses Turf along() for perfect route-alignment when a turfLine is available.
 * Falls back to cumDist-based interpolation otherwise.
 */
export function interpolateRoute(coords, cumDist, t, turfLine, turfTotalKm) {
  if (coords.length === 0) return { lat: 0, lng: 0 };
  if (t <= 0) return coords[0];
  if (t >= 1) return coords[coords.length - 1];

  // ── Turf-based (preferred – snaps exactly to polyline) ──
  if (turfLine && turfTotalKm > 0) {
    const distKm = t * turfTotalKm;
    const pt = turfAlong(turfLine, distKm, { units: "kilometers" });
    const [lng, lat] = pt.geometry.coordinates;
    return { lat, lng };
  }

  // ── Fallback: cumDist binary-search interpolation ──
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
