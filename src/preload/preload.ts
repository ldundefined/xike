import { contextBridge, ipcRenderer } from 'electron';
import type { Command, DesktopApi, Snapshot } from '../shared/types';

const api: DesktopApi = {
  getState: () => ipcRenderer.invoke('xike:get-state'),
  command: (command: Command) => ipcRenderer.invoke('xike:command', command),
  subscribe: listener => {
    const handler = (_event: Electron.IpcRendererEvent, snapshot: Snapshot) => listener(snapshot);
    ipcRenderer.on('xike:state', handler);
    return () => ipcRenderer.removeListener('xike:state', handler);
  },
};
contextBridge.exposeInMainWorld('xike', api);
