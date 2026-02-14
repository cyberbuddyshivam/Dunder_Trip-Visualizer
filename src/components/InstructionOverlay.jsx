import React from "react";
import { useRouteStore } from "../store";

export default function InstructionOverlay() {
  const { phase } = useRouteStore();

  const visible = phase === "idle" || phase === "start-placed";
  const text =
    phase === "start-placed"
      ? "Now click to set your <strong>Destination</strong>"
      : "Click on the map to set your <strong>Start Location</strong>";

  return (
    <div className={`instruction-overlay ${visible ? "" : "hidden"}`}>
      <div className="instruction-card glass-panel">
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none">
          <path
            d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"
            fill="url(#g2)"
          />
          <circle cx="12" cy="9" r="2.5" fill="#fff" />
          <defs>
            <linearGradient id="g2" x1="5" y1="2" x2="19" y2="22">
              <stop stopColor="#3B82F6" />
              <stop offset="1" stopColor="#60A5FA" />
            </linearGradient>
          </defs>
        </svg>
        <p dangerouslySetInnerHTML={{ __html: text }} />
      </div>
    </div>
  );
}
