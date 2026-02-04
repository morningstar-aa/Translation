const { app, BrowserWindow, ipcMain, session, globalShortcut, Menu } = require('electron');
const path = require('path');
const { execSync } = require('child_process');

/**
 * 获取机器唯一标识 (UUID)
 */
function getMachineId() {
  try {
    if (process.platform === 'darwin') {
      const output = execSync('ioreg -rd1 -c IOPlatformExpertDevice').toString();
      const match = output.match(/"IOPlatformUUID" = "([^"]+)"/);
      return match ? match[1] : 'mac-fallback-id';
    } else if (process.platform === 'win32') {
      const output = execSync('wmic csproduct get uuid').toString();
      return output.split('\n')[1].trim() || 'win-fallback-id';
    }
    return 'unknown-device';
  } catch (e) {
    console.error('[Main] 获取机器码失败:', e);
    return 'error-device-id';
  }
}

// 注册 IPC
ipcMain.handle('get-machine-id', () => getMachineId());

// 多窗口管理
const windows = new Set();
const secondaryWindowIds = new Set();

// 检查是否为副窗口
ipcMain.handle('is-secondary-window', (event) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  return win ? secondaryWindowIds.has(win.id) : false;
});

function createWindow(isSecondary = false) {
  let newWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: true // 保持开启，保障安全
    },
    icon: path.join(__dirname, 'icon.png'),
    title: 'Telegram Translator'
  });

  // 如果是副窗口，移除菜单栏
  if (isSecondary) {
    newWindow.setMenu(null);
  }

  // 加载 Telegram Web
  newWindow.loadURL('https://web.telegram.org/k/');

  windows.add(newWindow);
  if (isSecondary) {
    secondaryWindowIds.add(newWindow.id);
  }

  newWindow.on('closed', () => {
    windows.delete(newWindow);
    secondaryWindowIds.delete(newWindow.id);
    newWindow = null;
  });

  // 注入自定义 CSS
  newWindow.webContents.on('did-finish-load', () => {
    newWindow.webContents.insertCSS(`
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

  return newWindow;
}

// 监听打开新窗口请求
ipcMain.on('open-new-window', () => {
  createWindow(true);
});

app.whenReady().then(() => {
  createWindow(false); // 主窗口

  // 注册 F12 快捷键切换开发者工具 (仅用于本地调试)
  globalShortcut.register('F12', () => {
    let win = BrowserWindow.getFocusedWindow();
    if (win) win.webContents.toggleDevTools();
  });

  // 同时也支持通用的 CommandOrControl+Shift+I
  globalShortcut.register('CommandOrControl+Shift+I', () => {
    let win = BrowserWindow.getFocusedWindow();
    if (win) win.webContents.toggleDevTools();
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow(false);
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
