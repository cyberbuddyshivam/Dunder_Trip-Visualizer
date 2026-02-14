/* ═══════════════════════════════════════════════
   usePlayback – cinematic 3D animation loop hook
   ═══════════════════════════════════════════════ */
import { useRef, useEffect, useCallback } from "react";
import maplibregl from "maplibre-gl";
import { getSnapshot, setState, resetState } from "./store";
import {
  interpolateRoute,
  computeBearing,
  splitRouteAtProgress,
} from "./utils";

/* ── Traveler marker factory ── */
function createTravelerElement() {
  const el = document.createElement("div");
  el.className = "traveler-marker";

  // Outer glow halo
  const glow = document.createElement("div");
  glow.className = "traveler-glow";
  el.appendChild(glow);

  const core = document.createElement("div");
  core.className = "traveler-core";
  el.appendChild(core);

  // Inner white precision dot
  const dot = document.createElement("div");
  dot.className = "traveler-dot";
  el.appendChild(dot);

  const pulse = document.createElement("div");
  pulse.className = "traveler-pulse";
  el.appendChild(pulse);
  const pulse2 = document.createElement("div");
  pulse2.className = "traveler-pulse traveler-pulse-2";
  el.appendChild(pulse2);
  return el;
}

/* ── Empty GeoJSON helper ── */
const EMPTY_GEO = {
  type: "Feature",
  geometry: { type: "LineString", coordinates: [] },
};

export function usePlayback() {
  const frameRef = useRef(null);
  const lastTsRef = useRef(null);
  const lastCameraTs = useRef(0);
  const lastBearing = useRef(0);

  /* ── Pulse light running along the route ── */
  const updatePulse = useCallback(
    (map, coords, cumDist, progress, turfLine, turfTotalKm) => {
      if (!map) return;
      const src = map.getSource("route-pulse");
      if (!src) return;

      // Create a short bright segment just ahead of the traveler
      const pulseStart = Math.max(0, progress - 0.008);
      const pulseEnd = Math.min(1, progress + 0.012);

      const startPos = interpolateRoute(
        coords,
        cumDist,
        pulseStart,
        turfLine,
        turfTotalKm,
      );
      const endPos = interpolateRoute(
        coords,
        cumDist,
        pulseEnd,
        turfLine,
        turfTotalKm,
      );

      src.setData({
        type: "Feature",
        geometry: {
          type: "LineString",
          coordinates: [
            [startPos.lng, startPos.lat],
            [endPos.lng, endPos.lat],
          ],
        },
      });
    },
    [],
  );

  /* ── Animation frame loop ── */
  const loop = useCallback(
    (timestamp) => {
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
        // Smooth camera reset to flat view
        const map = window.__mapInstance;
        if (map) {
          map.easeTo({
            pitch: 0,
            bearing: 0,
            zoom: map.getZoom() - 1,
            duration: 2000,
            easing: (t) => 1 - Math.pow(1 - t, 3),
          });
        }
      } else {
        setState({ playbackProgress: newProgress });
      }

      // Update traveler, camera, and route sources
      if (s._cumDist && s.routeCoords.length > 0) {
        const pos = interpolateRoute(
          s.routeCoords,
          s._cumDist,
          newProgress,
          s._turfLine,
          s._turfTotalKm,
        );
        const markers = window.__mapMarkers;
        const map = window.__mapInstance;

        // Move traveler marker
        if (markers?.traveler) {
          markers.traveler.setLngLat([pos.lng, pos.lat]);
        }

        // Update route traveled/upcoming sources
        if (map) {
          const { traveled, upcoming } = splitRouteAtProgress(
            s.routeCoords,
            s._cumDist,
            newProgress,
          );
          try {
            const srcT = map.getSource("route-traveled");
            const srcU = map.getSource("route-upcoming");
            if (srcT && traveled.length >= 2) {
              srcT.setData({
                type: "Feature",
                geometry: { type: "LineString", coordinates: traveled },
              });
            }
            if (srcU && upcoming.length >= 2) {
              srcU.setData({
                type: "Feature",
                geometry: { type: "LineString", coordinates: upcoming },
              });
            }
          } catch (_) {}

          // Update pulse light
          updatePulse(
            map,
            s.routeCoords,
            s._cumDist,
            newProgress,
            s._turfLine,
            s._turfTotalKm,
          );
        }

        // ── Cinematic camera follow (throttled ~150ms) ──
        if (map && newProgress > 0.01 && newProgress < 0.99) {
          const now = performance.now();
          if (now - lastCameraTs.current > 150) {
            lastCameraTs.current = now;

            // Look further ahead for smoother drone-like feel
            const lookAheadT = Math.min(newProgress + 0.04, 1);
            const aheadPos = interpolateRoute(
              s.routeCoords,
              s._cumDist,
              lookAheadT,
              s._turfLine,
              s._turfTotalKm,
            );
            let targetBearing = computeBearing(pos, aheadPos);

            // Very smooth bearing interpolation (cinematic rotation)
            let diff = targetBearing - lastBearing.current;
            if (diff > 180) diff -= 360;
            if (diff < -180) diff += 360;
            const smoothedBearing = lastBearing.current + diff * 0.12;
            lastBearing.current = smoothedBearing;

            // Dynamic pitch: 48–54° with subtle sine variation
            const dynamicPitch = 51 + 3 * Math.sin(newProgress * Math.PI * 3);

            map.easeTo({
              center: [aheadPos.lng, aheadPos.lat],
              bearing: smoothedBearing,
              pitch: dynamicPitch,
              zoom: 15.2,
              duration: 1100,
              easing: (t) => 1 - Math.pow(1 - t, 3), // ease-out cubic
              essential: true,
            });
          }
        }

        // ── Track active segment ──
        if (s.segmentBoundaries && s.segmentBoundaries.length > 1) {
          let segIdx = 0;
          for (let i = 0; i < s.segmentBoundaries.length - 1; i++) {
            if (newProgress >= s.segmentBoundaries[i]) segIdx = i;
          }
          if (segIdx !== s.activeSegmentIndex && s.segments[segIdx]) {
            setState({
              activeSegmentIndex: segIdx,
              currentSegmentInfo: s.segments[segIdx],
              showSegmentCard: true,
            });

            // Trigger traveler pulse animation on segment change
            const travelerEl = markers?.traveler?.getElement();
            if (travelerEl) {
              travelerEl.classList.add("segment-pulse");
              setTimeout(
                () => travelerEl.classList.remove("segment-pulse"),
                900,
              );
            }

            // Camera zoom bump: zoom in 3-5% for 0.5s then ease back
            if (map) {
              const curZoom = map.getZoom();
              map.easeTo({
                zoom: curZoom + 0.5,
                duration: 500,
                easing: (t) => t * (2 - t),
                essential: true,
              });
              setTimeout(() => {
                if (map) {
                  map.easeTo({
                    zoom: curZoom,
                    duration: 700,
                    easing: (t) => 1 - Math.pow(1 - t, 3),
                    essential: true,
                  });
                }
              }, 500);
            }

            setTimeout(() => setState({ showSegmentCard: false }), 3500);
          }
        }
      }

      if (newProgress < 1) {
        frameRef.current = requestAnimationFrame(loop);
      }
    },
    [updatePulse],
  );

  /* ── Start / Pause ── */
  const start = useCallback(() => {
    const s = getSnapshot();
    if (s.routeCoords.length === 0) return;

    let progress = s.playbackProgress;
    if (progress >= 1) progress = 0;

    // Ensure traveler marker exists
    const markers = window.__mapMarkers;
    const map = window.__mapInstance;
    if (map && markers && !markers.traveler) {
      const el = createTravelerElement();
      markers.traveler = new maplibregl.Marker({
        element: el,
        anchor: "center",
      })
        .setLngLat([s.routeCoords[0].lng, s.routeCoords[0].lat])
        .addTo(map);
    }

    // Initial cinematic camera setup
    if (map && progress === 0) {
      const pos = s.routeCoords[0];
      lastBearing.current = 0;
      map.easeTo({
        center: [pos.lng, pos.lat],
        zoom: 15,
        pitch: 50,
        bearing: 0,
        duration: 1500,
        easing: (t) => t * (2 - t),
        essential: true,
      });
    }

    lastTsRef.current = null;
    lastCameraTs.current = 0;
    setState({
      playing: true,
      playbackProgress: progress,
      activeSegmentIndex: -1,
    });
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
    const markers = window.__mapMarkers;
    const map = window.__mapInstance;
    if (markers) {
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
    }
    if (map) {
      try {
        const s1 = map.getSource("route-upcoming");
        const s2 = map.getSource("route-traveled");
        const s3 = map.getSource("route-pulse");
        if (s1) s1.setData(EMPTY_GEO);
        if (s2) s2.setData(EMPTY_GEO);
        if (s3) s3.setData(EMPTY_GEO);
      } catch (_) {}
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

  return { start, pause, toggle, reset };
}
