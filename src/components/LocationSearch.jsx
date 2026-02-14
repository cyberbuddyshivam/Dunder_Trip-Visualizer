import React, { useState, useRef, useEffect, useCallback } from "react";
import { useRouteStore } from "../store";
import { forwardGeocode } from "../utils";
import { placeStartMarker, placeEndMarkerAndFetch } from "./MapView";

export default function LocationSearch() {
  const { phase, startLabel, endLabel } = useRouteStore();
  const [startQuery, setStartQuery] = useState("");
  const [endQuery, setEndQuery] = useState("");
  const [startResults, setStartResults] = useState([]);
  const [endResults, setEndResults] = useState([]);
  const [focusedField, setFocusedField] = useState(null);
  const debounceRef = useRef(null);
  const panelRef = useRef(null);

  // Show panel when idle or start-placed, hide when loading/ready
  const visible = phase === "idle" || phase === "start-placed";

  // Sync labels from store (when user clicks map instead of typing)
  useEffect(() => {
    if (startLabel && !startQuery) setStartQuery(startLabel);
  }, [startLabel]);
  useEffect(() => {
    if (endLabel && !endQuery) setEndQuery(endLabel);
  }, [endLabel]);

  // Reset inputs when phase returns to idle
  useEffect(() => {
    if (phase === "idle") {
      setStartQuery("");
      setEndQuery("");
      setStartResults([]);
      setEndResults([]);
    }
  }, [phase]);

  // Debounced geocoding search
  const search = useCallback((query, setter) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      if (query.trim().length < 2) {
        setter([]);
        return;
      }
      const results = await forwardGeocode(query);
      setter(results);
    }, 350);
  }, []);

  const handleStartChange = (e) => {
    const v = e.target.value;
    setStartQuery(v);
    search(v, setStartResults);
  };

  const handleEndChange = (e) => {
    const v = e.target.value;
    setEndQuery(v);
    search(v, setEndResults);
  };

  const selectStart = (result) => {
    setStartQuery(result.shortLabel || result.label);
    setStartResults([]);
    placeStartMarker(result.lat, result.lng, result.shortLabel);
  };

  const selectEnd = async (result) => {
    setEndQuery(result.shortLabel || result.label);
    setEndResults([]);
    await placeEndMarkerAndFetch(result.lat, result.lng, result.shortLabel);
  };

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handler = (e) => {
      if (panelRef.current && !panelRef.current.contains(e.target)) {
        setFocusedField(null);
        setStartResults([]);
        setEndResults([]);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div
      ref={panelRef}
      className={`location-search glass-panel ${visible ? "" : "hidden"}`}
    >
      <div className="search-header">
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="var(--accent)"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="11" cy="11" r="8" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
        <span className="search-title">Plan Your Journey</span>
      </div>

      {/* Start Location Input */}
      <div className="search-field">
        <div className="search-field-icon start-icon" />
        <input
          type="text"
          className="search-input"
          placeholder="Start location…"
          value={startQuery}
          onChange={handleStartChange}
          onFocus={() => setFocusedField("start")}
          disabled={phase === "start-placed"}
        />
        {startResults.length > 0 && focusedField === "start" && (
          <ul className="search-dropdown">
            {startResults.map((r, i) => (
              <li key={i} onClick={() => selectStart(r)}>
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="var(--text-muted)"
                  strokeWidth="2"
                >
                  <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                  <circle cx="12" cy="10" r="3" />
                </svg>
                <span>{r.shortLabel || r.label}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Connector line between fields */}
      <div className="search-connector">
        <div className="connector-line" />
      </div>

      {/* End Location Input */}
      <div className="search-field">
        <div className="search-field-icon end-icon" />
        <input
          type="text"
          className="search-input"
          placeholder="Destination…"
          value={endQuery}
          onChange={handleEndChange}
          onFocus={() => setFocusedField("end")}
          disabled={phase === "idle"}
        />
        {endResults.length > 0 && focusedField === "end" && (
          <ul className="search-dropdown">
            {endResults.map((r, i) => (
              <li key={i} onClick={() => selectEnd(r)}>
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="var(--text-muted)"
                  strokeWidth="2"
                >
                  <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                  <circle cx="12" cy="10" r="3" />
                </svg>
                <span>{r.shortLabel || r.label}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <p className="search-hint">
        {phase === "idle"
          ? "Type a place or click the map"
          : "Now enter your destination"}
      </p>
    </div>
  );
}
