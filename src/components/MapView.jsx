import React, { useEffect, useRef } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { useRouteStore, setState, getSnapshot } from "../store";
import {
  reverseGeocode,
  fetchRoute,
  geoJSONToLatLngs,
  buildCumDist,
  buildTurfLine,
} from "../utils";

/* ── Marker element factories ── */
function createMarkerElement(type) {
  const el = document.createElement("div");
  el.className = `marker-3d marker-${type}`;
  const inner = document.createElement("div");
  inner.className = `marker-inner marker-inner-${type}`;
  el.appendChild(inner);
  const ring = document.createElement("div");
  ring.className = `marker-ring marker-ring-${type}`;
  el.appendChild(ring);
  return el;
}

const EMPTY_GEO = {
  type: "Feature",
  geometry: { type: "LineString", coordinates: [] },
};

export default function MapView() {
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markersRef = useRef({ start: null, end: null, traveler: null });
  const store = useRouteStore();
  const layersReady = useRef(false);

  /* Expose map + markers globally for playback hook */
  useEffect(() => {
    window.__mapInstance = mapInstanceRef.current;
    window.__mapMarkers = markersRef.current;
  });

  /* ─── Initialize MapLibre GL map ─── */
  useEffect(() => {
    if (mapInstanceRef.current) return;

    const map = new maplibregl.Map({
      container: mapRef.current,
      style: {
        version: 8,
        sources: {
          "carto-light": {
            type: "raster",
            tiles: [
              "https://a.basemaps.cartocdn.com/light_all/{z}/{x}/{y}@2x.png",
              "https://b.basemaps.cartocdn.com/light_all/{z}/{x}/{y}@2x.png",
              "https://c.basemaps.cartocdn.com/light_all/{z}/{x}/{y}@2x.png",
            ],
            tileSize: 256,
            attribution:
              '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/">CARTO</a>',
          },
        },
        layers: [
          {
            id: "carto-tiles",
            type: "raster",
            source: "carto-light",
            minzoom: 0,
            maxzoom: 20,
          },
        ],
        glyphs: "https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf",
        // Atmospheric fog for depth – cinematic horizon fading
        fog: {
          range: [0.5, 10],
          color: "rgba(244, 245, 247, 0.7)",
          "horizon-blend": 0.12,
        },
      },
      center: [78.9629, 20.5937],
      zoom: 4.5,
      pitch: 0,
      bearing: 0,
      maxPitch: 70,
      antialias: true,
    });

    map.addControl(
      new maplibregl.NavigationControl({ showCompass: true }),
      "top-right",
    );

    map.on("load", () => {
      addRouteLayers(map);
      layersReady.current = true;
    });

    map.on("click", handleMapClick);

    mapInstanceRef.current = map;
    window.__mapInstance = map;

    return () => {
      map.remove();
      mapInstanceRef.current = null;
      layersReady.current = false;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  /* ─── Clean up when store resets to idle ─── */
  useEffect(() => {
    if (store.phase === "idle") {
      const map = mapInstanceRef.current;
      const markers = markersRef.current;
      if (!map) return;

      if (markers.start) {
        markers.start.remove();
        markers.start = null;
      }
      if (markers.end) {
        markers.end.remove();
        markers.end = null;
      }
      if (markers.traveler) {
        markers.traveler.remove();
        markers.traveler = null;
      }

      clearRouteSources(map);

      map.flyTo({
        center: [78.9629, 20.5937],
        zoom: 4.5,
        pitch: 0,
        bearing: 0,
        duration: 1500,
        essential: true,
      });
    }
  }, [store.phase]);

  return <div id="map" ref={mapRef} />;
}

/* ═══════════════════════════════════════════════
   Map layer management
   ═══════════════════════════════════════════════ */
function addRouteLayers(map) {
  map.addSource("route-upcoming", { type: "geojson", data: EMPTY_GEO });
  map.addSource("route-traveled", { type: "geojson", data: EMPTY_GEO });
  map.addSource("route-pulse", { type: "geojson", data: EMPTY_GEO });

  // ── Route Pulse (traveling light pulse) ──
  map.addLayer({
    id: "route-pulse-glow",
    type: "line",
    source: "route-pulse",
    layout: { "line-join": "round", "line-cap": "round" },
    paint: {
      "line-color": "#ffffff",
      "line-width": 14,
      "line-opacity": 0.8,
      "line-blur": 8,
    },
  });
  map.addLayer({
    id: "route-pulse-core",
    type: "line",
    source: "route-pulse",
    layout: { "line-join": "round", "line-cap": "round" },
    paint: {
      "line-color": "#fff",
      "line-width": 4,
      "line-opacity": 1,
    },
  });

  // ── Route shadow (depth separation from map surface) ──
  map.addLayer({
    id: "route-shadow",
    type: "line",
    source: "route-upcoming",
    layout: { "line-join": "round", "line-cap": "round" },
    paint: {
      "line-color": "rgba(15, 23, 42, 0.10)",
      "line-width": 26,
      "line-blur": 20,
      "line-translate": [2, 5],
    },
  });

  // ── Upcoming outer glow halo ──
  map.addLayer({
    id: "route-upcoming-glow",
    type: "line",
    source: "route-upcoming",
    layout: { "line-join": "round", "line-cap": "round" },
    paint: {
      "line-color": "#E7C2A3",
      "line-width": 18,
      "line-opacity": 0.1,
      "line-blur": 12,
    },
  });
  // ── Upcoming core line ──
  map.addLayer({
    id: "route-upcoming-line",
    type: "line",
    source: "route-upcoming",
    layout: { "line-join": "round", "line-cap": "round" },
    paint: { "line-color": "#E7C2A3", "line-width": 4, "line-opacity": 0.35 },
  });

  // ── Traveled shadow (separate depth under traveled) ──
  map.addLayer({
    id: "route-traveled-shadow",
    type: "line",
    source: "route-traveled",
    layout: { "line-join": "round", "line-cap": "round" },
    paint: {
      "line-color": "rgba(212, 163, 115, 0.15)",
      "line-width": 24,
      "line-blur": 18,
      "line-translate": [1, 3],
    },
  });
  // ── Traveled outer glow (brighter) ──
  map.addLayer({
    id: "route-traveled-glow",
    type: "line",
    source: "route-traveled",
    layout: { "line-join": "round", "line-cap": "round" },
    paint: {
      "line-color": "#D4A373",
      "line-width": 22,
      "line-opacity": 0.22,
      "line-blur": 14,
    },
  });
  // ── Traveled inner glow (bright ribbon edge) ──
  map.addLayer({
    id: "route-traveled-inner-glow",
    type: "line",
    source: "route-traveled",
    layout: { "line-join": "round", "line-cap": "round" },
    paint: {
      "line-color": "#E7C2A3",
      "line-width": 10,
      "line-opacity": 0.35,
      "line-blur": 4,
    },
  });
  // ── Traveled core (dark brown ribbon) ──
  map.addLayer({
    id: "route-traveled-line",
    type: "line",
    source: "route-traveled",
    layout: { "line-join": "round", "line-cap": "round" },
    paint: { "line-color": "#B8895C", "line-width": 5.5, "line-opacity": 0.95 },
  });
  // ── Traveled center highlight (bright inner) ──
  map.addLayer({
    id: "route-traveled-highlight",
    type: "line",
    source: "route-traveled",
    layout: { "line-join": "round", "line-cap": "round" },
    paint: {
      "line-color": "#E7C2A3",
      "line-width": 1.5,
      "line-opacity": 0.6,
    },
  });

  // ── Pulse light layer ──
  map.addLayer({
    id: "route-pulse-glow",
    type: "line",
    source: "route-pulse",
    layout: { "line-join": "round", "line-cap": "round" },
    paint: {
      "line-color": "#60A5FA",
      "line-width": 28,
      "line-opacity": 0.45,
      "line-blur": 16,
    },
  });
  map.addLayer({
    id: "route-pulse-core",
    type: "line",
    source: "route-pulse",
    layout: { "line-join": "round", "line-cap": "round" },
    paint: {
      "line-color": "#BFDBFE",
      "line-width": 8,
      "line-opacity": 0.7,
      "line-blur": 4,
    },
  });
}

function clearRouteSources(map) {
  try {
    const sources = ["route-upcoming", "route-traveled", "route-pulse"];
    sources.forEach((id) => {
      const s = map.getSource(id);
      if (s) s.setData(EMPTY_GEO);
    });
  } catch (_) {
    /* safe ignore */
  }
}

/* ═══════════════════════════════════════════════
   Programmatic marker placement (used by map click + search)
   ═══════════════════════════════════════════════ */

/** Place start marker at given coords. Callable from search. */
export function placeStartMarker(lat, lng, label) {
  const map = window.__mapInstance;
  const markers = window.__mapMarkers;
  if (!map || !markers) return;

  // Remove existing start marker if any
  if (markers.start) {
    markers.start.remove();
    markers.start = null;
  }

  const el = createMarkerElement("start");
  markers.start = new maplibregl.Marker({ element: el, anchor: "center" })
    .setLngLat([lng, lat])
    .addTo(map);

  // Floating label popup
  const popup = new maplibregl.Popup({
    closeButton: false,
    closeOnClick: false,
    offset: [0, -24],
    className: "marker-label-popup",
  })
    .setLngLat([lng, lat])
    .setHTML('<span class="label-text">Start Location</span>')
    .addTo(map);
  setTimeout(() => popup.remove(), 3000);

  setState({ startLatLng: { lat, lng }, phase: "start-placed" });
  if (label) {
    setState({ startLabel: label });
  } else {
    reverseGeocode(lat, lng).then((l) => setState({ startLabel: l }));
  }

  map.flyTo({ center: [lng, lat], zoom: 12, duration: 1200, essential: true });
}

/** Place end marker and trigger route fetching. Callable from search. */
export async function placeEndMarkerAndFetch(lat, lng, label) {
  const map = window.__mapInstance;
  const markers = window.__mapMarkers;
  if (!map || !markers) return;

  // Remove existing end marker if any
  if (markers.end) {
    markers.end.remove();
    markers.end = null;
  }

  const el = createMarkerElement("end");
  markers.end = new maplibregl.Marker({ element: el, anchor: "center" })
    .setLngLat([lng, lat])
    .addTo(map);

  // Floating label popup
  const popup = new maplibregl.Popup({
    closeButton: false,
    closeOnClick: false,
    offset: [0, -24],
    className: "marker-label-popup",
  })
    .setLngLat([lng, lat])
    .setHTML('<span class="label-text">Destination</span>')
    .addTo(map);
  setTimeout(() => popup.remove(), 3000);

  setState({ endLatLng: { lat, lng }, phase: "loading" });
  if (label) {
    setState({ endLabel: label });
  } else {
    reverseGeocode(lat, lng).then((l) => setState({ endLabel: l }));
  }

  try {
    const s = getSnapshot();
    const route = await fetchRoute(
      s.startLatLng.lat,
      s.startLatLng.lng,
      lat,
      lng,
    );
    processRoute(route, map);
  } catch (err) {
    alert(
      "Could not find a driving route between those points. Try different locations.",
    );
    if (markers.start) {
      markers.start.remove();
      markers.start = null;
    }
    if (markers.end) {
      markers.end.remove();
      markers.end = null;
    }
    clearRouteSources(map);
    setState({
      startLatLng: null,
      endLatLng: null,
      startLabel: "",
      endLabel: "",
      routeCoords: [],
      routeDistance: 0,
      routeDuration: 0,
      segments: [],
      phase: "idle",
      playing: false,
      playbackProgress: 0,
      _cumDist: null,
      _rawCoords: [],
    });
  }
}

/* ═══════════════════════════════════════════════
   Map click handler (reads/writes store directly)
   ═══════════════════════════════════════════════ */
async function handleMapClick(e) {
  const { lng, lat } = e.lngLat;
  const snap = getSnapshot();

  // ── Place Start ──
  if (snap.phase === "idle") {
    placeStartMarker(lat, lng);
    return;
  }

  // ── Place Destination & fetch route ──
  if (snap.phase === "start-placed") {
    await placeEndMarkerAndFetch(lat, lng);
  }
}

/* ── Process OSRM response ── */
function processRoute(route, map) {
  const rawCoords = route.geometry.coordinates; // [lng, lat]
  const routeCoords = geoJSONToLatLngs(rawCoords);
  const cumDist = buildCumDist(routeCoords);
  const { line: turfLine, totalKm: turfTotalKm } = buildTurfLine(rawCoords);
  const distKm = route.distance / 1000;
  const totalPlaybackTime = Math.min(60, Math.max(10, distKm * 0.15));

  const segments = [];
  let segDistAccum = 0;
  const segmentBoundaries = [0];

  (route.legs || []).forEach((leg) => {
    (leg.steps || []).forEach((step) => {
      if (step.name || step.maneuver) {
        segments.push({
          instruction: step.name || "Unnamed road",
          distance: step.distance,
          duration: step.duration,
          type: step.maneuver?.type || "",
        });
        segDistAccum += step.distance;
        segmentBoundaries.push(Math.min(segDistAccum / route.distance, 1));
      }
    });
  });

  setState({
    routeCoords,
    routeDistance: route.distance,
    routeDuration: route.duration,
    segments,
    totalPlaybackTime,
    _cumDist: cumDist,
    _rawCoords: rawCoords,
    _turfLine: turfLine,
    _turfTotalKm: turfTotalKm,
    segmentBoundaries,
    phase: "ready",
  });

  animateRouteDrawing(rawCoords, map);
}

/* ── Animated route drawing + cinematic camera intro ── */
function animateRouteDrawing(rawCoords, map) {
  const total = rawCoords.length;
  const drawDuration = 2200;
  const zoomOutDuration = 800;
  let start = null;

  // Cubic ease-out for cinematic reveal
  function easeOutCubic(t) {
    return 1 - Math.pow(1 - t, 3);
  }

  // Phase 1: Brief zoom-out for dramatic "scene opening"
  const currentZoom = map.getZoom();
  const currentCenter = map.getCenter();
  map.easeTo({
    zoom: Math.max(currentZoom - 1.5, 3),
    pitch: 0,
    bearing: 0,
    duration: zoomOutDuration,
    easing: (t) => t * (2 - t),
    essential: true,
  });

  // Phase 2: After zoom-out, draw route progressively
  setTimeout(() => {
    function step(ts) {
      if (!start) start = ts;
      const rawProgress = Math.min((ts - start) / drawDuration, 1);
      const progress = easeOutCubic(rawProgress);
      const idx = Math.floor(progress * (total - 1)) + 1;
      const partialCoords = rawCoords.slice(0, idx);

      try {
        const src = map.getSource("route-upcoming");
        if (src && partialCoords.length >= 2) {
          src.setData({
            type: "Feature",
            geometry: { type: "LineString", coordinates: partialCoords },
          });
        }
      } catch (_) {}

      if (rawProgress < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }, zoomOutDuration * 0.6);

  // Phase 3: Fly to fit route bounds with cinematic tilt
  const bounds = rawCoords.reduce(
    (b, c) => b.extend(c),
    new maplibregl.LngLatBounds(rawCoords[0], rawCoords[0]),
  );
  const camera = map.cameraForBounds(bounds, {
    padding: { top: 100, bottom: 120, left: 350, right: 60 },
  });

  // Delay the fly-to so it overlaps with draw animation for cinematic effect
  setTimeout(() => {
    if (camera) {
      map.flyTo({
        ...camera,
        pitch: 25,
        bearing: 10,
        duration: 2800,
        easing: (t) => 1 - Math.pow(1 - t, 4), // ease-out quartic – very smooth
        essential: true,
      });
    }
  }, zoomOutDuration + 200);
}
