// preload.js

// O preload pode acessar o 'require' (o lado da "Casa")
const { contextBridge, ipcRenderer } = require('electron');
const path = require('path');
const Sortable = require('sortablejs');

// O 'contextBridge' é a ferramenta para criar os botões do interfone
contextBridge.exposeInMainWorld(
  'electronAPI', // Este será o nome do seu interfone: 'window.electronAPI'
  {
    // --- Botões de "Pedir e Esperar" (Invoke) ---
    // Quando o Visitante chamar 'window.electronAPI.loadConfig()'...
    loadConfig: () => ipcRenderer.invoke('load-config'),
    // ...o interfone vai (de forma segura) chamar 'ipcRenderer.invoke('load-config')'
    saveConfig: (config) => ipcRenderer.invoke('save-config', config),
    selectAudioFile: () => ipcRenderer.invoke('select-audio-file'),
    getSystemVolume: () => ipcRenderer.invoke('get-system-volume'),
    setSystemVolume: (vol) => ipcRenderer.invoke('set-system-volume', vol),
    exportProfile: () => ipcRenderer.invoke('export-profile'),
    importProfile: () => ipcRenderer.invoke('import-profile'),
    updateOverlayHotkey: (hotkey) => ipcRenderer.invoke('update-overlay-hotkey', hotkey),

    // --- ADICIONADO ---
    copyAudioFileToData: (originalPath) => ipcRenderer.invoke('copy-audio-file', originalPath),
    deleteAudioFile: (filePath) => ipcRenderer.invoke('delete-audio-file', filePath),
    // --- FIM DA ADIÇÃO ---

    // --- Botões de "Avisar" (Send) ---
    broadcastCommand: (cmd) => ipcRenderer.send('broadcast-network-command', cmd),
    sendSoundList: (sound) => ipcRenderer.send('sound-list', sound),
    restartApp: () => ipcRenderer.send('restart-app'),
    configUpdated: () => ipcRenderer.send('config-updated'),

    // --- "Luzes de Aviso" (Ouvintes 'On') ---
    // Permite ao Visitante 'observar' um evento de forma segura
    onPlaySound: (callback) => ipcRenderer.on('play-sound', (event, ...args) => callback(...args)),
    onNetworkStatus: (callback) => ipcRenderer.on('network-status', (event, ...args) => callback(...args)),
    onGetSoundList: (callback) => ipcRenderer.on('get-sound-list', (event, ...args) => callback(...args)),
    onUpdateAvailable: (callback) => ipcRenderer.on('update-available', (event, ...args) => callback(...args)),
    onUpdateDownloaded: (callback) => ipcRenderer.on('update-downloaded', (event, ...args) => callback(...args)),

    onceUpdateAvailable: (callback) => ipcRenderer.once('update-available', (event, ...args) => callback(...args)),
    onceUpdateDownloaded: (callback) => ipcRenderer.once('update-downloaded', (event, ...args) => callback(...args)),

    basename: (p) => path.basename(p),
    Sortable: {
      create: (el, options) => {
        return Sortable.create(el, options);
      }
    }
  }
);