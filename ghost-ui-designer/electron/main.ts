import { app, BrowserWindow, dialog, ipcMain } from 'electron';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import type { SceneDocument } from '../src/model/scene';
import { readSceneFromSource, writeSceneToSource } from '../src/codegen/roundtrip';
import { generateResourcesHeader } from '../src/codegen/iplug2/resources';
import { IPC, type FilmstripPng } from './ipc-contract';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    backgroundColor: '#17171a',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  if (process.env.VITE_DEV_SERVER_URL) {
    await win.loadURL(process.env.VITE_DEV_SERVER_URL);
    win.webContents.openDevTools({ mode: 'detach' });
  } else {
    await win.loadFile(path.join(__dirname, '../dist/index.html'));
  }
}

ipcMain.handle(IPC.saveProject, async (_e, scene: SceneDocument, suggested?: string) => {
  const { canceled, filePath } = await dialog.showSaveDialog({
    defaultPath: suggested ?? `${scene.meta.pluginName || 'project'}.ghostui`,
    filters: [{ name: 'Ghost UI', extensions: ['ghostui'] }],
  });
  if (canceled || !filePath) return null;
  await writeFile(filePath, JSON.stringify(scene, null, 2), 'utf8');
  return filePath;
});

ipcMain.handle(IPC.openProject, async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog({
    properties: ['openFile'],
    filters: [{ name: 'Ghost UI', extensions: ['ghostui'] }],
  });
  if (canceled || filePaths.length === 0) return null;
  const scene = JSON.parse(await readFile(filePaths[0], 'utf8')) as SceneDocument;
  return { path: filePaths[0], scene };
});

ipcMain.handle(IPC.exportCpp, async (_e, scene: SceneDocument, target: string) => {
  const existing = existsSync(target) ? await readFile(target, 'utf8') : null;
  const { source, merged } = writeSceneToSource(scene, existing);
  await writeFile(target, source, 'utf8');
  return { merged };
});

ipcMain.handle(IPC.importCpp, async (_e, target: string) => {
  const source = await readFile(target, 'utf8');
  const { found, controls } = readSceneFromSource(source);
  return { found, controls };
});

ipcMain.handle(IPC.previewCpp, async (_e, scene: SceneDocument, existing: string | null) => {
  return writeSceneToSource(scene, existing).source;
});

ipcMain.handle(
  IPC.exportBundle,
  async (_e, scene: SceneDocument, assets: FilmstripPng[]) => {
    const { canceled, filePaths } = await dialog.showOpenDialog({
      properties: ['openDirectory', 'createDirectory'],
      title: 'Carpeta de destino del bundle',
    });
    if (canceled || filePaths.length === 0) return null;
    const dir = filePaths[0];
    const name = scene.meta.pluginName || 'Plugin';

    // 1) C++ con round-trip (preserva el código a mano si el archivo ya existe).
    const cppPath = path.join(dir, `${name}.cpp`);
    const existing = existsSync(cppPath) ? await readFile(cppPath, 'utf8') : null;
    const { source, merged } = writeSceneToSource(scene, existing);
    await writeFile(cppPath, source, 'utf8');

    // 2) Cabecera de recursos.
    await writeFile(
      path.join(dir, `${name}_resources.h`),
      generateResourcesHeader(scene),
      'utf8',
    );

    // 3) PNGs de filmstrip (rasterizados en el renderer).
    if (assets.length > 0) {
      const resDir = path.join(dir, 'resources');
      await mkdir(resDir, { recursive: true });
      for (const a of assets) {
        const b64 = a.dataUri.replace(/^data:image\/png;base64,/, '');
        await writeFile(path.join(resDir, a.file), Buffer.from(b64, 'base64'));
      }
    }
    return { dir, merged };
  },
);

app.whenReady().then(createWindow);
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
