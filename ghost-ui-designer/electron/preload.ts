import { contextBridge, ipcRenderer } from 'electron';
import { IPC, type GhostApi } from './ipc-contract';

const api: GhostApi = {
  saveProject: (scene, suggestedPath) =>
    ipcRenderer.invoke(IPC.saveProject, scene, suggestedPath),
  openProject: () => ipcRenderer.invoke(IPC.openProject),
  exportCpp: (scene, path) => ipcRenderer.invoke(IPC.exportCpp, scene, path),
  importCpp: (path) => ipcRenderer.invoke(IPC.importCpp, path),
  previewCpp: (scene, existingSource) =>
    ipcRenderer.invoke(IPC.previewCpp, scene, existingSource),
  exportBundle: (scene, assets) =>
    ipcRenderer.invoke(IPC.exportBundle, scene, assets),
  importImage: () => ipcRenderer.invoke(IPC.importImage),
};

contextBridge.exposeInMainWorld('ghost', api);
