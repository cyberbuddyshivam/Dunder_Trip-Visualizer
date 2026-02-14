import React, { useMemo } from "react";
import { useRouteStore, setState } from "../store";
import { usePlayback } from "../usePlayback";
import { formatMMSS, interpolateRoute, splitRouteAtProgress } from "../utils";

const SPEEDS = [0.25, 0.5, 1, 2, 5];

export default function PlaybackBar() {
  const {
    phase,
    playing,
    playbackSpeed,
    playbackProgress,
    totalPlaybackTime,
    routeCoords,
    _cumDist,
    segmentBoundaries,
    activeSegmentIndex,
  } = useRouteStore();
  const { toggle } = usePlayback();

  const visible = phase === "ready";
  const pct = (playbackProgress * 100).toFixed(2);
  const elapsed = playbackProgress * totalPlaybackTime;

  // Compute visible segment nodes (skip first=0 and last=1, limit to ~10 for clarity)
  const visibleNodes = useMemo(() => {
    if (!segmentBoundaries || segmentBoundaries.length < 3) return [];
    const inner = segmentBoundaries.slice(1, -1);
    // If too many segments, sample evenly
    if (inner.length <= 12) return inner;
    const step = Math.ceil(inner.length / 10);
    return inner.filter((_, i) => i % step === 0);
  }, [segmentBoundaries]);

  // Determine which segment node is "active" (closest passed node to current progress)
  const activeNodeIndex = useMemo(() => {
    if (!visibleNodes.length) return -1;
    let idx = -1;
    for (let i = 0; i < visibleNodes.length; i++) {
      if (playbackProgress >= visibleNodes[i]) idx = i;
    }
    return idx;
  }, [visibleNodes, playbackProgress]);

  const handleScrub = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const t = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    setState({ playbackProgress: t });

    // Move traveler marker imperatively
    if (_cumDist && routeCoords.length > 0) {
      const pos = interpolateRoute(routeCoords, _cumDist, t);
      const marker = window.__mapMarkers?.traveler;
      if (marker) marker.setLngLat([pos.lng, pos.lat]);

      // Also update route sources
      const map = window.__mapInstance;
      if (map) {
        const { traveled, upcoming } = splitRouteAtProgress(
          routeCoords,
          _cumDist,
          t,
        );
        try {
          const srcT = map.getSource("route-traveled");
          const srcU = map.getSource("route-upcoming");
          if (srcT && traveled.length >= 2)
            srcT.setData({
              type: "Feature",
              geometry: { type: "LineString", coordinates: traveled },
            });
          if (srcU && upcoming.length >= 2)
            srcU.setData({
              type: "Feature",
              geometry: { type: "LineString", coordinates: upcoming },
            });
        } catch (_) {}
      }
    }
  };

  return (
    <footer className={`playback-bar ${visible ? "" : "hidden"}`}>
      <div className="playback-inner">
        {/* Play button with glow ring when playing */}
        <button
          className={`play-small ${playing ? "playing" : ""}`}
          disabled={!visible}
          onClick={toggle}
        >
          {playing ? (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
              <rect x="6" y="4" width="4" height="16" rx="1" />
              <rect x="14" y="4" width="4" height="16" rx="1" />
            </svg>
          ) : (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
              <polygon points="5 3 19 12 5 21 5 3" />
            </svg>
          )}
        </button>

        {/* Segmented Timeline */}
        <div className="timeline-wrap">
          <div className="timeline-bar" onClick={handleScrub}>
            <div className="timeline-progress" style={{ width: `${pct}%` }} />
            {/* Segment nodes */}
            <div className="timeline-nodes">
              {visibleNodes.map((boundary, i) => {
                const isPassed = playbackProgress >= boundary;
                const isActive =
                  i === activeNodeIndex &&
                  (i + 1 >= visibleNodes.length ||
                    playbackProgress < visibleNodes[i + 1]);
                return (
                  <div
                    key={i}
                    className={`timeline-node ${isPassed ? "passed" : ""} ${isActive ? "active-node" : ""}`}
                    style={{ left: `${(boundary * 100).toFixed(1)}%` }}
                  />
                );
              })}
            </div>
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
