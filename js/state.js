// js/state.js
// Central storage for application state

export let config = { settings: { audioDevice: 'default', soundOrder: [] }, sounds: {} };
export let selectedSound = null;
export let currentView = 'grid';
export let isNetworkMuted = false;
export let selectedFilePath = null; // Primarily for the add/edit modal state
export let currentAudio = null;
export let currentPlayingSoundName = null;
export let previewAudio = null; // Modal preview audio
export let previewStopTimer = null; // Timer for modal preview
export let stopAudioTimer = null; // Timer for main audio playback end time
export let originalSystemVolume = null; // For volume boost
export let isSystemVolumeBoosted = false; // For volume boost

// Functions to update state (optional but good practice)
export function setConfig(newConfig) { config = newConfig; }
export function setSelectedSound(name) { selectedSound = name; }
export function setCurrentView(view) { currentView = view; }
export function setIsNetworkMuted(muted) { isNetworkMuted = muted; }
export function setSelectedFilePath(path) { selectedFilePath = path; }
export function setCurrentAudio(audio) { currentAudio = audio; }
export function setCurrentPlayingSoundName(name) { currentPlayingSoundName = name; }
export function setPreviewAudio(audio) { previewAudio = audio; }
export function setPreviewStopTimer(timer) { previewStopTimer = timer; }
export function setStopAudioTimer(timer) { stopAudioTimer = timer; }
export function setOriginalSystemVolume(volume) { originalSystemVolume = volume; }
export function setIsSystemVolumeBoosted(boosted) { isSystemVolumeBoosted = boosted; }