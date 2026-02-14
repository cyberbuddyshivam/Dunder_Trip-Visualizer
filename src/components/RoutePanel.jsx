import React from "react";
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
  } = useRouteStore();

  const visible = phase === "ready";
  const km = (routeDistance / 1000).toFixed(1);
  const distText = km > 1 ? `${km} km` : `${Math.round(routeDistance)} m`;

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
      <ul className="segments-list">
        {segments.slice(0, 20).map((seg, i) => (
          <li key={i}>
            <span className="seg-icon" />
            {seg.instruction}
            <span
              style={{ marginLeft: "auto", color: "#94A3B8", fontSize: 11 }}
            >
              {(seg.distance / 1000).toFixed(1)} km
            </span>
          </li>
        ))}
      </ul>
    </aside>
  );
}
