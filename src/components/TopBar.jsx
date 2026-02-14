import React, { useState, useEffect } from "react";
import { useRouteStore, setState } from "../store";
import { usePlayback } from "../usePlayback";

export default function TopBar() {
  const { phase, playing, routeCoords } = useRouteStore();
  const { toggle, reset } = usePlayback();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const canPlay = phase === "ready" && routeCoords.length > 0;
  const isSelecting = phase === "idle" || phase === "start-placed";

  // Prevent body scroll when mobile menu is open
  useEffect(() => {
    if (isMobileMenuOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isMobileMenuOpen]);

  const handleSelectToggle = () => {
    if (phase === "ready" || phase === "loading") {
      // Reset to allow re-selection
      reset();
    }
    setIsMobileMenuOpen(false);
  };

  const handleReset = () => {
    reset();
    setIsMobileMenuOpen(false);
  };

  const handleTogglePlay = () => {
    toggle();
    setIsMobileMenuOpen(false);
  };

  return (
    <nav id="topbar">
      {/* Desktop Navigation */}
      <div className="topbar-desktop">
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
          <span className="app-title">Cinematic Journey Visualizer</span>
        </div>
        <div className="topbar-right">
          {/* Select Locations toggle */}
          <button
            className={`btn ${isSelecting ? "btn-select-active" : "btn-secondary"}`}
            onClick={handleSelectToggle}
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
              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
              <circle cx="12" cy="10" r="3" />
            </svg>
            {isSelecting
              ? phase === "start-placed"
                ? "Click Destination"
                : "Click Start Point"
              : "Select Locations"}
          </button>
          <button
            className="btn btn-secondary"
            disabled={phase === "idle"}
            onClick={handleReset}
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
            onClick={handleTogglePlay}
          >
            {playing ? (
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="currentColor"
              >
                <rect x="6" y="4" width="4" height="16" />
                <rect x="14" y="4" width="4" height="16" />
              </svg>
            ) : (
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="currentColor"
              >
                <polygon points="5 3 19 12 5 21 5 3" />
              </svg>
            )}
            <span>{playing ? "Pause" : "Play Journey"}</span>
          </button>
        </div>
      </div>

      {/* Mobile Navigation */}
      <div className="topbar-mobile">
        <div className="topbar-mobile-header">
          <div className="topbar-left">
            <div className="logo-icon">
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none">
                <path
                  d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"
                  fill="url(#g1m)"
                />
                <circle cx="12" cy="9" r="2.5" fill="#fff" />
                <defs>
                  <linearGradient id="g1m" x1="5" y1="2" x2="19" y2="22">
                    <stop stopColor="#3B82F6" />
                    <stop offset="1" stopColor="#60A5FA" />
                  </linearGradient>
                </defs>
              </svg>
            </div>
            <span className="app-title-mobile">Journey</span>
          </div>
          <button
            className="mobile-menu-toggle"
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            aria-label="Toggle menu"
          >
            <span className={`hamburger ${isMobileMenuOpen ? "open" : ""}`}>
              <span></span>
              <span></span>
              <span></span>
            </span>
          </button>
        </div>

        {/* Mobile Menu Overlay */}
        <div
          className={`mobile-menu-overlay ${isMobileMenuOpen ? "open" : ""}`}
          onClick={() => setIsMobileMenuOpen(false)}
        >
          <div
            className="mobile-menu-content"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              className={`btn mobile-menu-btn ${isSelecting ? "btn-select-active" : "btn-secondary"}`}
              onClick={handleSelectToggle}
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
                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                <circle cx="12" cy="10" r="3" />
              </svg>
              {isSelecting
                ? phase === "start-placed"
                  ? "Click Destination"
                  : "Click Start Point"
                : "Select Locations"}
            </button>
            <button
              className="btn btn-secondary mobile-menu-btn"
              disabled={phase === "idle"}
              onClick={handleReset}
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
              className="btn btn-primary mobile-menu-btn"
              disabled={!canPlay}
              onClick={handleTogglePlay}
            >
              {playing ? (
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                >
                  <rect x="6" y="4" width="4" height="16" />
                  <rect x="14" y="4" width="4" height="16" />
                </svg>
              ) : (
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                >
                  <polygon points="5 3 19 12 5 21 5 3" />
                </svg>
              )}
              <span>{playing ? "Pause" : "Play Journey"}</span>
            </button>
          </div>
        </div>
      </div>
    </nav>
  );
}
