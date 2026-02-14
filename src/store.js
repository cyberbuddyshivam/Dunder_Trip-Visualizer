/* ═══════════════════════════════════════════════
   Centralized Route Store (pub/sub pattern)
   ═══════════════════════════════════════════════ */
import { useSyncExternalStore, useCallback } from "react";

const initialState = {
  // Locations
  startLatLng: null,
  endLatLng: null,
  startLabel: "",
  endLabel: "",

  // Route data
  routeCoords: [],
  routeDistance: 0,
  routeDuration: 0,
  segments: [],

  // UI phase: 'idle' | 'start-placed' | 'loading' | 'ready'
  phase: "idle",

  // Playback
  playing: false,
  playbackSpeed: 1,
  playbackProgress: 0,
  totalPlaybackTime: 20,

  // Cached cumulative distances (computed once per route)
  _cumDist: null,

  // Cinematic state
  activeSegmentIndex: -1,
  segmentBoundaries: [],
  showSegmentCard: false,
  currentSegmentInfo: null,

  // Raw GeoJSON coords [lng, lat] for map sources
  _rawCoords: [],
};

let state = { ...initialState };
const listeners = new Set();

function emitChange() {
  listeners.forEach((fn) => fn());
}

export function getSnapshot() {
  return state;
}

export function subscribe(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function setState(partial) {
  state = { ...state, ...partial };
  emitChange();
}

export function resetState() {
  state = { ...initialState, _cumDist: null };
  emitChange();
}

/** React hook for consuming the store */
export function useRouteStore() {
  return useSyncExternalStore(subscribe, getSnapshot);
}
