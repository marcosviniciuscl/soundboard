// js/network.js
import * as state from './state.js';

let networkMuters = new Set();

function updateNetworkMuteStatus() {
    const banner = document.getElementById('networkMuteBanner');
    const isMutedNow = networkMuters.size > 0;

    if (isMutedNow) {
        const mutersList = Array.from(networkMuters).join(', ');
        banner.innerHTML = `🤫 Mudo da rede ativado por: <strong>${mutersList}</strong>`;
        banner.style.display = 'block';
    } else {
        banner.style.display = 'none';
    }
    state.setIsNetworkMuted(isMutedNow); // Update global state
}

export function toggleNetworkMute(checkbox) {
    const command = checkbox.checked ? 'MUTE' : 'UNMUTE';
    // Send command, UI updates on receiving our own broadcast
    window.electronAPI.broadcastCommand(command);
}

export function handleNetworkStatus(message) {
     const user = message.user;
     if (!user) return;

     let changed = false;
     if (message.command === 'MUTE') {
         if (!networkMuters.has(user)) { networkMuters.add(user); changed = true; }
     } else if (message.command === 'UNMUTE') {
         if (networkMuters.has(user)) { networkMuters.delete(user); changed = true; }
     }

     if (changed) {
         updateNetworkMuteStatus();
     }
}