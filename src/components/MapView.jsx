import React, { useEffect, useRef, useCallback } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { useRouteStore, setState, getSnapshot } from "../store";
import {
  reverseGeocode,
  fetchRoute,
  geoJSONToLatLngs,
  buildCumDist,
  interpolateRoute,
} from "../utils";

/* Fix Leaflet default marker icon paths broken by bundlers */
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl:
    "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

/* Leaflet icon helpers */
function createIcon(type) {
  return L.divIcon({
    className: "custom-marker",
    html: `<div class="marker-${type}"></div>`,
    iconSize: [20, 20],
    iconAnchor: [10, 10],
  });
}

function createTravelerIcon() {
  return L.divIcon({
    className: "custom-marker",
    html: '<div class="pulse-traveler"></div>',
    iconSize: [18, 18],
    iconAnchor: [9, 9],
  });
}

export default function MapView() {
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);

  // Leaflet layer refs (not React state — imperative)
  const layersRef = useRef({
    startMarker: null,
    endMarker: null,
    routeGlow: null,
    routeLine: null,
    travelerMarker: null,
  });

  // Expose map + layers globally so playback hook can use them
  useEffect(() => {
    window.__mapInstance = mapInstanceRef.current;
    window.__mapLayers = layersRef.current;
  });

  // Read store for reset-driven cleanup
  const store = useRouteStore();

  /* ─── Initialize Leaflet map ─── */
  useEffect(() => {
    if (mapInstanceRef.current) return; // already initialized

    const map = L.map(mapRef.current, {
      center: [20, 0],
      zoom: 3,
      zoomControl: true,
      attributionControl: true,
    });

    L.tileLayer(
      "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png",
      {
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/">CARTO</a>',
        subdomains: "abcd",
        maxZoom: 20,
      },
    ).addTo(map);

    mapInstanceRef.current = map;
    window.__mapInstance = map;

    // Force Leaflet to recalculate container size after React render
    setTimeout(() => map.invalidateSize(), 0);
    // Also on window resize
    const onResize = () => map.invalidateSize();
    window.addEventListener("resize", onResize);

    // Click handler
    map.on("click", handleMapClick);

    return () => {
      window.removeEventListener("resize", onResize);
      map.off("click", handleMapClick);
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  /* ─── Clean up layers when store resets to idle ─── */
  useEffect(() => {
    if (store.phase === "idle") {
      const map = mapInstanceRef.current;
      const layers = layersRef.current;
      if (!map) return;
      Object.keys(layers).forEach((k) => {
        if (layers[k]) {
          map.removeLayer(layers[k]);
          layers[k] = null;
        }
      });
      map.flyTo([20, 0], 3, { duration: 1 });
    }
  }, [store.phase]);

  return <div id="map" ref={mapRef} />;
}

/* ───────────────────────────────────────────────
   Map click handler (reads/writes store directly)
   ─────────────────────────────────────────────── */
async function handleMapClick(e) {
  const { lat, lng } = e.latlng;
  const snap = getSnapshot();
  const map = window.__mapInstance;
  const layers = window.__mapLayers;

  // ── Place Start ──
  if (snap.phase === "idle") {
    const marker = L.marker([lat, lng], { icon: createIcon("start") }).addTo(
      map,
    );
    layers.startMarker = marker;

    setState({
      startLatLng: { lat, lng },
      phase: "start-placed",
    });

    reverseGeocode(lat, lng).then((label) => setState({ startLabel: label }));
    return;
  }

  // ── Place Destination & fetch route ──
  if (snap.phase === "start-placed") {
    const marker = L.marker([lat, lng], { icon: createIcon("end") }).addTo(map);
    layers.endMarker = marker;

    setState({
      endLatLng: { lat, lng },
      phase: "loading",
    });

    reverseGeocode(lat, lng).then((label) => setState({ endLabel: label }));

    try {
      const s = getSnapshot();
      const route = await fetchRoute(
        s.startLatLng.lat,
        s.startLatLng.lng,
        lat,
        lng,
      );
      processRoute(route, map, layers);
    } catch (err) {
      alert(
        "Could not find a driving route between those points. Try different locations.",
      );
      // full reset
      Object.keys(layers).forEach((k) => {
        if (layers[k]) {
          map.removeLayer(layers[k]);
          layers[k] = null;
        }
      });
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
      });
    }
  }
}

/* ── Process OSRM response ── */
function processRoute(route, map, layers) {
  const routeCoords = geoJSONToLatLngs(route.geometry.coordinates);
  const cumDist = buildCumDist(routeCoords);
  const distKm = route.distance / 1000;
  const totalPlaybackTime = Math.min(60, Math.max(10, distKm * 0.15));

  const segments = [];
  (route.legs || []).forEach((leg) => {
    (leg.steps || []).forEach((step) => {
      if (step.name || step.maneuver) {
        segments.push({
          instruction: step.name || "Unnamed road",
          distance: step.distance,
          type: step.maneuver?.type || "",
        });
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
    phase: "ready",
  });

  drawRoute(routeCoords, map, layers);
}

/* ── Draw route polyline with animated reveal ── */
function drawRoute(routeCoords, map, layers) {
  const coords = routeCoords.map((c) => [c.lat, c.lng]);

  // Glow layer
  layers.routeGlow = L.polyline(coords, {
    color: "#3B82F6",
    weight: 10,
    opacity: 0.15,
    lineCap: "round",
    lineJoin: "round",
  }).addTo(map);

  // Main line (animated)
  layers.routeLine = L.polyline([], {
    color: "#3B82F6",
    weight: 4,
    opacity: 0.85,
    lineCap: "round",
    lineJoin: "round",
  }).addTo(map);

  // Animate drawing
  const total = coords.length;
  const drawDuration = 1200;
  let start = null;
  const drawn = [];

  function step(ts) {
    if (!start) start = ts;
    const elapsed = ts - start;
    const progress = Math.min(elapsed / drawDuration, 1);
    const idx = Math.floor(progress * (total - 1));
    while (drawn.length <= idx && drawn.length < total) {
      drawn.push(coords[drawn.length]);
    }
    layers.routeLine.setLatLngs(drawn);
    if (progress < 1) requestAnimationFrame(step);
  }
  requestAnimationFrame(step);

  // Fly to bounds
  const bounds = L.latLngBounds(coords);
  map.flyToBounds(bounds, { padding: [80, 80], duration: 1.4 });
}
