/* ═══════════════════════════════════════════════
   Journey Route Visualizer – Application Logic
   ═══════════════════════════════════════════════ */

(function () {
  "use strict";

  // ─── Centralized State ────────────────────────
  const state = {
    startLatLng: null,
    endLatLng: null,
    startLabel: "",
    endLabel: "",
    routeCoords: [], // decoded polyline coords [{lat,lng}, …]
    routeDistance: 0, // meters
    routeDuration: 0, // seconds
    segments: [], // turn-by-turn steps

    // Map layers
    startMarker: null,
    endMarker: null,
    routeLine: null,
    routeGlow: null,
    travelerMarker: null,

    // Playback
    playing: false,
    playbackSpeed: 1,
    playbackProgress: 0, // 0 → 1
    animFrame: null,
    lastTimestamp: null,
    totalPlaybackTime: 20, // seconds at 1x (scales inversely with speed)
  };

  // ─── DOM References ───────────────────────────
  const $ = (s) => document.querySelector(s);
  const $$ = (s) => document.querySelectorAll(s);

  const dom = {
    map: $("#map"),
    routePanel: $("#routePanel"),
    startLabel: $("#startLabel"),
    endLabel: $("#endLabel"),
    routeDistance: $("#routeDistance"),
    routeDuration: $("#routeDuration"),
    segmentsList: $("#segmentsList"),
    instructionOverlay: $("#instructionOverlay"),
    instructionText: $("#instructionText"),
    loadingOverlay: $("#loadingOverlay"),
    playbackBar: $("#playbackBar"),
    btnPlay: $("#btnPlay"),
    btnReset: $("#btnReset"),
    playIcon: $("#playIcon"),
    pauseIcon: $("#pauseIcon"),
    playLabel: $("#playLabel"),
    btnPlaySmall: $("#btnPlaySmall"),
    playIconSmall: $("#playIconSmall"),
    pauseIconSmall: $("#pauseIconSmall"),
    timelineProgress: $("#timelineProgress"),
    timelineThumb: $("#timelineThumb"),
    timeElapsed: $("#timeElapsed"),
    timeTotal: $("#timeTotal"),
    timelineBar: $(".timeline-bar"),
  };

  // ─── Map Initialization ───────────────────────
  const map = L.map("map", {
    center: [20, 0],
    zoom: 3,
    zoomControl: true,
    attributionControl: true,
  });

  // Light-mode tile layer (CartoDB Positron)
  L.tileLayer(
    "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png",
    {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/">CARTO</a>',
      subdomains: "abcd",
      maxZoom: 20,
    },
  ).addTo(map);

  // ─── Marker Factories ─────────────────────────
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

  // ─── Reverse Geocoding (Nominatim) ────────────
  async function reverseGeocode(lat, lng) {
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=14`,
      );
      const data = await res.json();
      if (data && data.display_name) {
        // shorten to city-level
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

  // ─── Routing via OSRM ─────────────────────────
  async function fetchRoute(startLat, startLng, endLat, endLng) {
    const url = `https://router.project-osrm.org/route/v1/driving/${startLng},${startLat};${endLng},${endLat}?overview=full&geometries=geojson&steps=true`;
    const res = await fetch(url);
    if (!res.ok) throw new Error("Routing API error");
    const data = await res.json();
    if (!data.routes || !data.routes.length) throw new Error("No route found");
    return data.routes[0];
  }

  // ─── Convert GeoJSON coords to Leaflet LatLng ─
  function geoJSONToLatLngs(coords) {
    return coords.map(([lng, lat]) => ({ lat, lng }));
  }

  // ─── Map Click Handler ────────────────────────
  map.on("click", async (e) => {
    const { lat, lng } = e.latlng;

    // --- Set Start ---
    if (!state.startLatLng) {
      state.startLatLng = { lat, lng };
      state.startMarker = L.marker([lat, lng], {
        icon: createIcon("start"),
      }).addTo(map);
      dom.instructionText.innerHTML =
        "Now click to set your <strong>Destination</strong>";
      reverseGeocode(lat, lng).then((label) => {
        state.startLabel = label;
      });
      return;
    }

    // --- Set Destination ---
    if (!state.endLatLng) {
      state.endLatLng = { lat, lng };
      state.endMarker = L.marker([lat, lng], { icon: createIcon("end") }).addTo(
        map,
      );
      dom.instructionOverlay.classList.add("hidden");
      reverseGeocode(lat, lng).then((label) => {
        state.endLabel = label;
      });

      // Fetch route
      dom.loadingOverlay.classList.remove("hidden");
      try {
        const route = await fetchRoute(
          state.startLatLng.lat,
          state.startLatLng.lng,
          state.endLatLng.lat,
          state.endLatLng.lng,
        );
        processRoute(route);
      } catch (err) {
        alert(
          "Could not find a driving route between those points. Please try different locations.",
        );
        resetAll();
      } finally {
        dom.loadingOverlay.classList.add("hidden");
      }
    }
  });

  // ─── Process Route Response ───────────────────
  function processRoute(route) {
    state.routeCoords = geoJSONToLatLngs(route.geometry.coordinates);
    state.routeDistance = route.distance; // meters
    state.routeDuration = route.duration; // seconds

    // Segments
    const legs = route.legs || [];
    state.segments = [];
    legs.forEach((leg) => {
      (leg.steps || []).forEach((step) => {
        if (step.name || step.maneuver) {
          state.segments.push({
            instruction: step.name || "Unnamed road",
            distance: step.distance,
            type: step.maneuver?.type || "",
          });
        }
      });
    });

    // Scale playback time based on distance (min 10s, max 60s at 1x)
    const distKm = state.routeDistance / 1000;
    state.totalPlaybackTime = Math.min(60, Math.max(10, distKm * 0.15));

    drawRoute();
    updatePanel();
    enablePlayback();
  }

  // ─── Draw Route on Map ────────────────────────
  function drawRoute() {
    const coords = state.routeCoords.map((c) => [c.lat, c.lng]);

    // Glow layer
    state.routeGlow = L.polyline(coords, {
      color: "#3B82F6",
      weight: 10,
      opacity: 0.15,
      lineCap: "round",
      lineJoin: "round",
    }).addTo(map);

    // Main route line (animated draw-in)
    state.routeLine = L.polyline([], {
      color: "#3B82F6",
      weight: 4,
      opacity: 0.85,
      lineCap: "round",
      lineJoin: "round",
    }).addTo(map);

    // Animate path drawing
    animateDrawRoute(coords);

    // Fit bounds
    const bounds = L.latLngBounds(coords);
    map.flyToBounds(bounds, { padding: [80, 80], duration: 1.4 });
  }

  function animateDrawRoute(coords) {
    const total = coords.length;
    const drawDuration = 1200; // ms
    let start = null;
    const drawn = [];

    function step(ts) {
      if (!start) start = ts;
      const elapsed = ts - start;
      const progress = Math.min(elapsed / drawDuration, 1);
      const idx = Math.floor(progress * (total - 1));

      // Add coords up to idx
      while (drawn.length <= idx && drawn.length < total) {
        drawn.push(coords[drawn.length]);
      }
      state.routeLine.setLatLngs(drawn);

      if (progress < 1) {
        requestAnimationFrame(step);
      }
    }
    requestAnimationFrame(step);
  }

  // ─── Update Info Panel ────────────────────────
  function updatePanel() {
    dom.startLabel.textContent =
      state.startLabel ||
      `${state.startLatLng.lat.toFixed(4)}, ${state.startLatLng.lng.toFixed(4)}`;
    dom.endLabel.textContent =
      state.endLabel ||
      `${state.endLatLng.lat.toFixed(4)}, ${state.endLatLng.lng.toFixed(4)}`;

    // Distance
    const km = (state.routeDistance / 1000).toFixed(1);
    dom.routeDistance.textContent =
      km > 1 ? `${km} km` : `${Math.round(state.routeDistance)} m`;

    // Duration
    dom.routeDuration.textContent = formatDuration(state.routeDuration);

    // Time total for playback
    dom.timeTotal.textContent = formatMMSS(state.totalPlaybackTime);

    // Segments
    dom.segmentsList.innerHTML = "";
    const segs = state.segments.slice(0, 20); // limit
    segs.forEach((seg) => {
      const li = document.createElement("li");
      li.innerHTML = `<span class="seg-icon"></span>${seg.instruction} <span style="margin-left:auto;color:#94A3B8;font-size:11px;">${(seg.distance / 1000).toFixed(1)} km</span>`;
      dom.segmentsList.appendChild(li);
    });

    // Refresh labels after async geocoding (slight delay)
    setTimeout(() => {
      dom.startLabel.textContent =
        state.startLabel || dom.startLabel.textContent;
      dom.endLabel.textContent = state.endLabel || dom.endLabel.textContent;
    }, 2000);

    // Show panel
    dom.routePanel.classList.remove("hidden");
  }

  // ─── Enable Playback Controls ─────────────────
  function enablePlayback() {
    dom.btnPlay.disabled = false;
    dom.btnReset.disabled = false;
    dom.btnPlaySmall.disabled = false;
    dom.playbackBar.classList.remove("hidden");
  }

  // ─── Playback Engine ──────────────────────────
  function togglePlayback() {
    if (state.playing) {
      pausePlayback();
    } else {
      startPlayback();
    }
  }

  function startPlayback() {
    if (state.routeCoords.length === 0) return;

    // If finished, restart
    if (state.playbackProgress >= 1) {
      state.playbackProgress = 0;
    }

    state.playing = true;
    state.lastTimestamp = null;
    updatePlayIcons(true);

    // Create traveler marker if needed
    if (!state.travelerMarker) {
      state.travelerMarker = L.marker(
        [state.routeCoords[0].lat, state.routeCoords[0].lng],
        { icon: createTravelerIcon(), zIndexOffset: 1000 },
      ).addTo(map);
    }

    state.animFrame = requestAnimationFrame(playbackLoop);
  }

  function pausePlayback() {
    state.playing = false;
    updatePlayIcons(false);
    if (state.animFrame) cancelAnimationFrame(state.animFrame);
  }

  function playbackLoop(timestamp) {
    if (!state.playing) return;
    if (!state.lastTimestamp) state.lastTimestamp = timestamp;

    const dt = (timestamp - state.lastTimestamp) / 1000; // seconds
    state.lastTimestamp = timestamp;

    const effectiveTime = state.totalPlaybackTime / state.playbackSpeed;
    state.playbackProgress += dt / effectiveTime;

    if (state.playbackProgress >= 1) {
      state.playbackProgress = 1;
      pausePlayback();
    }

    // Interpolate position along route
    const pos = interpolateRoute(state.playbackProgress);
    if (state.travelerMarker) {
      state.travelerMarker.setLatLng([pos.lat, pos.lng]);
    }

    // Cinematic pan: gently follow marker
    if (state.playing && state.playbackProgress > 0.02) {
      map.panTo([pos.lat, pos.lng], {
        animate: true,
        duration: 0.4,
        easeLinearity: 0.5,
        noMoveStart: true,
      });
    }

    // Update timeline
    updateTimeline(state.playbackProgress);

    state.animFrame = requestAnimationFrame(playbackLoop);
  }

  function interpolateRoute(t) {
    const coords = state.routeCoords;
    if (coords.length === 0) return { lat: 0, lng: 0 };
    if (t <= 0) return coords[0];
    if (t >= 1) return coords[coords.length - 1];

    // Compute cumulative distances
    if (!state._cumDist) {
      const cum = [0];
      for (let i = 1; i < coords.length; i++) {
        const d = haversine(coords[i - 1], coords[i]);
        cum.push(cum[i - 1] + d);
      }
      state._cumDist = cum;
    }

    const cum = state._cumDist;
    const totalDist = cum[cum.length - 1];
    const targetDist = t * totalDist;

    // Binary search for segment
    let lo = 0,
      hi = cum.length - 1;
    while (lo < hi - 1) {
      const mid = (lo + hi) >> 1;
      if (cum[mid] <= targetDist) lo = mid;
      else hi = mid;
    }

    const segStart = cum[lo];
    const segEnd = cum[hi];
    const segLen = segEnd - segStart;
    const frac = segLen > 0 ? (targetDist - segStart) / segLen : 0;

    return {
      lat: coords[lo].lat + frac * (coords[hi].lat - coords[lo].lat),
      lng: coords[lo].lng + frac * (coords[hi].lng - coords[lo].lng),
    };
  }

  function haversine(a, b) {
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

  // ─── Timeline UI ──────────────────────────────
  function updateTimeline(progress) {
    const pct = (progress * 100).toFixed(2);
    dom.timelineProgress.style.width = pct + "%";
    dom.timelineThumb.style.left = pct + "%";

    const elapsed = progress * state.totalPlaybackTime;
    dom.timeElapsed.textContent = formatMMSS(elapsed);
  }

  // Scrub by clicking
  dom.timelineBar.addEventListener("click", (e) => {
    const rect = dom.timelineBar.getBoundingClientRect();
    const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    state.playbackProgress = pct;
    updateTimeline(pct);

    const pos = interpolateRoute(pct);
    if (state.travelerMarker) {
      state.travelerMarker.setLatLng([pos.lat, pos.lng]);
    }
  });

  // ─── Play/Pause Icons ─────────────────────────
  function updatePlayIcons(isPlaying) {
    dom.playIcon.style.display = isPlaying ? "none" : "block";
    dom.pauseIcon.style.display = isPlaying ? "block" : "none";
    dom.playLabel.textContent = isPlaying ? "Pause" : "Play Journey";
    dom.playIconSmall.style.display = isPlaying ? "none" : "block";
    dom.pauseIconSmall.style.display = isPlaying ? "block" : "none";
  }

  // ─── Format Helpers ───────────────────────────
  function formatDuration(sec) {
    if (sec < 60) return `${Math.round(sec)}s`;
    if (sec < 3600) return `${Math.floor(sec / 60)} min`;
    const h = Math.floor(sec / 3600);
    const m = Math.round((sec % 3600) / 60);
    return `${h}h ${m}m`;
  }

  function formatMMSS(sec) {
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${s.toString().padStart(2, "0")}`;
  }

  // ─── Reset ────────────────────────────────────
  function resetAll() {
    // Stop playback
    pausePlayback();

    // Remove layers
    if (state.startMarker) {
      map.removeLayer(state.startMarker);
    }
    if (state.endMarker) {
      map.removeLayer(state.endMarker);
    }
    if (state.routeLine) {
      map.removeLayer(state.routeLine);
    }
    if (state.routeGlow) {
      map.removeLayer(state.routeGlow);
    }
    if (state.travelerMarker) {
      map.removeLayer(state.travelerMarker);
    }

    // Reset state
    Object.assign(state, {
      startLatLng: null,
      endLatLng: null,
      startLabel: "",
      endLabel: "",
      routeCoords: [],
      routeDistance: 0,
      routeDuration: 0,
      segments: [],
      startMarker: null,
      endMarker: null,
      routeLine: null,
      routeGlow: null,
      travelerMarker: null,
      playing: false,
      playbackProgress: 0,
      animFrame: null,
      lastTimestamp: null,
      _cumDist: null,
    });

    // Reset UI
    dom.routePanel.classList.add("hidden");
    dom.playbackBar.classList.add("hidden");
    dom.btnPlay.disabled = true;
    dom.btnReset.disabled = true;
    dom.btnPlaySmall.disabled = true;
    dom.instructionOverlay.classList.remove("hidden");
    dom.instructionText.innerHTML =
      "Click on the map to set your <strong>Start Location</strong>";
    updateTimeline(0);
    updatePlayIcons(false);

    // Reset map view
    map.flyTo([20, 0], 3, { duration: 1 });
  }

  // ─── Event Listeners ──────────────────────────
  dom.btnPlay.addEventListener("click", togglePlayback);
  dom.btnPlaySmall.addEventListener("click", togglePlayback);
  dom.btnReset.addEventListener("click", resetAll);

  // Speed selector
  $$(".speed-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      $$(".speed-btn").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      state.playbackSpeed = Number(btn.dataset.speed);
    });
  });

  // Keyboard shortcuts
  document.addEventListener("keydown", (e) => {
    if (e.code === "Space" && state.routeCoords.length > 0) {
      e.preventDefault();
      togglePlayback();
    }
  });
})();
