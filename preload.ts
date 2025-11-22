const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electron', {
  ssh: {
    connect: (config) => ipcRenderer.invoke('ssh:connect', config),
    execute: (config, command) => ipcRenderer.invoke('ssh:execute', config, command)
  },
  sftp: {
    upload: (config, localPath, remotePath) => 
      ipcRenderer.invoke('sftp:upload', config, localPath, remotePath)
  },
  store: {
    get: (key) => ipcRenderer.invoke('store:get', key),
    set: (key, value) => ipcRenderer.invoke('store:set', key, value),
    delete: (key) => ipcRenderer.invoke('store:delete', key)
  }
});