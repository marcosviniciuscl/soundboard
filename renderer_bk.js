// renderer.js
import * as state from './js/state.js';
import { loadConfig, saveConfig, saveGlobalSettings, importProfile, exportProfile } from './js/config.js';
import { renderSounds, toggleView, selectSoundCard, openAddModal, openEditModal, closeAddModal, selectFileAndUpdateState, showUpdateNotification } from './js/ui.js';
import { playSound, previewSound } from './js/audio.js';
import { handleNetworkStatus, toggleNetworkMute } from './js/network.js';
import { clearHotkey } from './js/hotkey.js'; // Import clearHotkey

// --- Initialization ---
async function init() {
    await loadConfig(); // Loads config into state.config
    renderSounds(state.config, state.currentView, state.selectedSound); // Initial render

    setupEventListeners();
    setupBackendListeners();
}

// --- Setup UI Event Listeners ---
function setupEventListeners() {
    // Main Controls
    document.querySelector('.btn-add').onclick = openAddModal;
    document.querySelector('.btn-edit').onclick = openEditModal; // Needs selectedSound from state
    document.querySelector('.btn-remove').onclick = removeSound; // Needs selectedSound from state
    document.querySelector('.btn-test').onclick = testSelected; // Needs selectedSound from state
    document.querySelector('#viewToggleButton').onclick = () => {
        state.setCurrentView(toggleView(state.config, state.currentView));
    };
    document.querySelector('.btn-import').onclick = importProfile; // Assuming class name
    document.querySelector('.btn-export').onclick = exportProfile; // Assuming class name
    document.querySelector('#networkMuteCheck').onchange = (e) => toggleNetworkMute(e.target);
    document.querySelector('#audioOutputSelect').onchange = saveGlobalSettings;
    document.querySelector('#volumeBoostCheck').onchange = saveGlobalSettings;
    document.querySelector('#volumeBoostAmount').onchange = saveGlobalSettings;

    // Add/Edit Modal Controls
    document.querySelector('#addModal .btn-save').onclick = handleSaveSound; // Connect save button
    document.querySelector('#addModal .btn-cancel').onclick = closeAddModal; // Connect cancel button
    document.querySelector('#addModal .btn-preview').onclick = previewSound; // Connect preview button
    document.querySelector('#addModal .btn-file-select').onclick = selectFileAndUpdateState; // Connect file select
    document.querySelector('#addModal .btn-clear-hotkey').onclick = clearHotkey; // Connect clear hotkey

    // Close modal on outside click
    window.onclick = (event) => {
        const addModal = document.getElementById('addModal');
        // const searchModal = document.getElementById('searchModal'); // If you add it back
        if (event.target === addModal) closeAddModal();
        // if (event.target === searchModal) closeSearchModal();
    };

    // Global key listeners (Escape for modal, potentially others)
    document.addEventListener('keydown', handleGlobalKeyDown);

    // Device change listener
    navigator.mediaDevices.ondevicechange = handleDeviceChange;

    // Notification restart button
    document.getElementById('restartButton').onclick = () => window.electronAPI.restartApp();
}

// --- Setup Backend Event Listeners (via Preload API) ---
function setupBackendListeners() {
    window.electronAPI.onNetworkStatus((message) => {
        handleNetworkStatus(message);
    });

    window.electronAPI.onPlaySound((name) => {
        // Need to potentially update selection state here if triggered externally?
        playSound(name); // Assumes playSound reads global state
    });

    window.electronAPI.onGetSoundList(() => {
        const orderedSoundNames = state.config.settings.soundOrder || [];
        window.electronAPI.sendSoundList(orderedSoundNames);
    });

    window.electronAPI.onceUpdateAvailable(() => showUpdateNotification('available'));
    window.electronAPI.onceUpdateDownloaded(() => showUpdateNotification('downloaded'));

    // Listener for config updates from main process (if needed)
    // window.electronAPI.onConfigUpdated((newConfig) => {
    //    state.setConfig(newConfig);
    //    renderSounds(state.config, state.currentView, state.selectedSound);
    // });
}

// --- Helper Functions / Event Handlers ---

function handleGlobalKeyDown(e) {
    const addModalVisible = document.getElementById('addModal').style.display === 'block';

    if (e.key === 'Escape') {
        if (addModalVisible) closeAddModal();
        // Close other modals if any
    }

    // Enter key in modal (ensure not capturing hotkey)
    // Needs access to isCapturingHotkey state - maybe move this logic?
    // if (e.key === 'Enter' && addModalVisible && !isCapturingHotkey) {
    //      handleSaveSound();
    // }
}

async function handleDeviceChange() {
    console.log('Dispositivos de mídia mudaram! Recarregando lista de áudio...');
    const select = document.getElementById('audioOutputSelect');
    const oldValue = select.value;
    await loadAudioDevices(); // This function now correctly uses state.config.settings.audioDevice
    // Try to restore previous selection
    if (Array.from(select.options).some(opt => opt.value === oldValue)) {
        select.value = oldValue;
    } else {
        select.value = 'default';
        await saveGlobalSettings(); // Save the default if previous device disappeared
    }
}

// Needs selectedSound from state
function testSelected() {
    if (!state.selectedSound) { alert('Selecione um som!'); return; }
    playSound(state.selectedSound);
}

// Needs selectedSound from state
async function removeSound() {
     if (!state.selectedSound) { alert('Selecione um som!'); return; }
     if (confirm(`Remover "${state.selectedSound}"?`)) {
         delete state.config.sounds[state.selectedSound];
         state.config.settings.soundOrder = state.config.settings.soundOrder.filter(name => name !== state.selectedSound);
         await saveConfig();
         state.setSelectedSound(null); // Clear selection
         renderSounds(state.config, state.currentView, state.selectedSound);
     }
}

// Handles saving from the Add/Edit modal
async function handleSaveSound() {
    const nameInput = document.getElementById('soundName');
    const hotkeyInput = document.getElementById('soundHotkey');
    const originalName = document.getElementById('originalSoundName').value;
    // ... get all other values from modal inputs ...
    const volume = parseFloat(document.getElementById('soundVolume').value);
    // ... etc.

    const name = nameInput.value.trim();
    const hotkey = hotkeyInput.value.trim();

    if (!name) { alert('Nome é obrigatório!'); return; }
    if (!hotkey) { alert('Atalho é obrigatório!'); return; }
    if (!state.selectedFilePath) { alert('Arquivo de áudio é obrigatório!'); return; } // Use state variable

    if (name !== originalName && state.config.sounds[name]) {
        alert(`Nome "${name}" já existe!`);
        return;
    }

    // Get existing stats if editing
    let stats = { playCount: 0, lastPlayed: null };
    if (originalName && state.config.sounds[originalName]) {
        stats.playCount = state.config.sounds[originalName].playCount || 0;
        stats.lastPlayed = state.config.sounds[originalName].lastPlayed || null;
    }

    // Update soundOrder if name changed or new sound
    if (originalName) {
        if (originalName !== name) { // Renamed
            delete state.config.sounds[originalName];
            const index = state.config.settings.soundOrder.indexOf(originalName);
            if (index > -1) state.config.settings.soundOrder[index] = name;
        }
    } else { // New sound
        state.config.settings.soundOrder.push(name);
    }

    // Add/Update sound object
    state.config.sounds[name] = {
        path: state.selectedFilePath, // Use state variable
        hotkey: hotkey,
        volume: volume,
        // ... (speed, loop, start, end)
        playCount: stats.playCount,
        lastPlayed: stats.lastPlayed
    };

    await saveConfig();
    state.setSelectedSound(name); // Update selection to the new/edited sound
    renderSounds(state.config, state.currentView, state.selectedSound);
    closeAddModal(); // Close modal on success
}

// --- Start the App ---
document.addEventListener('DOMContentLoaded', init);