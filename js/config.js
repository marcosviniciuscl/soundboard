// js/config.js
import * as state from './state.js';
import { renderSounds } from './ui.js'; // Needed after load/import

export async function loadConfig() {
    let loadedConfig = await window.electronAPI.loadConfig();

    // Ensure defaults and structure
    if (!loadedConfig.settings) loadedConfig.settings = { audioDevice: 'default' };
    if (!loadedConfig.sounds) loadedConfig.sounds = {};
    const soundKeys = Object.keys(loadedConfig.sounds);
    if (!loadedConfig.settings.soundOrder) {
        loadedConfig.settings.soundOrder = soundKeys;
    } else {
        // Synchronize soundOrder with actual sounds
        loadedConfig.settings.soundOrder = loadedConfig.settings.soundOrder.filter(name => loadedConfig.sounds[name]);
        soundKeys.forEach(name => {
            if (!loadedConfig.settings.soundOrder.includes(name)) {
                loadedConfig.settings.soundOrder.push(name);
            }
        });
    }
    // Ensure other settings defaults
     loadedConfig.settings.overlayHotkey = loadedConfig.settings.overlayHotkey || 'CommandOrControl+Shift+Space';
     loadedConfig.settings.volumeBoostEnabled = loadedConfig.settings.volumeBoostEnabled || false;
     loadedConfig.settings.volumeBoostAmount = loadedConfig.settings.volumeBoostAmount || 20;

    state.setConfig(loadedConfig); // Update global state

    // Update UI elements tied to config
    document.getElementById('audioOutputSelect').value = state.config.settings.audioDevice || 'default';
    document.getElementById('volumeBoostCheck').checked = state.config.settings.volumeBoostEnabled;
    document.getElementById('volumeBoostAmount').value = state.config.settings.volumeBoostAmount;

    await loadAudioDevices(); // Load devices after config is known
}

export async function saveConfig() {
    await window.electronAPI.saveConfig(state.config);
    // Assuming the main process handles the configUpdated notification internally now
    // window.electronAPI.configUpdated(state.config);
}

export async function saveGlobalSettings() {
    state.config.settings.audioDevice = document.getElementById('audioOutputSelect').value;
    state.config.settings.volumeBoostEnabled = document.getElementById('volumeBoostCheck').checked;
    state.config.settings.volumeBoostAmount = parseInt(document.getElementById('volumeBoostAmount').value) || 20;
    await saveConfig();
}

export async function loadAudioDevices() {
    const select = document.getElementById('audioOutputSelect');
    select.innerHTML = '<option value="default">Padrão do Sistema</option>';
    try {
        await navigator.mediaDevices.getUserMedia({ audio: true });
        const devices = await navigator.mediaDevices.enumerateDevices();
        const audioDevices = devices.filter(device => device.kind === 'audiooutput');
        audioDevices.forEach(device => {
            if (device.deviceId === 'default' || device.deviceId === 'communications') return;
            const option = document.createElement('option');
            option.value = device.deviceId;
            option.textContent = device.label || `Dispositivo ${select.options.length}`;
            select.appendChild(option);
        });
        // Restore selection after loading
        select.value = state.config.settings.audioDevice || 'default';
    } catch (err) {
        console.error('Erro ao listar/configurar dispositivos de áudio:', err);
         if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
             alert('Por favor, permita o acesso ao microfone nas configurações do seu sistema/navegador para listar os dispositivos de áudio.');
         }
    }
}

export async function exportProfile() {
    const status = await window.electronAPI.exportProfile();
    alert(status.message);
}

export async function importProfile() {
    const status = await window.electronAPI.importProfile();
    if (status.message) {
        alert(status.message);
    }
    // If successful, main process reloads the window, no need to call loadConfig here
}

export async function saveOverlayHotkey(newHotkey) {
     if (!newHotkey) { alert('O atalho não pode ser vazio.'); return; }
     try {
         const result = await window.electronAPI.updateOverlayHotkey(newHotkey);
         if (result.success) {
             state.config.settings.overlayHotkey = newHotkey; // Update local state copy
             alert('Atalho do overlay atualizado com sucesso!');
         } else { alert('Erro: ' + result.message); }
     } catch (err) { /* ... */ alert('Erro de comunicação...'); }
}