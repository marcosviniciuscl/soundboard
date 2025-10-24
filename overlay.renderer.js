const { ipcRenderer } = require('electron');
const wheelContainer = document.getElementById('wheelContainer');
const soundMap = {}; // Mapeia a tecla (ex: '1') para o nome do som (ex: 'Risada')

const radius = 200; // Raio do círculo onde os itens serão posicionados
const itemSize = 120; // Diâmetro de cada item

// Calcula a posição (top, left) para cada item do círculo
function calculatePosition(index, totalItems) {
    const angle = (2 * Math.PI / totalItems) * index - (Math.PI / 2); // Começa em cima (-PI/2)
    const x = radius * Math.cos(angle);
    const y = radius * Math.sin(angle);

    // Ajusta para centralizar o item na sua própria área
    const adjustedX = x + (wheelContainer.offsetWidth / 2) - (itemSize / 2);
    const adjustedY = y + (wheelContainer.offsetHeight / 2) - (itemSize / 2);

    return { x: adjustedX, y: adjustedY };
}

ipcRenderer.on('load-sounds', (event, soundList) => {
    // Limpa itens antigos
    const oldItems = document.querySelectorAll('.wheel-item');
    oldItems.forEach(item => item.remove());

    // Pega apenas os 9 primeiros sons
    const displaySounds = soundList.slice(0, 10);
    const totalDisplayItems = displaySounds.length;

    displaySounds.forEach((soundName, index) => {
        const key = (index); // Teclas de 1 a 9
        soundMap[key] = soundName; // Mapeia '1' -> 'Risada'

        const item = document.createElement('div');
        item.className = 'wheel-item';
        item.innerHTML = `<div class="item-key">${key}</div><div class="item-name">${soundName}</div>`;

        // Calcula e aplica a posição
        const { x, y } = calculatePosition(index, totalDisplayItems);
        item.style.left = `${x}px`;
        item.style.top = `${y}px`;

        // Adiciona evento de clique para tocar o som
        item.onclick = () => {
            ipcRenderer.send('play-sound-from-overlay', soundName);
        };

        wheelContainer.appendChild(item);
    });
});

document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        ipcRenderer.send('close-overlay');
        return;
    }

    // Garante que apenas números de 1 a 9 sejam aceitos
    if (e.key >= '0' && e.key <= '9') {
        if (soundMap[e.key]) {
            const soundName = soundMap[e.key];
            ipcRenderer.send('play-sound-from-overlay', soundName);
        }
    }
});