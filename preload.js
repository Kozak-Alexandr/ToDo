const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('aodAPI', {
  onCursorMove: (callback) => ipcRenderer.on('cursor-pos', (_event, value) => callback(value)),
  resizeWindow: (height) => ipcRenderer.send('resize-window', height)
});
