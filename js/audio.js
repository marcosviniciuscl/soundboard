// js/audio.js
import * as state from './state.js';
import { saveConfig } from './config.js';

async function applyVolumeBoost() {
    const boostCheck = document.getElementById('volumeBoostCheck').checked;
     if (boostCheck && !state.isSystemVolumeBoosted) {
        try {
            const currentVolume = await window.electronAPI.getSystemVolume();
            if (currentVolume === null) return;
            state.setOriginalSystemVolume(currentVolume);
            const boostAmount = parseInt(document.getElementById('volumeBoostAmount').value) || 20;
            let newVolume = currentVolume + boostAmount;
            if (newVolume > 100) newVolume = 100;
            await window.electronAPI.setSystemVolume(newVolume);
            state.setIsSystemVolumeBoosted(true);
        } catch (err) { /* ... */ }
    }
}

async function restoreVolumeBoost() {
    if (state.isSystemVolumeBoosted && state.originalSystemVolume !== null) {
        try {
            await window.electronAPI.setSystemVolume(state.originalSystemVolume);
            state.setOriginalSystemVolume(null);
            state.setIsSystemVolumeBoosted(false);
        } catch (err) { /* ... */ }
    }
}

export async function playSound(name) {
    if (state.isNetworkMuted) { console.log('Mudo da rede ativo.'); return; }

    const data = state.config.sounds[name];
    if (!data) return;

    // Stop if same sound is playing
    if (state.currentAudio && state.currentPlayingSoundName === name && !state.currentAudio.paused) {
        state.currentAudio.pause();
        state.currentAudio.currentTime = 0;
        state.currentAudio.src = '';
        state.setCurrentAudio(null);
        state.setCurrentPlayingSoundName(null);
        if (state.stopAudioTimer) clearTimeout(state.stopAudioTimer);
        state.setStopAudioTimer(null);
        await restoreVolumeBoost();
        return;
    }

    // Stop any other playing sound
    if (state.currentAudio) {
        state.currentAudio.pause();
        // ... (clear src, timers etc.)
    }
    await restoreVolumeBoost(); // Restore volume if another sound was boosted

    // Update stats
    try {
        data.playCount = (data.playCount || 0) + 1;
        data.lastPlayed = new Date().toISOString();
        await saveConfig(); // Uses global state.config
    } catch (err) { console.error('Erro ao salvar stats:', err); }

    // Play new sound
    try {
        await applyVolumeBoost();
        const audio = new Audio(data.path);
        state.setCurrentAudio(audio);
        state.setCurrentPlayingSoundName(name);

        const startTime = data.startTime || 0;
        const endTime = data.endTime || 0;
        audio.volume = data.volume !== undefined ? data.volume : 1;
        audio.playbackRate = data.speed !== undefined ? data.speed : 1;
        audio.loop = data.loop || false;
        audio.currentTime = startTime;

        audio.addEventListener('ended', async () => {
            state.setCurrentPlayingSoundName(null);
             // Ensure boost is restored ONLY if this was the sound playing
            if (state.currentAudio === audio) {
               state.setCurrentAudio(null);
               await restoreVolumeBoost();
            }
        });

        const deviceId = state.config.settings.audioDevice || 'default';
        if (deviceId !== 'default') {
            try { await audio.setSinkId(deviceId); }
            catch (err) { /* ... handle sink error, call saveGlobalSettings */ }
        }

        await audio.play(); // Play must be awaited to catch errors

        // End time logic
        if (endTime > startTime && !audio.loop) {
            const durationInMs = (endTime - startTime) * 1000 / audio.playbackRate;
            const timer = setTimeout(async () => {
                 if (state.currentAudio === audio && state.currentPlayingSoundName === name) {
                    audio.pause();
                    audio.currentTime = startTime; // Reset for next play?
                    state.setCurrentPlayingSoundName(null);
                    state.setCurrentAudio(null);
                    await restoreVolumeBoost();
                }
            }, durationInMs);
            state.setStopAudioTimer(timer);
        }
        // Loop end time logic
        if (endTime > startTime && audio.loop) { /* ... timeupdate listener ... */ }

    } catch (error) {
        console.error('Erro ao tocar áudio:', error);
        alert('Erro ao carregar/tocar o áudio.');
        state.setCurrentAudio(null);
        state.setCurrentPlayingSoundName(null);
        await restoreVolumeBoost();
    }
}

export function loadAudioDuration(filePath, callback) {
    const durationEl = document.getElementById('audioDuration');
    if (!durationEl) return;
    durationEl.textContent = 'Carregando duração...';
    try {
        const audio = new Audio(filePath);
        audio.onloadedmetadata = () => { /* ... set text content ... */ if (callback) callback(audio.duration); };
        audio.onerror = () => { durationEl.textContent = 'Erro ao carregar áudio.'; };
    } catch (err) { /* ... set text content ... */ }
}

// Refactor previewSound similarly, ensuring it manages its own audio element (`state.previewAudio`)
// and calls restoreVolumeBoost appropriately.
export async function previewSound(event) {
     if (state.isNetworkMuted) { return; }
     event.preventDefault();
     const button = event.target.closest('button');

     if (state.previewAudio) { // Stop existing preview
        state.previewAudio.pause();
        // ... (clear src, timers etc.)
        state.setPreviewAudio(null);
        button.innerHTML = "▶️ Prévia";
        await restoreVolumeBoost();
        return;
     }

     if (!state.selectedFilePath) { alert('Selecione um arquivo!'); return; }
     if (state.currentAudio) { /* ... stop main audio ... */ } // Also restore boost if needed

     // Get modal settings
     const volume = parseFloat(document.getElementById('soundVolume').value);
     // ... (speed, loop, start, end)

     try {
         await applyVolumeBoost();
         const audio = new Audio(state.selectedFilePath);
         state.setPreviewAudio(audio);
         // ... (set volume, rate, loop, time, sinkId)
         await audio.play();
         button.innerHTML = "⏹️ Parar";
         audio.addEventListener('ended', async () => {
             button.innerHTML = "▶️ Prévia";
             if (state.previewAudio === audio) { // Ensure it's the same audio object
                state.setPreviewAudio(null);
                await restoreVolumeBoost();
             }
         });
         // ... (end time timer logic similar to playSound, calling restoreVolumeBoost)
     } catch (err) {
         console.error('Erro na prévia:', err);
         state.setPreviewAudio(null);
         button.innerHTML = "▶️ Prévia";
         await restoreVolumeBoost();
     }
}