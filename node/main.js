const { app, BrowserWindow } = require('electron');
const path = require('path');

// const { app, BrowserWindow, session } = require('electron');
let mainWindow;




// async function clearAllCache() {
//   const ses = session.defaultSession;
//   await ses.clearStorageData({
//     storages: ['cookies', 'localstorage', 'cachestorage', 'indexdb', 'shadercache', 'websql', 'serviceworkers']
//   });
//   console.log('[Main] 已清除所有缓存');
// }
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: true
    },
    icon: path.join(__dirname, 'icon.png'),
    title: 'Telegram Translator'
  });

  // 加载 Telegram Web
  mainWindow.loadURL('https://web.telegram.org/k/');

  // 注入自定义 CSS
  mainWindow.webContents.on('did-finish-load', () => {
    mainWindow.webContents.insertCSS(`
      .translation-text {
        font-size: 12px;
        color: #888;
        padding: 4px 8px;
        margin-top: 4px;
        background: rgba(0, 0, 0, 0.05);
        border-radius: 4px;
        font-style: italic;
      }
      .dark .translation-text {
        background: rgba(255, 255, 255, 0.1);
        color: #aaa;
      }
    `);
  });

  // 开发调试时可以打开开发者工具
  // mainWindow.webContents.openDevTools();
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
