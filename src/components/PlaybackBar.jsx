import React from "react";
import { useRouteStore, setState } from "../store";
import { usePlayback } from "../usePlayback";
import { formatMMSS, interpolateRoute } from "../utils";

const SPEEDS = [1, 2, 5];

export default function PlaybackBar() {
  const {
    phase,
    playing,
    playbackSpeed,
    playbackProgress,
    totalPlaybackTime,
    routeCoords,
    _cumDist,
  } = useRouteStore();
  const { toggle } = usePlayback();

  const visible = phase === "ready";
  const pct = (playbackProgress * 100).toFixed(2);
  const elapsed = playbackProgress * totalPlaybackTime;

  const handleScrub = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const t = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    setState({ playbackProgress: t });

    // Move traveler marker imperatively
    if (_cumDist && routeCoords.length > 0) {
      const pos = interpolateRoute(routeCoords, _cumDist, t);
      const marker = window.__mapLayers?.travelerMarker;
      if (marker) marker.setLatLng([pos.lat, pos.lng]);
    }
  };

  return (
    <footer className={`playback-bar ${visible ? "" : "hidden"}`}>
      <div className="playback-inner">
        {/* Small play button */}
        <button className="play-small" disabled={!visible} onClick={toggle}>
          {playing ? (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
              <rect x="6" y="4" width="4" height="16" />
              <rect x="14" y="4" width="4" height="16" />
            </svg>
          ) : (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
              <polygon points="5 3 19 12 5 21 5 3" />
            </svg>
          )}
        </button>

        {/* Timeline */}
        <div className="timeline-wrap">
          <div className="timeline-bar" onClick={handleScrub}>
            <div className="timeline-progress" style={{ width: `${pct}%` }} />
            <div className="timeline-thumb" style={{ left: `${pct}%` }} />
          </div>
          <div className="timeline-labels">
            <span>{formatMMSS(elapsed)}</span>
            <span>{formatMMSS(totalPlaybackTime)}</span>
          </div>
        </div>

        {/* Speed selector */}
        <div className="speed-selector">
          {SPEEDS.map((s) => (
            <button
              key={s}
              className={`speed-btn ${playbackSpeed === s ? "active" : ""}`}
              onClick={() => setState({ playbackSpeed: s })}
            >
              {s}x
            </button>
          ))}
        </div>
      </div>
    </footer>
  );
}
