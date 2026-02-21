const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

let win;
const CONFIG_PATH = path.join(app.getPath('userData'), 'config.json');
let coeiroinkPath = fs.existsSync(CONFIG_PATH) ? JSON.parse(fs.readFileSync(CONFIG_PATH)).exePath : "";

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
    const result = await dialog.showOpenDialog(win, { properties: ['openFile'], filters: [{ name: 'COEIROINK.exe', extensions: ['exe'] }] });
    if (!result.canceled) {
        coeiroinkPath = result.filePaths[0];
        fs.writeFileSync(CONFIG_PATH, JSON.stringify({ exePath: coeiroinkPath }));
        event.reply('path-selected', coeiroinkPath);
    }
});

ipcMain.on('launch-engine', (event) => {
    if (!coeiroinkPath) {
        event.reply('engine-error', '先にSETTINGからexeを指定してください');
        return;
    }

    const child = spawn(`"${coeiroinkPath}"`, [], {
        shell: true,
        detached: true,
        stdio: 'ignore'
    });

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

ipcMain.on('window-close', () => app.quit());
ipcMain.on('window-minimize', () => win.minimize());

app.whenReady().then(createWindow);

ipcMain.handle("get-version", () => app.getVersion());
