const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

let win;
const CONFIG_PATH = path.join(app.getPath('userData'), 'config.json');

function loadEnginePath() {
    if (!fs.existsSync(CONFIG_PATH)) return "";
    try {
        const raw = fs.readFileSync(CONFIG_PATH, 'utf8');
        const cfg = JSON.parse(raw);
        // 互換: 以前は exePath で保存していた
        return cfg.enginePath || cfg.exePath || "";
    } catch {
        return "";
    }
}

let coeiroinkPath = loadEnginePath();

function createWindow() {
    win = new BrowserWindow({
        width: 700, height: 500, frame: false,
        webPreferences: { 
            nodeIntegration: true, 
            contextIsolation: false,
            webSecurity: false,
            partition: 'persist:main'
        }
    });
    win.loadFile('src/index.html');
}

ipcMain.on('select-exe', async (event) => {
    const isMac = process.platform === 'darwin';
    const filters = isMac
        ? [{ name: 'COEIROINK.app', extensions: ['app'] }]
        : [{ name: 'COEIROINK.exe', extensions: ['exe'] }];

    const result = await dialog.showOpenDialog(win, {
        properties: isMac ? ['openFile', 'openDirectory'] : ['openFile'],
        filters,
    });
    if (!result.canceled) {
        const selectedPath = result.filePaths[0];
        if (isMac && !selectedPath.toLowerCase().endsWith('.app')) {
            event.reply('engine-error', 'mac版は COEIROINK.app を選択してください');
            return;
        }

        coeiroinkPath = selectedPath;
        fs.writeFileSync(CONFIG_PATH, JSON.stringify({ enginePath: coeiroinkPath }));
        event.reply('path-selected', coeiroinkPath);
    }
});

ipcMain.on('launch-engine', (event) => {
    if (!coeiroinkPath) {
        event.reply('engine-error', '先にSETTINGから COEIROINK を指定してください');
        return;
    }

    const isMac = process.platform === 'darwin';

    const child = isMac
        ? spawn('open', [coeiroinkPath], { detached: true, stdio: 'ignore' })
        : spawn(`"${coeiroinkPath}"`, [], { shell: true, detached: true, stdio: 'ignore' });

    child.unref();
});

ipcMain.on('open-about', () => {
    let aboutWin = new BrowserWindow({ width: 350, height: 500, frame: false,
        resizable: false, 
        autoHideMenuBar: true,
        webPreferences: { 
            preload: path.join(__dirname, 'preload.js'),
            nodeIntegration: false,
            contextIsolation: true
        } 
    });
    aboutWin.loadFile('src/about.html');
});

ipcMain.on('toggle-always-on-top', (event) => {
    const isAlwaysOnTop = win.isAlwaysOnTop();
    win.setAlwaysOnTop(!isAlwaysOnTop);
    event.reply('always-on-top-status', !isAlwaysOnTop);
});

ipcMain.on('window-close', () => {
    app.quit();
});
ipcMain.on('window-minimize', () => win.minimize());

app.whenReady().then(createWindow);

ipcMain.handle("get-version", () => app.getVersion());

app.on('window-all-closed', () => {
    app.quit();
});
