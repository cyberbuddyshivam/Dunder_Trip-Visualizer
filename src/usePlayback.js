/* ═══════════════════════════════════════════════
   usePlayback – animation loop hook
   ═══════════════════════════════════════════════ */
import { useRef, useEffect, useCallback } from "react";
import L from "leaflet";
import { getSnapshot, setState, resetState } from "./store";
import { interpolateRoute } from "./utils";

function createTravelerIcon() {
  return L.divIcon({
    className: "custom-marker",
    html: '<div class="pulse-traveler"></div>',
    iconSize: [18, 18],
    iconAnchor: [9, 9],
  });
}

export function usePlayback() {
  const frameRef = useRef(null);
  const lastTsRef = useRef(null);

  /* ── Animation frame loop ── */
  const loop = useCallback((timestamp) => {
    const s = getSnapshot();
    if (!s.playing) return;

    if (lastTsRef.current === null) lastTsRef.current = timestamp;
    const dt = (timestamp - lastTsRef.current) / 1000;
    lastTsRef.current = timestamp;

    const effectiveTime = s.totalPlaybackTime / s.playbackSpeed;
    let newProgress = s.playbackProgress + dt / effectiveTime;

    if (newProgress >= 1) {
      newProgress = 1;
      setState({ playbackProgress: 1, playing: false });
    } else {
      setState({ playbackProgress: newProgress });
    }

    // Interpolate position
    if (s._cumDist && s.routeCoords.length > 0) {
      const pos = interpolateRoute(s.routeCoords, s._cumDist, newProgress);
      const layers = window.__mapLayers;
      const map = window.__mapInstance;

      if (layers?.travelerMarker) {
        layers.travelerMarker.setLatLng([pos.lat, pos.lng]);
      }

      // Cinematic camera follow
      if (map && newProgress > 0.02 && newProgress < 1) {
        map.panTo([pos.lat, pos.lng], {
          animate: true,
          duration: 0.4,
          easeLinearity: 0.5,
          noMoveStart: true,
        });
      }
    }

    if (newProgress < 1) {
      frameRef.current = requestAnimationFrame(loop);
    }
  }, []);

  /* ── Start / Pause ── */
  const start = useCallback(() => {
    const s = getSnapshot();
    if (s.routeCoords.length === 0) return;

    let progress = s.playbackProgress;
    if (progress >= 1) progress = 0;

    // Ensure traveler marker exists
    const layers = window.__mapLayers;
    const map = window.__mapInstance;
    if (map && layers && !layers.travelerMarker) {
      layers.travelerMarker = L.marker(
        [s.routeCoords[0].lat, s.routeCoords[0].lng],
        { icon: createTravelerIcon(), zIndexOffset: 1000 },
      ).addTo(map);
    }

    lastTsRef.current = null;
    setState({ playing: true, playbackProgress: progress });
    frameRef.current = requestAnimationFrame(loop);
  }, [loop]);

  const pause = useCallback(() => {
    setState({ playing: false });
    if (frameRef.current) cancelAnimationFrame(frameRef.current);
  }, []);

  const toggle = useCallback(() => {
    const s = getSnapshot();
    if (s.playing) pause();
    else start();
  }, [start, pause]);

  /* ── Reset ── */
  const reset = useCallback(() => {
    pause();
    const layers = window.__mapLayers;
    const map = window.__mapInstance;
    if (map && layers) {
      Object.keys(layers).forEach((k) => {
        if (layers[k]) {
          map.removeLayer(layers[k]);
          layers[k] = null;
        }
      });
    }
    resetState();
  }, [pause]);

  /* ── Keyboard shortcut (Space) ── */
  useEffect(() => {
    const handler = (e) => {
      if (e.code === "Space") {
        const s = getSnapshot();
        if (s.routeCoords.length > 0) {
          e.preventDefault();
          toggle();
        }
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [toggle]);

  /* ── Keep animation loop alive when playing changes via store ── */
  // (handled inside start/pause; no extra effect needed)

  return { start, pause, toggle, reset };
}
