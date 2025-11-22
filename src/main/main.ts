// src/main/main.ts
import { app, BrowserWindow, ipcMain } from 'electron';
import * as path from 'path';
import * as ssh2 from 'ssh2';
import Store from 'electron-store';

const store = new Store();

let mainWindow: BrowserWindow | null = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    },
    backgroundColor: '#0f172a',
    titleBarStyle: 'hidden'
  });

  const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;
  
  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
  }

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
        
        stream.on('data', (data: Buffer) => {
          output += data.toString();
        });
        
        stream.stderr.on('data', (data: Buffer) => {
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