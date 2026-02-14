import React, { useEffect, useRef } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { useRouteStore, setState, getSnapshot } from "../store";
import {
  reverseGeocode,
  fetchRoute,
  geoJSONToLatLngs,
  buildCumDist,
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

  // Upcoming glow
  map.addLayer({
    id: "route-upcoming-glow",
    type: "line",
    source: "route-upcoming",
    layout: { "line-join": "round", "line-cap": "round" },
    paint: {
      "line-color": "#93C5FD",
      "line-width": 14,
      "line-opacity": 0.18,
      "line-blur": 8,
    },
  });
  // Upcoming line
  map.addLayer({
    id: "route-upcoming-line",
    type: "line",
    source: "route-upcoming",
    layout: { "line-join": "round", "line-cap": "round" },
    paint: { "line-color": "#93C5FD", "line-width": 4.5, "line-opacity": 0.5 },
  });
  // Traveled glow
  map.addLayer({
    id: "route-traveled-glow",
    type: "line",
    source: "route-traveled",
    layout: { "line-join": "round", "line-cap": "round" },
    paint: {
      "line-color": "#3B82F6",
      "line-width": 16,
      "line-opacity": 0.22,
      "line-blur": 10,
    },
  });
  // Traveled line
  map.addLayer({
    id: "route-traveled-line",
    type: "line",
    source: "route-traveled",
    layout: { "line-join": "round", "line-cap": "round" },
    paint: { "line-color": "#3B82F6", "line-width": 5.5, "line-opacity": 0.9 },
  });
}

function clearRouteSources(map) {
  try {
    const s1 = map.getSource("route-upcoming");
    const s2 = map.getSource("route-traveled");
    if (s1) s1.setData(EMPTY_GEO);
    if (s2) s2.setData(EMPTY_GEO);
  } catch (_) {
    /* safe ignore */
  }
}

/* ═══════════════════════════════════════════════
   Map click handler (reads/writes store directly)
   ═══════════════════════════════════════════════ */
async function handleMapClick(e) {
  const { lng, lat } = e.lngLat;
  const snap = getSnapshot();
  const map = window.__mapInstance;
  const markers = window.__mapMarkers;

  // ── Place Start ──
  if (snap.phase === "idle") {
    const el = createMarkerElement("start");
    markers.start = new maplibregl.Marker({ element: el, anchor: "center" })
      .setLngLat([lng, lat])
      .addTo(map);

    setState({ startLatLng: { lat, lng }, phase: "start-placed" });
    reverseGeocode(lat, lng).then((label) => setState({ startLabel: label }));
    return;
  }

  // ── Place Destination & fetch route ──
  if (snap.phase === "start-placed") {
    const el = createMarkerElement("end");
    markers.end = new maplibregl.Marker({ element: el, anchor: "center" })
      .setLngLat([lng, lat])
      .addTo(map);

    setState({ endLatLng: { lat, lng }, phase: "loading" });
    reverseGeocode(lat, lng).then((label) => setState({ endLabel: label }));

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
}

/* ── Process OSRM response ── */
function processRoute(route, map) {
  const rawCoords = route.geometry.coordinates; // [lng, lat]
  const routeCoords = geoJSONToLatLngs(rawCoords);
  const cumDist = buildCumDist(routeCoords);
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
    segmentBoundaries,
    phase: "ready",
  });

  animateRouteDrawing(rawCoords, map);
}

/* ── Animated route drawing + camera fly-to-fit ── */
function animateRouteDrawing(rawCoords, map) {
  const total = rawCoords.length;
  const drawDuration = 1500;
  let start = null;

  function step(ts) {
    if (!start) start = ts;
    const progress = Math.min((ts - start) / drawDuration, 1);
    const idx = Math.floor(progress * (total - 1)) + 1;
    const partialCoords = rawCoords.slice(0, idx);

    try {
      const src = map.getSource("route-upcoming");
      if (src) {
        src.setData({
          type: "Feature",
          geometry: { type: "LineString", coordinates: partialCoords },
        });
      }
    } catch (_) {}

    if (progress < 1) requestAnimationFrame(step);
  }
  requestAnimationFrame(step);

  // Fly to fit route bounds
  const bounds = rawCoords.reduce(
    (b, c) => b.extend(c),
    new maplibregl.LngLatBounds(rawCoords[0], rawCoords[0]),
  );
  const camera = map.cameraForBounds(bounds, {
    padding: { top: 100, bottom: 120, left: 350, right: 60 },
  });
  if (camera) {
    map.flyTo({ ...camera, duration: 1800, essential: true });
  }
}
