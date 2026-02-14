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
    wrapper.setAttribute("data-us-project", "MWCbqmHtekexOxK4fX67");
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
        style={{ justifyContent: "flex-end", paddingBottom: "1.8rem" }}
      >
        <button
          className="landing-cta"
          onClick={() => navigate("/map")}
          id="explore-map-btn"
        >
          Explore the Map
          <span className="cta-arrow">
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="5" y1="12" x2="19" y2="12" />
              <polyline points="12 5 19 12 12 19" />
            </svg>
          </span>
        </button>
      </div>
    </div>
  );
}
