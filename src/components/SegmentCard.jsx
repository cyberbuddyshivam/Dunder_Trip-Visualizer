import React from "react";
import { useRouteStore } from "../store";

export default function SegmentCard() {
  const { showSegmentCard, currentSegmentInfo } = useRouteStore();

  if (!currentSegmentInfo) return null;

  const distText =
    currentSegmentInfo.distance >= 1000
      ? `${(currentSegmentInfo.distance / 1000).toFixed(1)} km`
      : `${Math.round(currentSegmentInfo.distance)} m`;

  return (
    <div className={`segment-card ${showSegmentCard ? "visible" : ""}`}>
      <div className="segment-card-inner glass-panel">
        <div className="segment-card-icon">
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#3B82F6"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M18 8h1a4 4 0 010 8h-1" />
            <path d="M2 8h16v9a4 4 0 01-4 4H6a4 4 0 01-4-4V8z" />
            <line x1="6" y1="1" x2="6" y2="4" />
            <line x1="10" y1="1" x2="10" y2="4" />
            <line x1="14" y1="1" x2="14" y2="4" />
          </svg>
        </div>
        <div className="segment-card-text">
          <span className="segment-card-name">
            {currentSegmentInfo.instruction}
          </span>
          <span className="segment-card-detail">{distText}</span>
        </div>
      </div>
    </div>
  );
}
