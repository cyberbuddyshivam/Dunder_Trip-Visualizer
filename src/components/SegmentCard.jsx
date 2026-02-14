import React from "react";
import { useRouteStore } from "../store";
import { formatDuration } from "../utils";

export default function SegmentCard() {
  const { showSegmentCard, currentSegmentInfo } = useRouteStore();

  if (!currentSegmentInfo) return null;

  const distText =
    currentSegmentInfo.distance >= 1000
      ? `${(currentSegmentInfo.distance / 1000).toFixed(1)} km`
      : `${Math.round(currentSegmentInfo.distance)} m`;

  const timeText = formatDuration(currentSegmentInfo.duration);

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
            <path d="M12 2L19 21 12 17 5 21 12 2z" />
          </svg>
        </div>
        <div className="segment-card-text">
          <span className="segment-card-name">
            {currentSegmentInfo.instruction}
          </span>
          <div className="segment-card-meta">
            <span className="segment-card-detail">{distText}</span>
            <span className="segment-card-divider">·</span>
            <span className="segment-card-detail">{timeText}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
