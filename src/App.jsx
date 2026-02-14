import React from "react";
import TopBar from "./components/TopBar";
import RoutePanel from "./components/RoutePanel";
import MapView from "./components/MapView";
import InstructionOverlay from "./components/InstructionOverlay";
import LoadingOverlay from "./components/LoadingOverlay";
import PlaybackBar from "./components/PlaybackBar";
import SegmentCard from "./components/SegmentCard";
import LocationSearch from "./components/LocationSearch";

export default function App() {
  return (
    <>
      <TopBar />
      <main id="content">
        <RoutePanel />
        <LocationSearch />
        <MapView />
        <SegmentCard />
        <InstructionOverlay />
        <LoadingOverlay />
      </main>
      <PlaybackBar />
    </>
  );
}
