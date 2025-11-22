"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// src/main/main.ts
const electron_1 = require("electron");
const path = __importStar(require("path"));
const ssh2 = __importStar(require("ssh2"));
const electron_store_1 = __importDefault(require("electron-store"));
const store = new electron_store_1.default();
let mainWindow = null;
function createWindow() {
    mainWindow = new electron_1.BrowserWindow({
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
    const isDev = process.env.NODE_ENV === 'development' || !electron_1.app.isPackaged;
    if (isDev) {
        mainWindow.loadURL('http://localhost:5173');
        mainWindow.webContents.openDevTools();
    }
    else {
        mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
    }
    mainWindow.on('closed', () => {
        mainWindow = null;
    });
}
electron_1.app.whenReady().then(createWindow);
electron_1.app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        electron_1.app.quit();
    }
});
electron_1.app.on('activate', () => {
    if (electron_1.BrowserWindow.getAllWindows().length === 0) {
        createWindow();
    }
});
// IPC Handlers
electron_1.ipcMain.handle('ssh:connect', async (_, config) => {
    return new Promise((resolve, reject) => {
        const conn = new ssh2.Client();
        conn.on('ready', () => {
            if (config.snippet) {
                conn.exec(config.snippet, (err) => {
                    if (err)
                        console.error('Snippet error:', err);
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
electron_1.ipcMain.handle('ssh:execute', async (_, config, command) => {
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
electron_1.ipcMain.handle('sftp:upload', async (_, config, localPath, remotePath) => {
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
                    }
                    else {
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
electron_1.ipcMain.handle('store:get', (_, key) => {
    return store.get(key);
});
electron_1.ipcMain.handle('store:set', (_, key, value) => {
    store.set(key, value);
});
electron_1.ipcMain.handle('store:delete', (_, key) => {
    store.delete(key);
});
