const { app, BrowserWindow, ipcMain, dialog, globalShortcut, Tray, Menu } = require('electron');
const { autoUpdater } = require('electron-updater'); // Importa o autoUpdater
const path = require('path');
const fs = require('fs');
const loudness = require('loudness');
const AdmZip = require('adm-zip');
const os = require('os');
const dgram = require('dgram'); 
const udpPort = 41234; 


const multicastAddress = '239.255.0.1'; // Nosso "grupo" de rádio privado
let udpSocket = dgram.createSocket({ type: 'udp4', reuseAddr: true });


// --- Trava de Instância Única ---
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', (event, commandLine, workingDirectory) => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      if (!mainWindow.isVisible()) mainWindow.show();
      mainWindow.focus();
    }
  });
}

const configPath = path.join(app.getPath('userData'), 'soundboard-config.json');
let mainWindow;
let overlayWindow = null;
let appConfig = { settings: { audioDevice: 'default' }, sounds: {} };
let tray = null;
let isQuitting = false;

// (As funções de configuração e atalhos permanecem as mesmas)
function loadSoundsConfig() {
    try {
        if (fs.existsSync(configPath)) {
            const data = fs.readFileSync(configPath, 'utf-8');
            const config = JSON.parse(data);
            if (config.sounds === undefined) {
                appConfig = {
                    settings: { audioDevice: 'default' },
                    sounds: config
                };
                fs.writeFileSync(configPath, JSON.stringify(appConfig, null, 2), 'utf-8');
            } else {
                appConfig = config;
            }

            if (!appConfig.settings) appConfig.settings = { audioDevice: 'default' };
            if (!appConfig.settings.overlayHotkey) {
                appConfig.settings.overlayHotkey = 'CommandOrControl+Shift+Space';
            }
            return appConfig;
        }
    } catch (err) {
        console.error("Erro ao carregar configuração:", err);
    }
    appConfig = { 
        settings: { 
            audioDevice: 'default', 
            overlayHotkey: 'CommandOrControl+Shift+Space' 
        }, 
        sounds: {} 
    };
    return appConfig;
}
function registerAllHotkeys(sounds) {
    // globalShortcut.unregisterAll();
    if (!sounds) return;
    Object.entries(sounds).forEach(([name, data]) => {
        if (data.hotkey) {
            try {
                globalShortcut.register(data.hotkey, () => {
                    if (mainWindow) {
                      mainWindow.webContents.send('play-sound', name);
                    }
                });
            } catch (err) {
                console.error(`Erro ao registrar atalho ${data.hotkey} para ${name}:`, err);
            }
        }
    });
}
// --- Fim das funções inalteradas ---

// function createOverlayWindow() {
//     if (overlayWindow) {
//         overlayWindow.focus();
//         return;
//     }

//     overlayWindow = new BrowserWindow({
//         width: 450,         // Largura do círculo
//         height: 450,        // Altura do círculo
//         transparent: true,  // Fundo transparente
//         frame: false,       // Sem bordas ou barra de título
//         alwaysOnTop: true,  // Sempre por cima de tudo
//         center: true,       // Centralizado na tela
//         resizable: false,
//         show: false,        // Começa invisível
//         skipTaskbar: true,  // Não mostra na barra de tarefas
//         webPreferences: {
//             nodeIntegration: true,   // Necessário para o 'require' no overlay.html
//             contextIsolation: false // Necessário para o 'require' no overlay.html
//         }
//     });

//     overlayWindow.loadFile(path.join(__dirname, 'overlay.html'));

//     // Quando o overlay estiver pronto, pede a lista de sons para a janela principal
//     overlayWindow.webContents.on('did-finish-load', () => {
//         // Pede a lista de sons da janela principal
//         if (mainWindow) {
//             mainWindow.webContents.send('get-sound-list');
//         }
//     });

//     // Se o usuário clicar fora do círculo (perder foco), ele fecha
//     overlayWindow.on('blur', () => {
//         if (overlayWindow) {
//             overlayWindow.close();
//         }
//     });

//     // Limpa a variável quando a janela for fechada
//     overlayWindow.on('closed', () => {
//         overlayWindow = null;
//     });
// }

function createOverlayWindow() {
    if (overlayWindow) {
        overlayWindow.focus();
        return;
    }

    const { width, height } = require('electron').screen.getPrimaryDisplay().bounds; // Pega a resolução da tela principal

    overlayWindow = new BrowserWindow({
        width: width,         // Largura total da tela
        height: height,       // Altura total da tela
        transparent: true,    // Fundo transparente
        backgroundColor: '#00000000',
        frame: false,         // Sem bordas ou barra de título
        alwaysOnTop: true,    // Sempre por cima de tudo
        center: true,         // Centralizado na tela
        resizable: false,
        show: false,          // Começa invisível
        skipTaskbar: true,    // Não mostra na barra de tarefas
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false
        }
    });

    overlayWindow.loadFile(path.join(__dirname, 'overlay.html'));

    overlayWindow.webContents.on('did-finish-load', () => {
        if (mainWindow) {
            mainWindow.webContents.send('get-sound-list');
        }
    });

    overlayWindow.on('blur', () => {
        if (overlayWindow) {
            overlayWindow.close();
        }
    });

    overlayWindow.on('closed', () => {
        overlayWindow = null;
    });
}

async function askAndCheckForUpdates() {
    // Só verifica se o app estiver "empacotado" (instalado)
    if (!app.isPackaged) {
      console.log('Verificação de atualização desativada em modo de desenvolvimento.');
      return;
    }
    
    try {
      // Pergunta ao usuário primeiro, usando um diálogo nativo
      const { response } = await dialog.showMessageBox(mainWindow, {
          type: 'info',
          title: 'Verificar Atualizações',
          message: 'Deseja verificar se há novas atualizações para o Hahaha?',
          buttons: ['Sim, verificar agora', 'Não, depois'],
          defaultId: 0, // Botão "Sim" é o padrão
          cancelId: 1   // Botão "Não"
      });

      if (response === 0) { // 0 é o índice do botão "Sim"
          // O usuário aceitou. Agora sim, verificamos.
          // Isso vai disparar os eventos 'update-available' etc.
          autoUpdater.checkForUpdatesAndNotify();
      } else {
          console.log('Verificação de atualização pulada pelo usuário.');
      }
    } catch (err) {
        console.error('Erro no diálogo de atualização:', err);
    }
  }

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1000,
    height: 800,
    title: 'Soundboard - Atalhos de Áudio',
    show: false,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: true,
      preload: path.join(__dirname, './preload.js'),
      sandbox: false
    },
    icon: path.join(__dirname, './icon.png')
  });

  const iconPath = path.join(__dirname, './icon.png');
  if (fs.existsSync(iconPath)) {
    mainWindow.setIcon(iconPath);
  } else {
    console.error(`Ícone da janela principal não encontrado: ${iconPath}`);
  }

  if (app.isPackaged) {
    mainWindow.removeMenu();
  }

  loadSoundsConfig();

  // --- LÓGICA DE ATUALIZAÇÃO ---
  // Assim que a janela estiver pronta, verifica por atualizações.
//   mainWindow.webContents.on('did-finish-load', () => {
//     // Para ambientes de desenvolvimento, desativa a busca para evitar erros.
//     if (!app.isPackaged) {
//       console.log('Verificação de atualização desativada em modo de desenvolvimento.');
//       return;
//     }
//     autoUpdater.checkForUpdatesAndNotify();
//   });
//   mainWindow.webContents.on('did-finish-load', () => {
//     askAndCheckForUpdates();
//   });

//   autoUpdater.on('update-available', () => {
//     mainWindow.webContents.send('update-available');
//   });

//   autoUpdater.on('update-downloaded', () => {
//     mainWindow.webContents.send('update-downloaded');
//   });

//   // O renderer vai chamar este evento para reiniciar o app.
//   ipcMain.on('restart-app', () => {
//     autoUpdater.quitAndInstall();
//   });
  // --- FIM DA LÓGICA DE ATUALIZAÇÃO ---


  mainWindow.webContents.on('did-finish-load', () => {
    if (!app.isPackaged) {
      console.log('Verificação de atualização desativada em modo de desenvolvimento.');
      return;
    }
    // Isso verifica E baixa automaticamente.
    autoUpdater.checkForUpdatesAndNotify(); 
  });

  // Este evento ainda é útil para mostrar "Baixando atualização..." no seu app
  autoUpdater.on('update-available', () => {
    mainWindow.webContents.send('update-available');
  });

  // --- MUDANÇA PRINCIPAL ESTÁ AQUI ---
  // Quando a atualização terminar de baixar...
  autoUpdater.on('update-downloaded', (info) => {
    
    // ...em vez de notificar o index.html, mostramos um pop-up nativo.
    dialog.showMessageBox(mainWindow, {
        type: 'info',
        title: 'Atualização Pronta!',
        message: 'Uma nova versão do Hahaha foi baixada.',
        detail: 'Deseja reiniciar o aplicativo e instalar a atualização agora?',
        buttons: ['Reiniciar Agora', 'Depois'],
        defaultId: 0, // "Reiniciar Agora"
        cancelId: 1   // "Depois"
    }).then(({ response }) => {
        if (response === 0) { // 0 é o índice de "Reiniciar Agora"
            // O usuário aceitou, então reiniciamos e instalamos.
            autoUpdater.quitAndInstall();
        }
    });
    // Não enviamos mais o 'update-downloaded' para o renderer,
    // pois este diálogo nativo o substitui.
  });

  // Este handler ainda é útil caso você queira adicionar um botão
  // "Verificar Atualizações" manualmente no futuro.
  ipcMain.on('restart-app', () => {
    autoUpdater.quitAndInstall();
  });

  // (Lógica de IPC para config e arquivos - sem mudanças)
  ipcMain.handle('load-config', async () => appConfig);
  // ipcMain.handle('save-config', async (event, config) => {
  //   try {
  //     const data = JSON.stringify(config, null, 2);
  //     fs.writeFileSync(configPath, data, 'utf-8');
  //     appConfig = config;
  //     registerAllHotkeys(appConfig.sounds);
  //   } catch (err) {
  //     console.error("Erro ao salvar configuração:", err);
  //   }
  // });
  // SUBSTITUA ESTE HANDLER
  ipcMain.handle('save-config', async (event, newConfig) => { // Renomeado para newConfig
      try {
          // --- INÍCIO DA CORREÇÃO ---
          // 1. Limpa os atalhos de áudio ANTIGOS
          // Usamos a 'appConfig' global, que ainda tem a config antiga
          if (appConfig && appConfig.sounds) {
              Object.values(appConfig.sounds).forEach(data => {
                  if (data.hotkey) {
                      globalShortcut.unregister(data.hotkey);
                  }
              });
          }

          // 2. Salva o novo arquivo
          const data = JSON.stringify(newConfig, null, 2);
          fs.writeFileSync(configPath, data, 'utf-8');
          
          // 3. Atualiza a config global do main.js
          appConfig = newConfig;

          // 4. Registra os atalhos NOVOS (a função agora só registra)
          registerAllHotkeys(appConfig.sounds);
          // --- FIM DA CORREÇÃO ---

      } catch (err) {
          console.error("Erro ao salvar configuração:", err);
      }
  });
  ipcMain.handle('select-audio-file', async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
      title: 'Selecione um arquivo de áudio',
      filters: [ { name: 'Arquivos de Áudio', extensions: ['mp3', 'wav', 'ogg', 'm4a'] } ],
      properties: ['openFile']
    });
    return !canceled && filePaths.length > 0 ? filePaths[0] : null;
  });

  // --- ADICIONADO ---
  // Handler para COPIAR um arquivo de áudio para a pasta de dados do app
  // Usamos 'imported_sounds/sounds/' para manter a consistência com sua lógica de Import/Export
  ipcMain.handle('copy-audio-file', (event, originalFilePath) => {
    try {
        const soundsPath = path.join(app.getPath('userData'), 'imported_sounds', 'sounds');
        
        // 1. Garante que o diretório exista
        fs.mkdirSync(soundsPath, { recursive: true });

        // 2. Cria um nome de arquivo único
        const uniqueName = `${Date.now()}-${path.basename(originalFilePath)}`;
        const destPath = path.join(soundsPath, uniqueName);

        // 3. Copia o arquivo
        fs.copyFileSync(originalFilePath, destPath);

        // 4. Retorna o NOVO caminho absoluto
        return { success: true, path: destPath };
    } catch (err) {
        console.error('Falha ao copiar arquivo:', err);
        return { success: false, error: err.message };
    }
  });

  // Handler para DELETAR um arquivo de áudio da pasta de dados do app
  ipcMain.handle('delete-audio-file', (event, filePathToDelete) => {
    try {
        const soundsPath = path.join(app.getPath('userData'), 'imported_sounds', 'sounds');
        
        // --- Verificação de Segurança ---
        // Garante que só estamos deletando arquivos DENTRO da nossa pasta
        const normalizedSoundsDir = path.normalize(soundsPath);
        const normalizedFilePath = path.normalize(filePathToDelete);

        if (!normalizedFilePath.startsWith(normalizedSoundsDir)) {
            console.warn(`Tentativa de exclusão de arquivo fora do diretório: ${filePathToDelete}`);
            return { success: false, error: 'Caminho inválido' };
        }
        // --- Fim da Verificação ---

        if (fs.existsSync(normalizedFilePath)) {
            fs.unlinkSync(normalizedFilePath);
            return { success: true };
        } else {
            console.warn(`Arquivo não encontrado para exclusão: ${filePathToDelete}`);
            return { success: true, message: 'Arquivo não encontrado' };
        }
    } catch (err) {
        console.error('Falha ao deletar arquivo:', err);
        return { success: false, error: err.message };
    }
  });
  // --- FIM DA ADIÇÃO ---


  ipcMain.handle('get-system-volume', async () => {
    try {
      const volume = await loudness.getVolume();
      return volume;
    } catch (err) {
      console.error('Erro ao obter volume:', err);
      return null;
    }
  });

  ipcMain.handle('set-system-volume', async (event, volume) => {
    try {
      await loudness.setVolume(volume);
      return { success: true };
    } catch (err) {
      console.error('Erro ao definir volume:', err);
      return { success: false, error: err };
    }
  });

  ipcMain.handle('export-profile', async () => {
    const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, {
      title: 'Exportar Perfil do Soundboard',
      defaultPath: `soundboard-backup-${Date.now()}.zip`,
      filters: [{ name: 'Arquivos Zip', extensions: ['zip'] }]
    });

    if (canceled || !filePath) {
      return { success: false, message: 'Exportação cancelada.' };
    }

    try {
      const zip = new AdmZip();
      const exportConfig = JSON.parse(JSON.stringify(appConfig)); // Cópia profunda
      
      // NOTA: Esta variável não estava sendo usada, mas a lógica de 'imported_sounds' está correta
      const soundFilesDir = path.join(app.getPath('userData'), 'imported_sounds'); 

      // Garante que a pasta de importados exista
      if (!fs.existsSync(soundFilesDir)) {
        fs.mkdirSync(soundFilesDir, { recursive: true });
      }

      // 1. Itera sobre os sons, copia os áudios e relativiza os caminhos
      for (const soundName in exportConfig.sounds) {
        const soundData = exportConfig.sounds[soundName];
        const originalPath = soundData.path; // Este agora será um caminho absoluto para '.../imported_sounds/sounds/...'

        if (originalPath && fs.existsSync(originalPath)) {
          const filename = path.basename(originalPath);
          const newRelativePath = `sounds/${filename}`; // O caminho relativo DENTRO do zip
          
          // Adiciona o arquivo de áudio ao zip NA PASTA 'sounds/'
          zip.addLocalFile(originalPath, 'sounds/');
          
          // ATUALIZA o caminho no config que será salvo no zip
          soundData.path = newRelativePath; 
        } else {
          // Se o áudio não for encontrado, marca como "perdido"
          soundData.path = null; 
        }
      }

      // 2. Adiciona o arquivo config.json (com caminhos relativos) ao zip
      zip.addFile('config.json', Buffer.from(JSON.stringify(exportConfig, null, 2)), 'Configuração do Soundboard');

      // 3. Salva o arquivo .zip
      zip.writeZip(filePath);

      return { success: true, message: 'Perfil exportado com sucesso!' };
    } catch (err) {
      console.error('Erro ao exportar:', err);
      return { success: false, message: `Erro ao exportar: ${err.message}` };
    }
  });

  ipcMain.handle('import-profile', async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
      title: 'Importar Perfil do Soundboard',
      filters: [{ name: 'Arquivos Zip', extensions: ['zip'] }],
      properties: ['openFile']
    });

    if (canceled || !filePaths.length) {
      return { success: false, message: 'Importação cancelada.' };
    }

    const zipPath = filePaths[0];
    const soundsDir = path.join(app.getPath('userData'), 'imported_sounds'); // Onde os áudios serão extraídos

    try {
      const zip = new AdmZip(zipPath);
      
      // 1. Verifica se o config.json existe no zip
      const configEntry = zip.getEntry('config.json');
      if (!configEntry) {
        throw new Error('Arquivo .zip inválido: config.json não encontrado.');
      }

      // Pede confirmação ao usuário, pois vai sobrescrever TUDO
      const { response } = await dialog.showMessageBox(mainWindow, {
        type: 'warning',
        title: 'Confirmar Importação',
        message: 'Importar um perfil irá sobrescrever todas as suas configurações, sons e atalhos atuais. Deseja continuar?',
        buttons: ['Cancelar', 'Importar'],
        defaultId: 0,
        cancelId: 0
      });

      if (response !== 1) { // Se não for "Importar"
        return { success: false, message: 'Importação cancelada pelo usuário.' };
      }

      // 2. Extrai os áudios para a pasta 'imported_sounds'
      if (!fs.existsSync(soundsDir)) {
        fs.mkdirSync(soundsDir, { recursive: true });
      }
      zip.extractAllTo(soundsDir, /*overwrite*/ true); // Extrai tudo (incluindo o config.json e a pasta 'sounds/')

      // 3. Lê o config.json extraído
      const importConfigPath = path.join(soundsDir, 'config.json');
      const configText = fs.readFileSync(importConfigPath, 'utf-8');
      const importConfig = JSON.parse(configText);

      // 4. "Absolutiza" os caminhos (converte 'sounds/meme.mp3' para 'C:/.../imported_sounds/sounds/meme.mp3')
      for (const soundName in importConfig.sounds) {
        const soundData = importConfig.sounds[soundName];
        if (soundData.path) { // Se não for null
          const filename = path.basename(soundData.path);
          const newAbsolutePath = path.join(soundsDir, 'sounds', filename); // O zip extrai mantendo a pasta 'sounds'
          
          if (fs.existsSync(newAbsolutePath)) {
            soundData.path = newAbsolutePath;
          } else {
            soundData.path = null; // Marcado como perdido se não foi extraído
          }
        }
      }

      // 5. Salva a nova configuração como a principal
      fs.writeFileSync(configPath, JSON.stringify(importConfig, null, 2), 'utf-8');
      appConfig = importConfig; // Atualiza a config em memória

      // 6. Recarrega a aplicação inteira para que tudo seja atualizado
      mainWindow.reload();

      return { success: true }; // O 'reload' vai tratar de tudo

    } catch (err) {
      console.error('Erro ao importar:', err);
      return { success: false, message: `Erro ao importar: ${err.message}` };
    }
  });

  ipcMain.handle('update-overlay-hotkey', async (event, newHotkey) => {
    const currentHotkey = appConfig.settings.overlayHotkey;
    
    // 1. Desregistra o atalho antigo
    if (currentHotkey) {
        globalShortcut.unregister(currentHotkey);
    }

    try {
        // 2. Tenta registrar o novo
        const ret = globalShortcut.register(newHotkey, () => {
            if (overlayWindow) {
                overlayWindow.close();
            } else {
                createOverlayWindow();
            }
        });

        if (!ret) { // Falha se o atalho for inválido ou já estiver em uso
             throw new Error('Falha ao registrar, atalho inválido ou em uso.');
        }

        // 3. Sucesso: Atualiza a config e salva no arquivo
        appConfig.settings.overlayHotkey = newHotkey;
        fs.writeFileSync(configPath, JSON.stringify(appConfig, null, 2), 'utf-8');
        return { success: true };

    } catch (err) {
        // 4. Falha: Registra o atalho antigo de volta (Rollback)
        console.error('Falha ao registrar novo atalho, revertendo...', err);
        if (currentHotkey) {
            globalShortcut.register(currentHotkey, () => {
                if (overlayWindow) overlayWindow.close();
                else createOverlayWindow();
            });
        }
        return { success: false, message: 'Falha ao registrar atalho. Pode ser inválido ou estar em uso por outro aplicativo.' };
    }
  });

  ipcMain.on('sound-list', (event, soundList) => {
      // 2. O main.js envia a lista para o overlay
      if (overlayWindow) {
          overlayWindow.show(); // Mostra o círculo agora que tem os dados
          overlayWindow.focus();
          overlayWindow.webContents.send('load-sounds', soundList);
      }
  });

  // 3. O overlay (overlay.html) pede para tocar um som
  ipcMain.on('play-sound-from-overlay', (event, soundName) => {
      // 4. O main.js manda a janela principal (que tem o <audio>) tocar
      if (mainWindow) {
          mainWindow.webContents.send('play-sound', soundName);
      }
      // Fecha o overlay após o comando
      if (overlayWindow) {
          overlayWindow.close();
      }
  });

  // 5. O overlay pede para fechar (ex: pressionou Escape)
  ipcMain.on('close-overlay', () => {
      if (overlayWindow) {
          overlayWindow.close();
      }
  });


//   ipcMain.on('broadcast-network-command', (event, command) => {
//     const message = Buffer.from(JSON.stringify({
//       appId: 'hahaha-soundboard', // Identificador para ignorar outros apps
//       command: command // 'MUTE' ou 'UNMUTE'
//     }));
    
//     udpSocket.send(message, udpPort, broadcastAddress, (err) => {
//       if (err) console.error('Erro ao enviar broadcast:', err);
//     });
//   });

  ipcMain.on('broadcast-network-command', (event, command) => {
    const user = os.hostname() || 'Usuário Desconhecido';
    const message = Buffer.from(JSON.stringify({
      appId: 'hahaha-soundboard',
      command: command, 
      user: user
    }));
    
    // --- MUDANÇA: Envia para o endereço MULTICAST ---
    udpSocket.send(message, udpPort, multicastAddress, (err) => {
      if (err) console.error('Erro ao enviar multicast:', err);
    });
  });
  // (Lógica de Janela - sem mudanças)
  mainWindow.on('minimize', (event) => { event.preventDefault(); mainWindow.hide(); });
  mainWindow.on('close', (event) => { if (!isQuitting) { event.preventDefault(); mainWindow.hide(); }});

  mainWindow.loadFile('index.html');

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });
}

// (Restante do arquivo - sem mudanças)
app.whenReady().then(() => {
    createWindow();
    registerAllHotkeys(appConfig.sounds);

    try {
        const overlayHotkey = appConfig.settings.overlayHotkey || 'CommandOrControl+Shift+Space';
        const ret = globalShortcut.register(overlayHotkey, () => {
            if (overlayWindow) {
                overlayWindow.close();
            } else {
                createOverlayWindow();
            }
        });

        if (!ret) {
            console.log('Falha ao registrar o atalho global');
        }
    } catch (err) {
        console.error('Erro ao registrar atalho global:', err);
    }

    // udpSocket.on('error', (err) => {
    //   console.error(`Erro no socket UDP:\n${err.stack}`);
    //   udpSocket.close();
    // });

    // udpSocket.on('message', (msg, rinfo) => {
    //   // Recebeu uma mensagem de outro app na rede
    //   try {
    //     const message = JSON.parse(msg.toString());
    //     if (message.appId === 'hahaha-soundboard' && mainWindow) {
    //       // Envia o comando para o 'index.html'
    //       mainWindow.webContents.send('network-status', message);
    //     }
    //   } catch (e) {
    //     // Ignora mensagens malformadas
    //   }
    // });

    // udpSocket.bind(udpPort, () => {
    //   udpSocket.setBroadcast(true);
    //   console.log(`Socket UDP ouvindo na porta ${udpPort}`);
    // });

    udpSocket.on('error', (err) => {
      console.error(`Erro no socket UDP:\n${err.stack}`);
      udpSocket.close();
    });

    udpSocket.on('message', (msg, rinfo) => {
      try {
        const message = JSON.parse(msg.toString());
        if (message.appId === 'hahaha-soundboard' && mainWindow) {
          mainWindow.webContents.send('network-status', message);
        }
      } catch (e) {
        // Ignora mensagens malformadas
      }
    });

    udpSocket.bind(udpPort, () => {
        // Em vez de setBroadcast, vamos nos juntar ao grupo multicast
        try {
            udpSocket.setMulticastTTL(128); // Define o "Time To Live" dos pacotes
            udpSocket.addMembership(multicastAddress, '0.0.0.0'); // Entra no grupo em todas as interfaces
            console.log(`Socket UDP ouvindo na porta ${udpPort} e inscrito no grupo ${multicastAddress}`);
        } catch (err) {
            console.error('Erro ao ingressar no grupo multicast:', err);
        }
    });

    app.on('before-quit', () => { isQuitting = true; });

    const iconPath = path.join(__dirname, 'icon.png');
    if (fs.existsSync(iconPath)) {
        tray = new Tray(iconPath);
        const contextMenu = Menu.buildFromTemplate([
            { label: 'Abrir Soundboard', click: () => { mainWindow.show(); } },
            { label: 'Sair', click: () => { app.quit(); } }
        ]);
        tray.setContextMenu(contextMenu);
        tray.setToolTip('Soundboard está em execução.');
        tray.on('click', () => { mainWindow.show(); });
    } else {
        console.error(`Ícone não encontrado: ${iconPath}`);
    }

    app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});

app.on('will-quit', () => { globalShortcut.unregisterAll(); });
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });