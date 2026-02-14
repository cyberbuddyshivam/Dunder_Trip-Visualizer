import React, { useEffect, useRef } from "react";
import { useRouteStore } from "../store";
import { formatDuration } from "../utils";

export default function RoutePanel() {
  const {
    phase,
    startLabel,
    endLabel,
    startLatLng,
    endLatLng,
    routeDistance,
    routeDuration,
    segments,
    activeSegmentIndex,
    playbackProgress,
  } = useRouteStore();

  const visible = phase === "ready";
  const km = (routeDistance / 1000).toFixed(1);
  const distText = km > 1 ? `${km} km` : `${Math.round(routeDistance)} m`;

  // Refs for auto-scrolling active segment
  const segmentRefs = useRef({});
  const timelineContainerRef = useRef(null);

  // Auto-scroll active segment into view
  useEffect(() => {
    if (activeSegmentIndex >= 0 && segmentRefs.current[activeSegmentIndex]) {
      segmentRefs.current[activeSegmentIndex].scrollIntoView({
        behavior: "smooth",
        block: "nearest",
        inline: "nearest",
      });
    }
  }, [activeSegmentIndex]);

  return (
    <aside className={`glass-panel route-panel ${visible ? "" : "hidden"}`}>
      <h3 className="panel-title">Route Details</h3>

      <div className="info-row">
        <div className="info-icon start-dot" />
        <div className="info-text">
          <span className="info-label">Start</span>
          <span className="info-value">
            {startLabel ||
              (startLatLng
                ? `${startLatLng.lat.toFixed(4)}, ${startLatLng.lng.toFixed(4)}`
                : "—")}
          </span>
        </div>
      </div>

      <div className="info-row">
        <div className="info-icon end-dot" />
        <div className="info-text">
          <span className="info-label">Destination</span>
          <span className="info-value">
            {endLabel ||
              (endLatLng
                ? `${endLatLng.lat.toFixed(4)}, ${endLatLng.lng.toFixed(4)}`
                : "—")}
          </span>
        </div>
      </div>

      <div className="divider" />

      <div className="stats-grid">
        <div className="stat-card">
          <span className="stat-number">{visible ? distText : "—"}</span>
          <span className="stat-label">Distance</span>
        </div>
        <div className="stat-card">
          <span className="stat-number">
            {visible ? formatDuration(routeDuration) : "—"}
          </span>
          <span className="stat-label">Est. Time</span>
        </div>
      </div>

      <div className="divider" />

      <h4 className="panel-subtitle">Route Segments</h4>
      <div className="timeline-container" ref={timelineContainerRef}>
        {segments.slice(0, 15).map((seg, i) => {
          const isActive = activeSegmentIndex === i;
          const isCompleted = activeSegmentIndex > i;
          const segmentProgress = (seg.distance / routeDistance) * 100;

          return (
            <div
              key={i}
              ref={(el) => (segmentRefs.current[i] = el)}
              className={`timeline-segment ${
                isActive ? "active" : isCompleted ? "completed" : "upcoming"
              }`}
            >
              <div className="timeline-node-wrapper">
                <div className="timeline-node">
                  {isCompleted && (
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none">
                      <path
                        d="M5 12l5 5L20 7"
                        stroke="currentColor"
                        strokeWidth="3"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  )}
                </div>
                {i < segments.length - 1 && <div className="timeline-line" />}
              </div>
              <div className="segment-card-timeline">
                <div className="segment-name">{seg.instruction}</div>
                <div className="segment-meta">
                  {(seg.distance / 1000).toFixed(1)} km •{" "}
                  {Math.ceil(seg.duration / 60)} min
                </div>
                <div className="segment-progress-bar">
                  <div
                    className="segment-progress-fill"
                    style={{ width: `${Math.min(segmentProgress * 2, 100)}%` }}
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </aside>
  );
}
