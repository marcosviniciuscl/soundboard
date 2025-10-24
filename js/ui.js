// js/ui.js (Continued)
import { basename, formatLastPlayed } from './utils.js';
import * as state from '../renderer_bk.js'; // Assuming state is exported from renderer for now
import { setupHotkeyCapture, clearHotkey, removeHotkeyCaptureListener } from './hotkey.js';
import { previewSound, loadAudioDuration } from './audio.js'; // Make sure loadAudioDuration is exported

export function updateSliderLabels() { /* ... code ... */ }

export function openAddModal() {
    document.getElementById('modalTitle').textContent = 'Adicionar Novo Som';
    document.getElementById('originalSoundName').value = '';
    // ... (reset all form fields: name, hotkey, file, duration, sliders, checkbox)
    state.setSelectedFilePath(null); // Use state setter
    updateSliderLabels();
    setupHotkeyCapture(); // Attach listener
    document.getElementById('addModal').style.display = 'block';
    document.getElementById('soundName').focus(); // Focus the first field
}

export function openEditModal() {
    if (!state.selectedSound || !state.config.sounds[state.selectedSound]) {
        alert('Selecione um som para editar!');
        return;
    }
    const data = state.config.sounds[state.selectedSound];

    document.getElementById('modalTitle').textContent = 'Editar Som';
    document.getElementById('originalSoundName').value = state.selectedSound;
    document.getElementById('soundName').value = state.selectedSound;
    document.getElementById('soundHotkey').value = data.hotkey;
    document.getElementById('fileName').textContent = basename(data.path); // Use util
    state.setSelectedFilePath(data.path); // Use state setter

    loadAudioDuration(data.path); // Use audio module function

    // ... (set sliders, checkbox based on data)
    updateSliderLabels();
    setupHotkeyCapture(); // Attach listener
    document.getElementById('addModal').style.display = 'block';
    document.getElementById('soundName').focus();
}

export function closeAddModal() {
    if (state.previewAudio) {
        state.previewAudio.pause();
        state.previewAudio.src = '';
        state.setPreviewAudio(null);
        if (state.previewStopTimer) clearTimeout(state.previewStopTimer);
        state.setPreviewStopTimer(null);
         // Restore boost if preview was playing? Needs careful handling
         // Maybe previewSound should always call restoreVolumeBoost on stop/end
    }
    document.getElementById('addModal').style.display = 'none';
    state.setSelectedFilePath(null);
    document.getElementById('originalSoundName').value = '';
    document.getElementById('audioDuration').textContent = '';
    removeHotkeyCaptureListener(); // Detach listener
}

// selectFile needs to update the state variable
export async function selectFileAndUpdateState() {
    const filePath = await window.electronAPI.selectAudioFile();
    if (filePath) {
        state.setSelectedFilePath(filePath); // Update global state
        document.getElementById('fileName').textContent = basename(filePath);
        loadAudioDuration(filePath, (duration) => {
            const endTimeInput = document.getElementById('soundEndTime');
            if (endTimeInput && parseFloat(endTimeInput.value) === 0) {
                 endTimeInput.value = duration.toFixed(2);
            }
        });
    }
}

// Add functions for notification banner if needed
export function showUpdateNotification(type) {
    const notification = document.getElementById('notification');
    const message = document.getElementById('notificationMessage');
    const restartButton = document.getElementById('restartButton');
    if (!notification || !message || !restartButton) return;

    if (type === 'available') {
        message.innerText = 'Uma nova atualização está sendo baixada...';
        restartButton.style.display = 'none';
        notification.classList.add('show');
    } else if (type === 'downloaded') {
        message.innerText = 'Atualização pronta! Reiniciar agora para instalar?';
        restartButton.style.display = 'flex';
        notification.classList.add('show');
    }
}