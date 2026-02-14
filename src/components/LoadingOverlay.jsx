import React from "react";
import { useRouteStore } from "../store";

export default function LoadingOverlay() {
  const { phase } = useRouteStore();
  const visible = phase === "loading";

  return (
    <div className={`loading-overlay ${visible ? "" : "hidden"}`}>
      <div className="loading-card glass-panel">
        <div className="spinner" />
        <p>Calculating route…</p>
      </div>
    </div>
  );
}
