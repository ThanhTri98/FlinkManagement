const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const ssh2 = require('ssh2');
const Store = require('electron-store');

const store = new Store();
let mainWindow = null;

function createWindow() {
  let preloadPath;
  
  if (app.isPackaged) {
    // Production: preload.js nằm ngoài app.asar
    preloadPath = path.join(process.resourcesPath, 'preload.js');
    
    // Nếu không tồn tại, copy từ app.asar
    if (!fs.existsSync(preloadPath)) {
      const sourcePreload = path.join(__dirname, 'preload.js');
      if (fs.existsSync(sourcePreload)) {
        fs.copyFileSync(sourcePreload, preloadPath);
      }
    }
  } else {
    // Development
    preloadPath = path.join(__dirname, 'preload.js');
  }

  console.log('Preload path:', preloadPath);
  console.log('Preload exists:', fs.existsSync(preloadPath));

  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: preloadPath
    },
    backgroundColor: '#0f172a',
    show: false
  });

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  const isDev = !app.isPackaged;
  
  if (isDev) {
    mainWindow.loadURL('http://localhost:5173')
      .then(() => console.log('Loaded dev URL'))
      .catch(err => console.error('Failed to load:', err));
    mainWindow.webContents.openDevTools();
  } else {
    const indexPath = path.join(__dirname, 'dist', 'renderer', 'index.html');
    console.log('Index path:', indexPath);
    mainWindow.loadFile(indexPath)
      .then(() => console.log('Loaded production'))
      .catch(err => console.error('Failed to load:', err));
  }

  mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
    console.error('Failed to load:', errorCode, errorDescription);
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// IPC Handlers
ipcMain.handle('ssh:connect', async (_, config) => {
  return new Promise((resolve, reject) => {
    const conn = new ssh2.Client();
    
    conn.on('ready', () => {
      if (config.snippet) {
        conn.exec(config.snippet, (err) => {
          if (err) console.error('Snippet error:', err);
        });
      }
      conn.end();
      resolve({ success: true, message: 'Connected successfully' });
    });
    
    conn.on('error', (err) => {
      reject({ success: false, message: err.message });
    });
    
    conn.connect({
      host: config.host,
      port: config.port || 22,
      username: config.username,
      password: config.password,
      privateKey: config.privateKey
    });
  });
});

ipcMain.handle('ssh:execute', async (_, config, command) => {
  return new Promise((resolve, reject) => {
    const conn = new ssh2.Client();
    
    conn.on('ready', () => {
      conn.exec(command, (err, stream) => {
        if (err) {
          conn.end();
          return reject({ success: false, message: err.message });
        }
        
        let output = '';
        let errorOutput = '';
        
        stream.on('data', (data) => {
          output += data.toString();
        });
        
        stream.stderr.on('data', (data) => {
          errorOutput += data.toString();
        });
        
        stream.on('close', () => {
          conn.end();
          resolve({ 
            success: true, 
            output: output || errorOutput,
            error: !!errorOutput
          });
        });
      });
    });
    
    conn.on('error', (err) => {
      reject({ success: false, message: err.message });
    });
    
    conn.connect({
      host: config.host,
      port: config.port || 22,
      username: config.username,
      password: config.password,
      privateKey: config.privateKey
    });
  });
});

ipcMain.handle('sftp:upload', async (_, config, localPath, remotePath) => {
  return new Promise((resolve, reject) => {
    const conn = new ssh2.Client();
    
    conn.on('ready', () => {
      conn.sftp((err, sftp) => {
        if (err) {
          conn.end();
          return reject({ success: false, message: err.message });
        }
        
        sftp.fastPut(localPath, remotePath, (err) => {
          conn.end();
          if (err) {
            reject({ success: false, message: err.message });
          } else {
            resolve({ success: true, message: 'File uploaded successfully' });
          }
        });
      });
    });
    
    conn.on('error', (err) => {
      reject({ success: false, message: err.message });
    });
    
    conn.connect({
      host: config.host,
      port: config.port || 22,
      username: config.username,
      password: config.password,
      privateKey: config.privateKey
    });
  });
});

ipcMain.handle('store:get', (_, key) => {
  return store.get(key);
});

ipcMain.handle('store:set', (_, key, value) => {
  store.set(key, value);
});

ipcMain.handle('store:delete', (_, key) => {
  store.delete(key);
});