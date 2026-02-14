import React from "react";
import TopBar from "./components/TopBar";
import RoutePanel from "./components/RoutePanel";
import MapView from "./components/MapView";
import InstructionOverlay from "./components/InstructionOverlay";
import LoadingOverlay from "./components/LoadingOverlay";
import PlaybackBar from "./components/PlaybackBar";

export default function App() {
  return (
    <>
      <TopBar />
      <main id="content">
        <RoutePanel />
        <MapView />
        <InstructionOverlay />
        <LoadingOverlay />
      </main>
      <PlaybackBar />
    </>
  );
}
