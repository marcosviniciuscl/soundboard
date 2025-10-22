const { app, BrowserWindow, ipcMain, dialog, globalShortcut, Tray, Menu } = require('electron');
const { autoUpdater } = require('electron-updater'); // Importa o autoUpdater
const path = require('path');
const fs = require('fs');
const loudness = require('loudness');

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
            return appConfig;
        }
    } catch (err) {
        console.error("Erro ao carregar configuração:", err);
    }
    appConfig = { settings: { audioDevice: 'default' }, sounds: {} };
    return appConfig;
}
function registerAllHotkeys(sounds) {
    globalShortcut.unregisterAll();
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

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1000,
    height: 800,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
    icon: path.join(__dirname, 'icon.png')
  });

  mainWindow.removeMenu();
  loadSoundsConfig();

  // --- LÓGICA DE ATUALIZAÇÃO ---
  // Assim que a janela estiver pronta, verifica por atualizações.
  mainWindow.webContents.on('did-finish-load', () => {
    // Para ambientes de desenvolvimento, desativa a busca para evitar erros.
    if (!app.isPackaged) {
      console.log('Verificação de atualização desativada em modo de desenvolvimento.');
      return;
    }
    autoUpdater.checkForUpdatesAndNotify();
  });

  autoUpdater.on('update-available', () => {
    mainWindow.webContents.send('update-available');
  });

  autoUpdater.on('update-downloaded', () => {
    mainWindow.webContents.send('update-downloaded');
  });

  // O renderer vai chamar este evento para reiniciar o app.
  ipcMain.on('restart-app', () => {
    autoUpdater.quitAndInstall();
  });
  // --- FIM DA LÓGICA DE ATUALIZAÇÃO ---

  // (Lógica de IPC para config e arquivos - sem mudanças)
  ipcMain.handle('load-config', async () => appConfig);
  ipcMain.handle('save-config', async (event, config) => {
    try {
      const data = JSON.stringify(config, null, 2);
      fs.writeFileSync(configPath, data, 'utf-8');
      appConfig = config;
      registerAllHotkeys(appConfig.sounds);
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

  // (Lógica de Janela - sem mudanças)
  mainWindow.on('minimize', (event) => { event.preventDefault(); mainWindow.hide(); });
  mainWindow.on('close', (event) => { if (!isQuitting) { event.preventDefault(); mainWindow.hide(); }});

  mainWindow.loadFile('index.html');
}

// (Restante do arquivo - sem mudanças)
app.whenReady().then(() => {
    createWindow();
    registerAllHotkeys(appConfig.sounds);
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



// const { app, BrowserWindow, ipcMain, dialog, globalShortcut, Tray, Menu } = require('electron'); 
// const path = require('path');
// const fs = require('fs');

// // --- (INÍCIO) CORREÇÃO 2: Trava de Instância Única ---
// // Isso deve ser feito bem no início.
// const gotTheLock = app.requestSingleInstanceLock();

// if (!gotTheLock) {
//   // Se não conseguirmos a trava, significa que o app já está rodando.
//   // Encerramos esta segunda instância imediatamente.
//   app.quit();
// } else {
//   // Esta é a primeira instância.
//   app.on('second-instance', (event, commandLine, workingDirectory) => {
//     // Se alguém tentar rodar uma segunda instância, esta função será chamada.
//     // Nós devemos focar a nossa janela.
//     if (mainWindow) {
//       if (mainWindow.isMinimized()) mainWindow.restore();
//       if (!mainWindow.isVisible()) mainWindow.show(); // Mostra se estiver oculto no tray
//       mainWindow.focus();
//     }
//   });
// }
// // --- (FIM) CORREÇÃO 2 ---


// const configPath = path.join(app.getPath('userData'), 'soundboard-config.json');

// let mainWindow;
// let appConfig = { settings: { audioDevice: 'default' }, sounds: {} };
// let tray = null;

// // --- (INÍCIO) CORREÇÃO 1: Flag para o Botão Sair ---
// // Esta variável vai controlar se estamos realmente saindo ou apenas escondendo.
// let isQuitting = false; 
// // --- (FIM) CORREÇÃO 1 ---


// // (Função loadSoundsConfig - Sem mudanças)
// function loadSoundsConfig() {
//   try {
//     if (fs.existsSync(configPath)) {
//       const data = fs.readFileSync(configPath, 'utf-8');
//       const config = JSON.parse(data);
//       if (config.sounds === undefined) {
//         console.log('Migrando configuração antiga para o novo formato...');
//         appConfig = {
//           settings: { audioDevice: 'default' },
//           sounds: config
//         };
//         fs.writeFileSync(configPath, JSON.stringify(appConfig, null, 2), 'utf-8');
//       } else {
//         appConfig = config;
//       }
//       return appConfig;
//     }
//   } catch (err) {
//     console.error("Erro ao carregar configuração:", err);
//   }
//   appConfig = { settings: { audioDevice: 'default' }, sounds: {} };
//   return appConfig;
// }

// // (Função registerAllHotkeys - Sem mudanças)
// function registerAllHotkeys(sounds) {
//     globalShortcut.unregisterAll();
//     if (!sounds) return;
//     Object.entries(sounds).forEach(([name, data]) => {
//         if (data.hotkey) {
//             try {
//                 globalShortcut.register(data.hotkey, () => {
//                     if (mainWindow) {
//                       mainWindow.webContents.send('play-sound', name);
//                     }
//                 });
//             } catch (err) {
//                 console.error(`Erro ao registrar atalho ${data.hotkey} para ${name}:`, err);
//             }
//         }
//     });
// }

// function createWindow() {
//   mainWindow = new BrowserWindow({
//     width: 1000,
//     height: 800,
//     webPreferences: {
//       nodeIntegration: true,
//       contextIsolation: false,
//     },
//     icon: path.join(__dirname, 'icon.png') 
//   });

//   mainWindow.removeMenu();
//   loadSoundsConfig();

//   // (Lógica de IPC - Sem mudanças)
//   ipcMain.handle('load-config', async () => {
//     return appConfig;
//   });
//   ipcMain.handle('save-config', async (event, config) => {
//     try {
//       const data = JSON.stringify(config, null, 2); 
//       fs.writeFileSync(configPath, data, 'utf-8');
//       appConfig = config;
//       registerAllHotkeys(appConfig.sounds); 
//     } catch (err) {
//       console.error("Erro ao salvar configuração:", err);
//     }
//   });
//   ipcMain.handle('select-audio-file', async () => {
//     const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
//       title: 'Selecione um arquivo de áudio',
//       filters: [
//         { name: 'Arquivos de Áudio', extensions: ['mp3', 'wav', 'ogg', 'm4a'] }
//       ],
//       properties: ['openFile']
//     });
//     if (!canceled && filePaths.length > 0) {
//       return filePaths[0]; 
//     }
//     return null;
//   });

//   // --- LÓGICA DE JANELA ATUALIZADA ---

//   // Oculta da barra de tarefas ao minimizar
//   mainWindow.on('minimize', (event) => {
//     event.preventDefault();
//     mainWindow.hide();
//   });

//   // --- (INÍCIO) CORREÇÃO 1: Modificação do 'close' ---
//   // Se fechar (clicar no X), esconde em vez de sair
//   mainWindow.on('close', (event) => {
//       if (!isQuitting) { // Verifica se NÃO estamos saindo
//         event.preventDefault();
//         mainWindow.hide();
//       }
//       // Se 'isQuitting' for true, o evento NÃO é prevenido
//       // e a janela será fechada, permitindo que o app saia.
//   });
//   // --- (FIM) CORREÇÃO 1 ---

//   mainWindow.loadFile('index.html');
// }

// // QUANDO O APP ESTIVER PRONTO
// app.whenReady().then(() => {
//   createWindow();
  
//   registerAllHotkeys(appConfig.sounds);

//   // --- (INÍCIO) CORREÇÃO 1: Adiciona o listener 'before-quit' ---
//   // Antes de o app começar a fechar (acionado pelo app.quit())
//   app.on('before-quit', () => {
//     isQuitting = true; // Define a flag que permite o fechamento
//   });
//   // --- (FIM) CORREÇÃO 1 ---

// // --- (INÍCIO) LÓGICA DO TRAY (PRIMEIRA VERSÃO) ---
  
//   const iconPath = path.join(__dirname, 'icon.png');
//   if (fs.existsSync(iconPath)) {
//     tray = new Tray(iconPath);

//     // 1. Crie o menu de contexto (para clique direito)
//     const contextMenu = Menu.buildFromTemplate([
//       {
//         label: 'Abrir Soundboard',
//         click: () => {
//           mainWindow.show();
//         }
//       },
//       {
//         label: 'Sair',
//         click: () => {
//           app.quit(); 
//         }
//       }
//     ]);

//     // 2. Define o menu de contexto
//     tray.setContextMenu(contextMenu);
//     tray.setToolTip('Soundboard está em execução.');

//     // 3. Ação de clique (esquerdo)
//     tray.on('click', () => {
//       mainWindow.show(); // Mostra a janela
//     });

//   } else {
//     console.error(`Ícone não encontrado: ${iconPath}`);
//     console.error("Crie um arquivo 'icon.png' na pasta raiz para o ícone da bandeja funcionar.");
//   }
//   // --- (FIM) LÓGICA DO TRAY (PRIMEIRA VERSÃO) ---

//   app.on('activate', () => {
//     if (BrowserWindow.getAllWindows().length === 0) {
//       createWindow();
//     }
//   });
// });

// // (Eventos 'will-quit' e 'window-all-closed' - Sem mudanças)
// app.on('will-quit', () => {
//   globalShortcut.unregisterAll();
// });

// app.on('window-all-closed', () => {
//   if (process.platform !== 'darwin') {
//     app.quit();
//   }
// });