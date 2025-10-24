// const { ipcRenderer } = require('electron');
// const path = require('path');
// const Sortable = require('sortablejs');

let config = { settings: { audioDevice: 'default', soundOrder: [] }, sounds: {} };

let selectedSound = null;
let selectedFilePath = null;
let currentAudio = null;
let currentPlayingSoundName = null;
let previewAudio = null;
let previewStopTimer = null;
let isCapturingHotkey = false;
let capturedKeys = new Set();
let stopAudioTimer = null;
let currentView = 'grid';
let originalSystemVolume = null;
let isSystemVolumeBoosted = false;
let sortableInstance = null;
let isNetworkMuted = false;
let networkMuteInterval = null;


async function loadConfig() {
    config = await window.electronAPI.loadConfig();

    if (!config.settings) config.settings = { audioDevice: 'default' };
    if (!config.sounds) config.sounds = {};


    const soundKeys = Object.keys(config.sounds);

    if (!config.settings.soundOrder) {
        config.settings.soundOrder = soundKeys;
        console.log('Array soundOrder criado pela primeira vez.');
    } else {
        config.settings.soundOrder = config.settings.soundOrder.filter(name => config.sounds[name]);

        soundKeys.forEach(name => {
            if (!config.settings.soundOrder.includes(name)) {
                config.settings.soundOrder.push(name);
            }
        });
    }

    await loadAudioDevices();
    const savedDevice = config.settings.audioDevice || 'default';
    document.getElementById('audioOutputSelect').value = savedDevice;

    // --- MUDANÇA: Carrega as novas configurações ---
    document.getElementById('volumeBoostCheck').checked = config.settings.volumeBoostEnabled || false;
    document.getElementById('volumeBoostAmount').value = config.settings.volumeBoostAmount || 20;
    // --- Fim da mudança ---

    renderSounds();
}

async function saveConfig() {
    await window.electronAPI.saveConfig(config);
    window.electronAPI.configUpdated(config);
}

function toggleView() {
    const gridContainer = document.getElementById('soundsContainer');
    const tableContainer = document.getElementById('tableContainer');
    const toggleButton = document.getElementById('viewToggleButton');
    const tableInfo = document.getElementById('tableOrderInfo');

    if (currentView === 'grid') {
        currentView = 'table';
        toggleButton.innerHTML = "▦";
        gridContainer.style.display = 'none';
        tableContainer.style.display = 'block';
        tableInfo.style.display = 'block';
    } else {
        currentView = 'grid';
        toggleButton.innerHTML = "☰"; // <<< MUDANÇA: Ícone de Tabela
        gridContainer.style.display = 'grid'; // Use 'grid' para layout correto
        tableContainer.style.display = 'none';
        tableInfo.style.display = 'none';
    }

    renderSounds();
}

async function loadAudioDevices() {
    const select = document.getElementById('audioOutputSelect');
    select.innerHTML = '<option value="default">Padrão do Sistema</option>';

    try {
        await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (err) {
        console.warn('Permissão de áudio negada. Os nomes dos dispositivos podem não aparecer.');
        alert('Por favor, permita o acesso ao microfone para listar os dispositivos de áudio.');
    }

    try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const audioDevices = devices.filter(device => device.kind === 'audiooutput');

        audioDevices.forEach(device => {
            if (device.deviceId === 'default' || device.deviceId === 'communications') return;

            const option = document.createElement('option');
            option.value = device.deviceId;
            option.textContent = device.label || `Dispositivo ${select.options.length}`;
            select.appendChild(option);
        });
    } catch (err) {
        console.error('Erro ao listar dispositivos de áudio:', err);
    }
}

async function saveGlobalSettings() {
    config.settings.audioDevice = document.getElementById('audioOutputSelect').value;
    config.settings.volumeBoostEnabled = document.getElementById('volumeBoostCheck').checked;
    config.settings.volumeBoostAmount = parseInt(document.getElementById('volumeBoostAmount').value) || 20;

    await saveConfig();
}

async function saveAudioDevice() {
    // const selectedDeviceId = document.getElementById('audioOutputSelect').value;
    // config.settings.audioDevice = selectedDeviceId;
    // await saveConfig();
    await saveGlobalSettings(); // MUDANÇA: Apenas chama a função principal
}

function loadAudioDuration(filePath, callback) {
    const durationEl = document.getElementById('audioDuration');
    durationEl.textContent = 'Carregando duração...';

    try {
        const audio = new Audio(filePath);
        audio.onloadedmetadata = () => {
            const duration = audio.duration;
            const minutes = Math.floor(duration / 60);
            const seconds = Math.floor(duration % 60);
            durationEl.textContent = `Duração Total: ${minutes}:${seconds.toString().padStart(2, '0')} (${duration.toFixed(2)}s)`;
            if (callback) callback(duration); // Chama o callback com a duração
        };
        audio.onerror = () => {
            durationEl.textContent = 'Erro ao carregar o arquivo de áudio.';
        };
    } catch (err) {
        durationEl.textContent = 'Erro ao carregar o áudio.';
        console.error(err);
    }
}

async function previewSound(event) {
    if (isNetworkMuted) {
        console.log('Sons silenciados pela rede.');
        return;
    }

    event.preventDefault(); // Impede qualquer comportamento padrão do botão
    const button = event.target.closest('button');

    // 1. Se o preview já está tocando, pare-o
    if (previewAudio) {
        previewAudio.pause();
        previewAudio.currentTime = 0;
        previewAudio.src = '';
        previewAudio = null;
        if (previewStopTimer) clearTimeout(previewStopTimer);
        previewStopTimer = null;
        button.innerHTML = "▶️ Prévia";

        await restoreVolumeBoost();
        return;
    }

    // 2. Verifique se um arquivo foi selecionado
    if (!selectedFilePath) {
        alert('Por favor, selecione um arquivo de áudio primeiro!');
        return;
    }

    // 3. Pare qualquer áudio principal que esteja tocando
    if (currentAudio) {
        currentAudio.pause();
        currentAudio.currentTime = 0;
        currentAudio.src = '';
        currentAudio = null;
        currentPlayingSoundName = null;
        if (stopAudioTimer) {
            clearTimeout(stopAudioTimer);
            stopAudioTimer = null;
        }
    }

    await restoreVolumeBoost();

    // 4. Pegue todas as configurações do modal
    const volume = parseFloat(document.getElementById('soundVolume').value);
    const speed = parseFloat(document.getElementById('soundSpeed').value);
    const loop = document.getElementById('soundLoop').checked;
    const startTime = parseFloat(document.getElementById('soundStartTime').value) || 0;
    const endTime = parseFloat(document.getElementById('soundEndTime').value) || 0;

    try {
        await applyVolumeBoost();

        // 5. Crie e configure o áudio de preview
        previewAudio = new Audio(selectedFilePath);
        previewAudio.volume = volume;
        previewAudio.playbackRate = speed;
        previewAudio.loop = loop;
        previewAudio.currentTime = startTime;

        // 6. Defina o dispositivo de saída de áudio (o mesmo selecionado no dropdown principal)
        const deviceId = document.getElementById('audioOutputSelect').value || 'default';
        if (deviceId !== 'default') {
            try {
                await previewAudio.setSinkId(deviceId);
            } catch (err) {
                console.error('Falha ao definir saída de áudio para prévia:', err);
                alert('Falha ao definir saída de áudio para prévia.');
            }
        }

        // 7. Toque o áudio
        await previewAudio.play();
        button.innerHTML = "⏹️ Parar"; // Mude o texto do botão

        // 8. Limpe quando o áudio terminar
        previewAudio.addEventListener('ended', () => {
            button.innerHTML = "▶️ Prévia";
            previewAudio = null;
            restoreVolumeBoost();
        });

        // 9. Lógica para 'endTime' (copiada de playSound)
        if (endTime > startTime && !previewAudio.loop) {
            const durationInMs = (endTime - startTime) * 1000 / previewAudio.playbackRate;
            previewStopTimer = setTimeout(() => {
                if (previewAudio) {
                    previewAudio.pause();
                    previewAudio.currentTime = startTime;
                    // Dispara o evento 'ended' manualmente para resetar o botão
                    previewAudio.dispatchEvent(new Event('ended'));
                }
            }, durationInMs);
        }

        if (endTime > startTime && previewAudio.loop) {
            previewAudio.addEventListener('timeupdate', function () {
                if (this.currentTime >= endTime) {
                    this.currentTime = startTime;
                }
            });
        }

    } catch (err) {
        console.error('Erro ao reproduzir prévia:', err);
        alert('Erro ao reproduzir a prévia. Verifique o arquivo.');
        if (previewAudio) previewAudio = null;
        button.innerHTML = "▶️ Prévia";
        restoreVolumeBoost();
    }
}

/**
 * Inicializa o "arrastar e soltar" na tabela
 */
function initTableSortable() {
    // Destrói qualquer instância antiga
    if (sortableInstance) {
        sortableInstance.destroy();
        sortableInstance = null;
    }

    const tableBody = document.querySelector('.sounds-table tbody');
    if (!tableBody) return; // Sai se a tabela não estiver visível

    console.log(window.electronAPI.Sortable);   
    sortableInstance = window.electronAPI.Sortable.create(tableBody, {
        ghostClass: 'sortable-ghost', // Classe CSS do "fantasma"
        animation: 150,
        // Chamado quando você solta uma linha
        onEnd: async (evt) => {
            // Pega o nome do som que foi movido
            // (Vamos buscá-lo do nosso array de ordem, usando o índice antigo)
            const movedSoundName = config.settings.soundOrder.splice(evt.oldIndex, 1)[0];

            // Insere o nome na nova posição do array
            config.settings.soundOrder.splice(evt.newIndex, 0, movedSoundName);

            // Salva a nova ordem no arquivo de config
            await saveConfig();
        }
    });
}


/**
 * Aumenta o volume do sistema se a opção estiver marcada.
 */
async function applyVolumeBoost() {
    const boostCheck = document.getElementById('volumeBoostCheck').checked;

    // Só executa se o boost estiver ligado E o volume não estiver já aumentado
    if (boostCheck && !isSystemVolumeBoosted) {
        try {
            const currentVolume = await window.electronAPI.getSystemVolume();
            if (currentVolume === null) return; // Falha ao obter

            originalSystemVolume = currentVolume; // Salva o volume original

            const boostAmount = parseInt(document.getElementById('volumeBoostAmount').value) || 20;
            let newVolume = currentVolume + boostAmount;
            if (newVolume > 100) newVolume = 100; // Limita em 100%

            await window.electronAPI.setSystemVolume(newVolume);
            isSystemVolumeBoosted = true; // Marca que o volume foi aumentado
        } catch (err) {
            console.error('Falha ao aplicar boost de volume:', err);
        }
    }
}

/**
 * Restaura o volume do sistema ao seu valor original.
 */
async function restoreVolumeBoost() {
    // Só executa se o volume estiver aumentado e tivermos um valor original
    if (isSystemVolumeBoosted && originalSystemVolume !== null) {
        try {
            await window.electronAPI.setSystemVolume(originalSystemVolume);
            originalSystemVolume = null; // Limpa o valor
            isSystemVolumeBoosted = false; // Marca que o volume foi restaurado
        } catch (err) {
            console.error('Falha ao restaurar volume:', err);
        }
    }
}


function renderSounds() {
    const gridContainer = document.getElementById('soundsContainer');
    const tableContainer = document.getElementById('tableContainer');

    if (sortableInstance) {
        sortableInstance.destroy();
        sortableInstance = null; // Impede futuras chamadas "zumbis"
    }

    // --- MUDANÇA PRINCIPAL: Usa o array 'soundOrder' como fonte da verdade ---
    const soundNamesInOrder = config.settings.soundOrder || [];

    // 1. Lógica do Estado Vazio
    if (soundNamesInOrder.length === 0) {
        const emptyHtml = `
                    <div class="empty-state">
                        <div class="empty-state-icon">🎼</div>
                        <h3>Nenhum som adicionado ainda</h3>
                        <p>Clique em "Adicionar Áudio" para começar</p>
                    </div>
                `;
        gridContainer.innerHTML = emptyHtml;
        tableContainer.innerHTML = emptyHtml; // Mostra nas duas views
        // if (sortableInstance) sortableInstance.destroy(); // Destrói o sortable
        return;
    }

    // 2. Limpa containers
    gridContainer.innerHTML = '';
    tableContainer.innerHTML = '';

    // 3. Renderiza a view correta
    if (currentView === 'grid') {
        // --- Renderiza a GRADE (usando a nova ordem) ---
        // if (sortableInstance) sortableInstance.destroy(); // Só ativa sortable na tabela

        soundNamesInOrder.forEach(name => {
            const data = config.sounds[name];
            if (!data) return; // Som órfão, pula

            const card = document.createElement('div');
            card.className = 'sound-card';
            if (selectedSound === name) {
                card.classList.add('selected');
            }

            const fileName = window.electronAPI.basename(data.path);
            const volume = (data.volume !== undefined ? data.volume : 1) * 100;
            const speed = data.speed !== undefined ? data.speed : 1;
            const loop = data.loop || false;
            const startTime = data.startTime || 0;
            const endTime = data.endTime || 0;
            const timeText = (endTime > startTime) ? `${startTime.toFixed(1)}s - ${endTime.toFixed(1)}s` : 'Completo';
            const playCount = data.playCount || 0;
            const lastPlayed = formatLastPlayed(data.lastPlayed);

            card.innerHTML = `
                        <div class="sound-name">${name}</div>
                        <div class="sound-hotkey">⌨️ ${data.hotkey}</div>
                        <div class="sound-file">📄 ${fileName}</div>
                        <div class="sound-details">
                            <span>🔊 ${volume.toFixed(0)}%</span>
                            <span>⏩ ${speed.toFixed(1)}x</span>
                            <span>${loop ? '🔄 Repetir' : '▶️ Tocar 1x'}</span>
                        </div>
                        <div class="sound-details" style="border-top: none; padding-top: 5px;">
                             <span>⏱️ ${timeText}</span>
                        </div>
                        <div class="sound-stats">
                            <span>▶️ ${playCount} execuções</span>
                            <span>🕒 ${lastPlayed}</span>
                        </div>
                    `;
            card.onclick = () => selectSoundCard(name);
            gridContainer.appendChild(card);
        });

    } else {
        // --- Renderiza a TABELA (usando a nova ordem) ---
        let tableHtml = `
                    <table class="sounds-table">
                        <thead>
                            <tr>
                                <th>Nome</th>
                                <th>Atalho</th>
                                <th>Arquivo</th>
                                <th>Volume</th>
                                <th>Velocidade</th>
                                <th>Loop</th>
                                <th class="col-plays">Execuções</th>
                                <th class="col-last-played">Última Vez</th>
                            </tr>
                        </thead>
                        <tbody>
                `;

        soundNamesInOrder.forEach(name => {
            const data = config.sounds[name];
            if (!data) return;

            const isSelected = (selectedSound === name) ? 'selected' : '';
            const fileName = window.electronAPI.basename(data.path);
            const volume = (data.volume !== undefined ? data.volume : 1) * 100;
            const speed = data.speed !== undefined ? data.speed : 1;
            const loop = data.loop ? 'Sim' : 'Não';
            const playCount = data.playCount || 0;
            const lastPlayed = formatLastPlayed(data.lastPlayed);

            // MUDANÇA: O 'ondblclick' foi removido da tag <tr>
            tableHtml += `
                        <tr class="${isSelected}" 
                            onclick="selectSoundCard(${JSON.stringify(name)})">
                            
                            <td>${name}</td>
                            <td><span class="sound-hotkey">${data.hotkey}</span></td>
                            <td class="sound-file" title="${data.path}">${fileName}</td>
                            <td>${volume.toFixed(0)}%</td>
                            <td>${speed.toFixed(1)}x</td>
                            <td>${loop}</td>
                            <td class="col-plays">${playCount}</td>
                            <td class="col-last-played">${lastPlayed}</td>
                        </tr>
                    `;
        });

        tableHtml += `</tbody></table>`;
        tableContainer.innerHTML = tableHtml;

        // MUDANÇA: Inicializa o "arrastar e soltar" na tabela
        initTableSortable();
    }
}



function selectSoundCard(name) {
    selectedSound = name;
    renderSounds();
    playSound(name);
}

function updateSliderLabels() {
    try {
        const vol = document.getElementById('soundVolume').value;
        document.getElementById('volumeValue').textContent = `${Math.round(vol * 100)}%`;
        const speed = document.getElementById('soundSpeed').value;
        document.getElementById('speedValue').textContent = `${parseFloat(speed).toFixed(1)}x`;
    } catch (e) { }
}


function openAddModal() {
    document.getElementById('modalTitle').textContent = 'Adicionar Novo Som';
    document.getElementById('originalSoundName').value = '';
    document.getElementById('soundName').value = '';
    document.getElementById('soundHotkey').value = '';
    document.getElementById('fileName').textContent = 'Nenhum arquivo selecionado';
    document.getElementById('audioDuration').textContent = '';
    selectedFilePath = null;
    document.getElementById('soundVolume').value = 1;
    document.getElementById('soundSpeed').value = 1;
    document.getElementById('soundLoop').checked = false;
    document.getElementById('soundStartTime').value = 0;
    document.getElementById('soundEndTime').value = 0;
    updateSliderLabels();
    setupHotkeyCapture();
    document.getElementById('addModal').style.display = 'block';
}

function openEditModal() {
    if (!selectedSound || !config.sounds[selectedSound]) {
        alert('Selecione um som para editar!');
        return;
    }

    const data = config.sounds[selectedSound];

    document.getElementById('modalTitle').textContent = 'Editar Som';
    document.getElementById('originalSoundName').value = selectedSound;
    document.getElementById('soundName').value = selectedSound;
    document.getElementById('soundHotkey').value = data.hotkey;
    document.getElementById('fileName').textContent = window.electronAPI.basename(data.path);
    selectedFilePath = data.path;

    loadAudioDuration(selectedFilePath); // <<< MUDANÇA: Carrega a duração

    document.getElementById('soundVolume').value = data.volume !== undefined ? data.volume : 1;
    document.getElementById('soundSpeed').value = data.speed !== undefined ? data.speed : 1;
    document.getElementById('soundLoop').checked = data.loop || false;
    document.getElementById('soundStartTime').value = data.startTime || 0;
    document.getElementById('soundEndTime').value = data.endTime || 0;
    updateSliderLabels();
    setupHotkeyCapture();
    document.getElementById('addModal').style.display = 'block';
}



function closeAddModal() {
    // --- MUDANÇA: Para o áudio de preview se estiver tocando ---
    if (previewAudio) {
        previewAudio.pause();
        previewAudio.src = '';
        previewAudio = null;
        if (previewStopTimer) clearTimeout(previewStopTimer);
        previewStopTimer = null;
    }
    // --- Fim da mudança ---

    document.getElementById('addModal').style.display = 'none';
    isCapturingHotkey = false;
    capturedKeys.clear();
    selectedFilePath = null;
    document.getElementById('originalSoundName').value = '';
    document.getElementById('audioDuration').textContent = ''; // Limpa a duração
}

async function selectFile() {
    const filePath = await window.electronAPI.selectAudioFile();
    if (filePath) {
        selectedFilePath = filePath;
        document.getElementById('fileName').textContent = window.electronAPI.basename(filePath);

        // --- MUDANÇA: Chama a função para carregar a duração ---
        // E passa um callback para auto-preencher o campo "Fim"
        loadAudioDuration(filePath, (duration) => {
            const endTimeInput = document.getElementById('soundEndTime');
            // Só auto-preenche se o valor for 0
            if (parseFloat(endTimeInput.value) === 0) {
                endTimeInput.value = duration.toFixed(2);
            }
        });
    }
}

async function saveSound() {
    const name = document.getElementById('soundName').value.trim();
    const hotkey = document.getElementById('soundHotkey').value.trim();
    const originalName = document.getElementById('originalSoundName').value;
    const volume = parseFloat(document.getElementById('soundVolume').value);
    const speed = parseFloat(document.getElementById('soundSpeed').value);
    const loop = document.getElementById('soundLoop').checked;
    const startTime = parseFloat(document.getElementById('soundStartTime').value) || 0;
    const endTime = parseFloat(document.getElementById('soundEndTime').value) || 0;

    if (!name) { alert('Por favor, insira um nome para o som!'); return; }
    if (!hotkey) { alert('Por favor, insira um atalho!'); return; }
    if (!selectedFilePath) { alert('Por favor, selecione um arquivo de áudio!'); return; }

    if (name !== originalName && config.sounds[name]) {
        alert(`O nome "${name}" já está em uso. Escolha outro nome.`);
        return;
    }

    let finalAudioPath = selectedFilePath;
    let fileHasChanged = true;

    // 1. Verifica se estamos editando e se o arquivo NÃO mudou
    if (originalName && config.sounds[originalName] && config.sounds[originalName].path === selectedFilePath) {
        fileHasChanged = false;
    }

    // 2. Se o arquivo for novo ou foi alterado, copia ele para a pasta de dados
    if (fileHasChanged) {
        try {
            console.log(`Copiando novo arquivo: ${selectedFilePath}`);
            const result = await window.electronAPI.copyAudioFileToData(selectedFilePath);
            
            if (!result.success) {
                throw new Error(result.error);
            }

            finalAudioPath = result.path; // Salva o NOVO caminho
            console.log(`Arquivo copiado para: ${finalAudioPath}`);

            // Se for uma edição e um NOVO arquivo foi escolhido,
            // devemos deletar o arquivo antigo para não deixar lixo
            if (originalName && config.sounds[originalName] && config.sounds[originalName].path) {
                console.log(`Deletando arquivo antigo: ${config.sounds[originalName].path}`);
                await window.electronAPI.deleteAudioFile(config.sounds[originalName].path);
            }

        } catch (err) {
            console.error('Erro ao copiar arquivo de áudio:', err);
            alert('Falha ao salvar o arquivo de áudio. Verifique os logs.');
            return; // Aborta o salvamento
        }
    }

    let stats = { playCount: 0, lastPlayed: null }; // Padrão para sons novos

    if (originalName) {
        // É uma edição, busca stats antigos
        const soundData = config.sounds[originalName];
        if (soundData) {
            stats.playCount = soundData.playCount || 0;
            stats.lastPlayed = soundData.lastPlayed || null;
        }
    }

    // --- MUDANÇA: Lógica para atualizar a ordem ---
    if (originalName) {
        // É uma EDIÇÃO
        if (originalName !== name) {
            // Foi RENOMEADO
            // 1. Deleta a entrada antiga no objeto
            delete config.sounds[originalName];
            // 2. Atualiza o nome no array de ordem
            const index = config.settings.soundOrder.indexOf(originalName);
            if (index > -1) {
                config.settings.soundOrder[index] = name;
            }
        }
        // (Se o nome for o mesmo, não faz nada na ordem)
    } else {
        // É um som NOVO
        // 1. Adiciona o nome ao final do array de ordem
        config.settings.soundOrder.push(name);
    }
    // --- Fim da mudança ---

    config.sounds[name] = {
        path: finalAudioPath,
        hotkey: hotkey,
        volume: volume,
        speed: speed,
        loop: loop,
        startTime: startTime,
        endTime: endTime,
        playCount: stats.playCount,
        lastPlayed: stats.lastPlayed
    };

    await saveConfig();
    selectedSound = name;
    renderSounds();
    closeAddModal();
}

async function removeSound() {
    if (!selectedSound) {
        alert('Selecione um som para remover!');
        return;
    }
    if (confirm(`Deseja remover o som "${selectedSound}"?`)) {

        const soundData = config.sounds[selectedSound];
        if (soundData && soundData.path) {
            try {
                // Pede ao main process para deletar o arquivo físico
                console.log(`Deletando arquivo de áudio: ${soundData.path}`);
                const result = await window.electronAPI.deleteAudioFile(soundData.path);
                if (!result.success && result.error) { // Só mostra erro se houver um erro real
                    throw new Error(result.error);
                }
            } catch (err) {
                console.warn(`Não foi possível deletar o arquivo ${soundData.path}:`, err);
                // Continua mesmo assim, para remover a referência do config
            }
        }

        delete config.sounds[selectedSound];
        config.settings.soundOrder = config.settings.soundOrder.filter(name => name !== selectedSound);
        await saveConfig();
        selectedSound = null;
        renderSounds();
    }
}

function testSelected() {
    if (!selectedSound) {
        alert('Selecione um som para testar!');
        return;
    }
    playSound(selectedSound);
}



async function playSound(name) {
    if (isNetworkMuted) {
        console.log('Sons silenciados pela rede.');
        return;
    }

    const data = config.sounds[name];
    if (!data) return;

    // --- NOVO BLOCO DE CÓDIGO ---
    // Verifica se o som ATUAL é o MESMO que foi pedido
    // if (currentAudio && currentPlayingSoundName === name && !currentAudio.paused) {
    //     // É o mesmo som, e ele está tocando. Pare ele.
    //     currentAudio.pause();
    //     currentAudio.currentTime = 0; 
    //     currentAudio.src = ''; // Limpa a fonte
    //     currentAudio = null; // Descarta o áudio
    //     currentPlayingSoundName = null; // Limpa o nome

    //     if (stopAudioTimer) {
    //         clearTimeout(stopAudioTimer);
    //         stopAudioTimer = null;
    //     }
    //     return; // Sai da função
    // }
    // --- FIM DO NOVO BLOCO ---

    if (currentAudio && currentPlayingSoundName === name && !currentAudio.paused) {
        currentAudio.pause();
        currentAudio.currentTime = 0;
        currentAudio.src = '';
        currentAudio = null;
        currentPlayingSoundName = null;

        if (stopAudioTimer) {
            clearTimeout(stopAudioTimer);
            stopAudioTimer = null;
        }

        await restoreVolumeBoost(); // <<< RESTAURA O VOLUME
        return;
    }

    // Se chegou aqui, ou é um som diferente, ou nenhum som estava tocando.
    // Pare qualquer som que ESTIVESSE tocando (código que já existia)
    if (currentAudio) {
        currentAudio.pause();
        currentAudio.currentTime = 0;
        currentAudio.src = '';
        currentAudio = null;
    }
    if (stopAudioTimer) {
        clearTimeout(stopAudioTimer);
        stopAudioTimer = null;
    }

    await restoreVolumeBoost();

    try {
        // 1. Inicializa os campos se não existirem
        if (data.playCount === undefined || isNaN(data.playCount)) {
            data.playCount = 0;
        }

        // 2. Incrementa e atualiza
        data.playCount++;
        data.lastPlayed = new Date().toISOString(); // Formato padrão ISO

        // 3. Salva a configuração (sem re-renderizar, playSound não deve fazer isso)
        await saveConfig();
    } catch (err) {
        console.error('Erro ao salvar estatísticas:', err);
    }

    // Toca o novo som
    try {
        await applyVolumeBoost();

        currentAudio = new Audio(data.path);
        currentPlayingSoundName = name; // <<< NOVO: Guarda o nome do som atual

        const startTime = data.startTime || 0;
        const endTime = data.endTime || 0;

        currentAudio.volume = data.volume !== undefined ? data.volume : 1;
        currentAudio.playbackRate = data.speed !== undefined ? data.speed : 1;
        currentAudio.loop = data.loop || false;
        currentAudio.currentTime = startTime;

        // <<< NOVO: Limpa o nome quando o áudio terminar sozinho
        currentAudio.addEventListener('ended', () => {
            currentPlayingSoundName = null;
        });

        const deviceId = config.settings.audioDevice || 'default';
        if (deviceId !== 'default') {
            try {
                await currentAudio.setSinkId(deviceId);
            } catch (err) {
                console.error('Falha ao definir a saída de áudio:', err);
                alert('Erro! Não foi possível alterar a saída de áudio. Voltando para o Padrão.');
                config.settings.audioDevice = 'default';
                document.getElementById('audioOutputSelect').value = 'default';
                await saveConfig();
            }
        }

        currentAudio.play().catch(err => {
            console.error('Erro ao reproduzir áudio:', err);
            alert('Erro ao reproduzir o áudio. Verifique se o arquivo existe.');
            currentAudio = null;
            currentPlayingSoundName = null;
            restoreVolumeBoost();
        });

        // Lógica do temporizador (endTime)
        if (endTime > startTime && !currentAudio.loop) {
            const durationInMs = (endTime - startTime) * 1000 / currentAudio.playbackRate;
            stopAudioTimer = setTimeout(() => {
                // NOVO: Verifica se ainda é o som certo antes de parar
                if (currentAudio && currentPlayingSoundName === name) {
                    currentAudio.pause();
                    currentAudio.currentTime = startTime;
                    currentPlayingSoundName = null;
                    restoreVolumeBoost();
                }
            }, durationInMs);
        }

        if (endTime > startTime && currentAudio.loop) {
            currentAudio.addEventListener('timeupdate', function () {
                if (this.currentTime >= endTime) {
                    this.currentTime = startTime;
                }
            });
        }

    } catch (error) {
        console.error('Erro ao criar Audio:', error);
        alert('Erro ao carregar o áudio.');
        currentAudio = null;
        currentPlayingSoundName = null;
        restoreVolumeBoost();
    }
}

async function exportProfile() {
    const status = await window.electronAPI.exportProfile();
    alert(status.message); // Informa o usuário do sucesso ou falha
}

async function importProfile() {
    const status = await window.electronAPI.importProfile();
    if (status.message) {
        alert(status.message); // Informa se foi cancelado ou falhou
    }
    // Se for sucesso, o app vai recarregar sozinho
}


// --- NOVAS Funções do Mute de Rede ---
// function toggleNetworkMute(checkbox) {
//     const command = checkbox.checked ? 'MUTE' : 'UNMUTE';
//     isNetworkMuted = checkbox.checked; // Atualiza nosso estado local
//     ipcRenderer.send('broadcast-network-command', command); // Envia para a rede
// }

// ipcRenderer.on('network-status', (event, message) => {
//     // Recebeu um comando da rede (de outro usuário ou de nós mesmos)
//     if (message.command === 'MUTE') {
//         isNetworkMuted = true;
//         document.getElementById('networkMuteCheck').checked = true;
//     } else if (message.command === 'UNMUTE') {
//         isNetworkMuted = false;
//         document.getElementById('networkMuteCheck').checked = false;
//     }
// });

// function toggleNetworkMute(checkbox) {
//     const command = checkbox.checked ? 'MUTE' : 'UNMUTE';
//     setNetworkMuteState(checkbox.checked); // Atualiza a UI
//     window.electronAPI.broadcastCommand(command);
// }


function toggleNetworkMute(checkbox) {
    // 1. Atualiza a UI, a variável global 'isNetworkMuted'
    // e também limpa qualquer loop de mute se isMuted for false.
    setNetworkMuteState(checkbox.checked);

    if (checkbox.checked) {
        // --- LÓGICA DE MUTE (Repetir a cada 1s) ---
        
        // 2. (Garantia) Limpa qualquer timer antigo antes de começar um novo
        if (networkMuteInterval) {
            clearInterval(networkMuteInterval);
        }

        // 3. Envia o primeiro comando MUTE imediatamente
        console.log('Iniciando MUTE broadcast (loop 1s)');
        window.electronAPI.broadcastCommand('MUTE');

        // 4. Inicia o loop para enviar MUTE a cada 1 segundo
        networkMuteInterval = setInterval(() => {
            // A função setNetworkMuteState(false) é responsável
            // por limpar este intervalo quando o estado mudar
            window.electronAPI.broadcastCommand('MUTE');
        }, 1000); // 1000ms = 1 segundo

    } else {
        // --- LÓGICA DE UNMUTE (10x Rápido) ---
        console.log('Iniciando UNMUTE broadcast (burst 10x)');

        // 1. (O timer já foi limpo pela chamada a setNetworkMuteState(false))

        // 2. Envia o comando UNMUTE 10 vezes em rápida sucessão
        for (let i = 0; i < 10; i++) {
            window.electronAPI.broadcastCommand('UNMUTE');
        }
    }
}

/**
 * MUDANÇA: Simplificado para usar o helper
 */
window.electronAPI.onNetworkStatus((message) => {
    // Recebeu um comando da rede
    if (message.command === 'MUTE') {
        setNetworkMuteState(true);
    } else if (message.command === 'UNMUTE') {
        setNetworkMuteState(false);
    }
});

window.electronAPI.onGetSoundList(() => {
    // const soundNames = Object.keys(config.sounds);

    // ipcRenderer.send('sound-list', soundNames);

    const orderedSoundNames = config.settings.soundOrder || [];
    window.electronAPI.sendSoundList(orderedSoundNames);
});

window.electronAPI.onPlaySound((event, name) => {
    playSound(name);
});

window.onclick = function (event) {
    const modal = document.getElementById('addModal');
    if (event.target === modal) {
        closeAddModal();
    }
}

document.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && document.getElementById('addModal').style.display === 'block') {
        if (!isCapturingHotkey) {
            saveSound();
        }
    }
    if (e.key === 'Escape') {
        closeAddModal();
    }
});

function setupHotkeyCapture() {
    const hotkeyInput = document.getElementById('soundHotkey');

    hotkeyInput.addEventListener('focus', () => {
        isCapturingHotkey = true;
        capturedKeys.clear();
        hotkeyInput.value = '';
        hotkeyInput.placeholder = 'Pressione as teclas...';
    });

    hotkeyInput.addEventListener('blur', () => {
        isCapturingHotkey = false;
        if (hotkeyInput.value === '') {
            hotkeyInput.placeholder = 'Clique aqui e pressione as teclas...';
        }
    });
}

document.addEventListener('keydown', (e) => {
    const hotkeyInput = document.getElementById('soundHotkey');

    if (isCapturingHotkey && document.getElementById('addModal').style.display === 'block') {
        e.preventDefault();

        if (['Control', 'Shift', 'Alt'].includes(e.key)) {
            return;
        }

        const keys = [];

        if (e.ctrlKey) {
            keys.push('CommandOrControl');
        }
        if (e.shiftKey) {
            keys.push('Shift');
        }
        if (e.altKey) {
            keys.push('Alt');
        }

        let key = e.key;

        const specialKeys = {
            ' ': 'Space', 'ArrowUp': 'Up', 'ArrowDown': 'Down',
            'ArrowLeft': 'Left', 'ArrowRight': 'Right', 'Escape': 'Esc'
        };

        if (specialKeys[key]) {
            key = specialKeys[key];
        } else if (key.length === 1) {
            key = key.toUpperCase();
        }

        if (!['CONTROL', 'SHIFT', 'ALT'].includes(key.toUpperCase())) {
            keys.push(key);
        }

        const hotkey = keys.join('+');
        hotkeyInput.value = hotkey;

        setTimeout(() => {
            isCapturingHotkey = false;
            hotkeyInput.blur();
        }, 100);
    }
});

function clearHotkey() {
    document.getElementById('soundHotkey').value = '';
    capturedKeys.clear();
}

const notification = document.getElementById('notification');
const message = document.getElementById('notificationMessage');
const restartButton = document.getElementById('restartButton');

window.electronAPI.onceUpdateAvailable(() => {
    message.innerText = 'Uma nova atualização está sendo baixada...';
    notification.classList.add('show');
    // Não precisa remover! A mágica do '.once' já fez isso.
});

// Usa o "interfone" que só ouve UMA VEZ
window.electronAPI.onceUpdateDownloaded(() => {
    message.innerText = 'Atualização pronta! Reiniciar agora para instalar?';
    restartButton.style.display = 'flex';
    notification.classList.add('show');
    // Não precisa remover!
});

function restartApp() {
    window.electronAPI.restartApp();
}
loadConfig();

function formatLastPlayed(isoString) {
    if (!isoString) {
        return 'Nunca';
    }
    try {
        const date = new Date(isoString);
        const now = new Date();

        // Zera as horas para comparar apenas os dias
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        yesterday.setHours(0, 0, 0, 0);

        const dateToCompare = new Date(date.getTime());
        dateToCompare.setHours(0, 0, 0, 0);

        const time = date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

        if (dateToCompare.getTime() === today.getTime()) {
            return `Hoje, ${time}`;
        }
        if (dateToCompare.getTime() === yesterday.getTime()) {
            return `Ontem, ${time}`;
        }
        return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });

    } catch (e) {
        return 'Data inválida';
    }
}

function setNetworkMuteState(isMuted) {
    const banner = document.getElementById('networkMuteBanner');
    const checkbox = document.getElementById('networkMuteCheck');

    isNetworkMuted = isMuted; // Atualiza a variável global
    checkbox.checked = isMuted; // Sincroniza o checkbox

    if (isMuted) {
        banner.style.display = 'block';
    } else {
        banner.style.display = 'none';
        if (networkMuteInterval) {
            clearInterval(networkMuteInterval);
            networkMuteInterval = null;
            console.log('Loop de MUTE interrompido por setNetworkMuteState(false)');
        }
    }
}

async function saveOverlayHotkey(newHotkey) {
    if (!newHotkey) {
        alert('O atalho não pode ser vazio.');
        return;
    }

    try {
        // Chama o handler que criamos no main.js
        const result = await window.electronAPI.updateOverlayHotkey(newHotkey);

        if (result.success) {
            // Atualiza nossa cópia local da config
            config.settings.overlayHotkey = newHotkey;
            alert('Atalho do overlay atualizado com sucesso!');
        } else {
            alert('Erro: ' + result.message);
            // (No futuro, você faria seu input.value = config.settings.overlayHotkey
            // para reverter a mudança na tela)
        }
    } catch (err) {
        console.error('Erro ao atualizar atalho:', err);
        alert('Erro de comunicação ao atualizar o atalho.');
    }
}

navigator.mediaDevices.ondevicechange = (event) => {
    console.log('Dispositivos de mídia mudaram! Recarregando lista de áudio...');

    const select = document.getElementById('audioOutputSelect');
    const valorAntigo = select.value;

    loadAudioDevices().then(() => {
        if (Array.from(select.options).some(opt => opt.value === valorAntigo)) {
            select.value = valorAntigo;
        } else {
            select.value = 'default';
            saveAudioDevice();
        }
    });
};