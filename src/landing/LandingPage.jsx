import React, { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import "./LandingPage.css";

export default function LandingPage() {
  const bgRef = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    // Inject the Unicorn Studio embed into the background container
    const container = bgRef.current;
    if (!container) return;

    const wrapper = document.createElement("div");
    wrapper.setAttribute("data-us-project", "iClMKXFy7pwNE41mxRrc");
    wrapper.style.width = "100%";
    wrapper.style.height = "100%";
    container.appendChild(wrapper);

    // Load Unicorn Studio script with improved initialization
    const u = window.UnicornStudio;
    if (u && u.init) {
      if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", function () {
          u.init();
        });
      } else {
        u.init();
      }
    } else {
      window.UnicornStudio = { isInitialized: false };
      const script = document.createElement("script");
      script.src =
        "https://cdn.jsdelivr.net/gh/hiunicornstudio/unicornstudio.js@v2.0.5/dist/unicornStudio.umd.js";
      script.onload = function () {
        if (document.readyState === "loading") {
          document.addEventListener("DOMContentLoaded", function () {
            window.UnicornStudio.init();
          });
        } else {
          window.UnicornStudio.init();
        }
      };
      (document.head || document.body).appendChild(script);
    }

    return () => {
      // Cleanup
      if (container.contains(wrapper)) container.removeChild(wrapper);
    };
  }, []);

  return (
    <div className="landing-page">
      {/* Animated Background */}
      <div className="landing-bg" ref={bgRef} />

      {/* Dark Overlay */}
      <div className="landing-overlay" />

      {/* Content */}
      <div
        className="landing-content"
        style={{
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        {/* Empty spacer for top */}
        <div></div>

        {/* Middle content */}
        <div style={{ textAlign: "center" }}>
          <h1 className="landing-title" style={{ marginBottom: "1.5rem" }}>
            <span className="title-gradient">
              See Every Journey Before It Begins
            </span>
          </h1>

          <p
            className="landing-subtitle"
            style={{ maxWidth: "700px", margin: "0 auto" }}
          >
            An interactive cinematic route visualizer that lets you explore
            real-world paths, watch journeys unfold in motion, and understand
            every segment of your trip with clarity.
            <br />
            <br />
            Plan smarter by experiencing your route visually before you travel.
          </p>
        </div>

        {/* Bottom button */}
        <div style={{ paddingBottom: "3rem" }}>
          <button
            onClick={() => navigate("/map")}
            id="explore-map-btn"
            style={{
              background: "none",
              border: "none",
              color: "white",
              fontSize: "1.2rem",
              cursor: "pointer",
              padding: "0",
              fontWeight: "500",
              letterSpacing: "0.5px",
            }}
          >
            Explore the Map →
          </button>
        </div>
      </div>
    </div>
  );
}
