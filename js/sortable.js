// js/sortable.js
import { saveConfig } from './config.js';
import * as state from './state.js';

let sortableInstance = null;

export function initTableSortable() {
    if (sortableInstance) {
        sortableInstance.destroy();
        sortableInstance = null;
    }
    const tableBody = document.querySelector('.sounds-table tbody');
    if (!tableBody) return;

    sortableInstance = window.electronAPI.Sortable.create(tableBody, {
        ghostClass: 'sortable-ghost',
        animation: 150,
        onEnd: async (evt) => {
            const movedSoundName = state.config.settings.soundOrder.splice(evt.oldIndex, 1)[0];
            state.config.settings.soundOrder.splice(evt.newIndex, 0, movedSoundName);
            await saveConfig(); // saveConfig uses the global state.config
        }
    });
}

export function destroySortable() {
    if (sortableInstance) {
        sortableInstance.destroy();
        sortableInstance = null;
    }
}