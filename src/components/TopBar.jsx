import React from "react";
import { useRouteStore, setState } from "../store";
import { usePlayback } from "../usePlayback";

export default function TopBar() {
  const { phase, playing, routeCoords } = useRouteStore();
  const { toggle, reset } = usePlayback();

  const canPlay = phase === "ready" && routeCoords.length > 0;

  return (
    <nav id="topbar">
      <div className="topbar-left">
        <div className="logo-icon">
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none">
            <path
              d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"
              fill="url(#g1)"
            />
            <circle cx="12" cy="9" r="2.5" fill="#fff" />
            <defs>
              <linearGradient id="g1" x1="5" y1="2" x2="19" y2="22">
                <stop stopColor="#3B82F6" />
                <stop offset="1" stopColor="#60A5FA" />
              </linearGradient>
            </defs>
          </svg>
        </div>
        <span className="app-title">Journey Route Visualizer</span>
      </div>
      <div className="topbar-right">
        <button
          className="btn btn-secondary"
          disabled={phase === "idle"}
          onClick={reset}
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="1 4 1 10 7 10" />
            <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
          </svg>
          Reset Route
        </button>
        <button
          className="btn btn-primary"
          disabled={!canPlay}
          onClick={toggle}
        >
          {playing ? (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <rect x="6" y="4" width="4" height="16" />
              <rect x="14" y="4" width="4" height="16" />
            </svg>
          ) : (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <polygon points="5 3 19 12 5 21 5 3" />
            </svg>
          )}
          <span>{playing ? "Pause" : "Play Journey"}</span>
        </button>
      </div>
    </nav>
  );
}
