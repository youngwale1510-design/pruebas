import { app, BrowserWindow, dialog, ipcMain, screen } from 'electron';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import type { SceneDocument } from '../src/model/scene';
import { readSceneFromSource, writeSceneToSource } from '../src/codegen/roundtrip';
import { generateResourcesHeader, generateResourcesRc, syncResourcesRc } from '../src/codegen/iplug2/resources';
import { readConfigSize, syncConfigSize, syncHeaderEnums } from '../src/codegen/iplug2/header';
import { moveElementInLayout, moveElementsInLayout, removeElementFromSource } from '../src/codegen/iplug2/cppDeps';
import { IPC, type FilmstripPng } from './ipc-contract';

/** Ventana padre para los diálogos (si no, en Windows pueden abrirse detrás). */
function dlgWin(): BrowserWindow {
  return BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0];
}

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
  const { canceled, filePath } = await dialog.showSaveDialog(dlgWin(), {
    defaultPath: suggested ?? `${scene.meta.pluginName || 'project'}.ghostui`,
    filters: [{ name: 'Ghost UI', extensions: ['ghostui'] }],
  });
  if (canceled || !filePath) return null;
  await writeFile(filePath, JSON.stringify(scene, null, 2), 'utf8');
  return filePath;
});

ipcMain.handle(IPC.openProject, async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog(dlgWin(), {
    properties: ['openFile'],
    filters: [{ name: 'Ghost UI', extensions: ['ghostui'] }],
  });
  if (canceled || filePaths.length === 0) return null;
  const scene = JSON.parse(await readFile(filePaths[0], 'utf8')) as SceneDocument;
  return { path: filePaths[0], scene };
});

/** Busca el .h que va con el .cpp (mismo nombre, misma carpeta) y le añade a
 *  EParams/ECtrlTags lo que falte. Nunca quita nada: si no lo encuentra, o el
 *  archivo no tiene esos enums, no toca nada y lo dice en el resultado. */
async function syncHeaderNextTo(cppPath: string, scene: SceneDocument) {
  const hPath = cppPath.replace(/\.[^./\\]+$/, '.h');
  if (hPath === cppPath || !existsSync(hPath)) return { headerFound: false, headerChanged: false };
  const existing = await readFile(hPath, 'utf8');
  const r = syncHeaderEnums(existing, scene);
  const changed = r.paramsChanged || r.tagsChanged;
  if (changed) await writeFile(hPath, r.source, 'utf8');
  return { headerFound: r.paramsFound || r.tagsFound, headerChanged: changed };
}

ipcMain.handle(IPC.exportCpp, async (_e, scene: SceneDocument, target: string) => {
  const existing = existsSync(target) ? await readFile(target, 'utf8') : null;
  const { source, merged } = writeSceneToSource(scene, existing);
  await writeFile(target, source, 'utf8');
  const h = await syncHeaderNextTo(target, scene);
  return { merged, ...h };
});

ipcMain.handle(IPC.importCpp, async (_e, target?: string, fallbackWidth?: number, fallbackHeight?: number) => {
  let file = target;
  if (!file) {
    const { canceled, filePaths } = await dialog.showOpenDialog(dlgWin(), {
      properties: ['openFile'],
      filters: [{ name: 'C++ iPlug2', extensions: ['cpp', 'cc', 'cxx', 'h', 'hpp'] }],
    });
    if (canceled || filePaths.length === 0) return null;
    file = filePaths[0];
  }
  const source = await readFile(file, 'utf8');

  // El tamaño real del plugin (para resolver las cuentas de IRECT de los
  // elementos escritos a mano) vive en config.h, junto al .cpp; si no está,
  // se usa el tamaño de lienzo actual del editor como mejor esfuerzo.
  let plugW = fallbackWidth;
  let plugH = fallbackHeight;
  const configPath = path.join(path.dirname(file), 'config.h');
  if (existsSync(configPath)) {
    const size = readConfigSize(await readFile(configPath, 'utf8'));
    if (size.width) plugW = size.width;
    if (size.height) plugH = size.height;
  }

  const { found, controls, refBoxes } = readSceneFromSource(source, plugW, plugH);
  return { path: file, found, controls, refBoxes };
});

ipcMain.handle(IPC.previewCpp, async (_e, scene: SceneDocument, existing: string | null) => {
  return writeSceneToSource(scene, existing).source;
});

ipcMain.handle(
  IPC.exportBundle,
  async (_e, scene: SceneDocument, assets: FilmstripPng[]) => {
    const { canceled, filePaths } = await dialog.showOpenDialog(dlgWin(), {
      properties: ['openDirectory', 'createDirectory'],
      title: 'Carpeta de destino del bundle',
    });
    if (canceled || filePaths.length === 0) return null;
    const dir = filePaths[0];
    const name = scene.meta.pluginName || 'Plugin';

    // 1) C++ con round-trip (preserva el código a mano si el archivo ya existe).
    const cppPath = path.join(dir, `${name}.cpp`);
    const existing = existsSync(cppPath) ? await readFile(cppPath, 'utf8') : null;
    const { source: mergedSource, merged } = writeSceneToSource(scene, existing);

    // 1a) Cirugía de C++ sobre elementos hechos a mano (vía tree-sitter),
    // antes de escribir el archivo final:
    //  - primero se borran los que el usuario marcó para eliminar (una RefBox
    //    ya no deja huella en el .cpp una vez borrada);
    //  - luego se mueven los que pidieron Antes/Después, agrupados por lado:
    //    intentar moverlos JUNTOS (no uno por uno) es lo que permite mover,
    //    p.ej., el Scope y el Kick Indicator cuando comparten una variable
    //    que nadie más usa ya (porque lo demás se borró) — por separado cada
    //    uno se vería bloqueado por el otro. Si el movimiento conjunto falla,
    //    se reintenta cada uno por separado por si alguno sí es seguro solo.
    let source = mergedSource;
    const moveWarnings: string[] = [];

    for (const box of scene.refBoxes ?? []) {
      if (!box.sourceTag || !box.remove) continue;
      const r = await removeElementFromSource(source, box.sourceTag);
      if (r.changed) source = r.source;
      else if (r.blockedReason) moveWarnings.push(`"${box.label}" (borrar): ${r.blockedReason}`);
    }

    const toMove = (scene.refBoxes ?? []).filter((b) => b.sourceTag && b.order && !b.remove);
    for (const direction of ['before', 'after'] as const) {
      const group = toMove.filter((b) => b.order === direction);
      if (group.length === 0) continue;

      const anchors = group.map((b) => b.sourceTag!);
      const joint = await moveElementsInLayout(source, anchors, direction);
      if (joint.changed) {
        source = joint.source;
        continue;
      }
      if (!joint.blockedReason) continue; // ya estaba bien puesto, o algún ancla no se encontró

      for (const box of group) {
        const r = await moveElementInLayout(source, box.sourceTag!, direction);
        if (r.changed) source = r.source;
        else if (r.blockedReason) moveWarnings.push(`"${box.label}": ${r.blockedReason}`);
      }
    }
    await writeFile(cppPath, source, 'utf8');

    // 1b) Enums EParams/ECtrlTags del .h (si existe): se les añade lo que falte.
    const h = await syncHeaderNextTo(cppPath, scene);

    // 1c) PLUG_WIDTH/PLUG_HEIGHT en config.h: si el lienzo cambió de tamaño
    // (p.ej. una imagen de fondo grande) y no se actualiza, la VENTANA del
    // plugin se queda con el tamaño viejo y solo se ve una esquina recortada
    // del diseño.
    const configPath = path.join(dir, 'config.h');
    let configFound = false;
    let configChanged = false;
    if (existsSync(configPath)) {
      const configSrc = await readFile(configPath, 'utf8');
      const r = syncConfigSize(configSrc, scene.canvas.width, scene.canvas.height);
      configFound = r.found;
      configChanged = r.changed;
      if (r.changed) await writeFile(configPath, r.source, 'utf8');
    }

    // 2) Cabecera de recursos.
    await writeFile(
      path.join(dir, `${name}_resources.h`),
      generateResourcesHeader(scene),
      'utf8',
    );

    await writeFile(path.join(dir, `${name}_resources.rc.txt`), generateResourcesRc(scene), 'utf8');

    // 2b) resources/main.rc: si existe, se le añaden las líneas PNG que falten
    // (sin tocar ni reordenar lo que ya haya). Sin esto, Windows no embebe los
    // filmstrip nuevos y el plugin arranca sin ellos.
    const rcPath = path.join(dir, 'resources', 'main.rc');
    let rcFound = false;
    let rcChanged = false;
    if (existsSync(rcPath)) {
      rcFound = true;
      const rcSrc = await readFile(rcPath, 'utf8');
      const r = syncResourcesRc(rcSrc, scene);
      rcChanged = r.changed;
      if (r.changed) await writeFile(rcPath, r.source, 'utf8');
    }

    // 3) PNGs de filmstrip (rasterizados en el renderer) -> resources/img (layout iPlug2).
    if (assets.length > 0) {
      const resDir = path.join(dir, 'resources', 'img');
      await mkdir(resDir, { recursive: true });
      for (const a of assets) {
        const b64 = a.dataUri.replace(/^data:image\/\w+;base64,/, '');
        await writeFile(path.join(resDir, a.file), Buffer.from(b64, 'base64'));
      }
    }
    return { dir, merged, ...h, configFound, configChanged, rcFound, rcChanged, moveWarnings };
  },
);

/** Área útil de la pantalla principal (sin barra de tareas), para no dejar
 *  diseñar un lienzo (el "100%" del plugin) más grande de lo que cabe. */
ipcMain.handle(IPC.getScreenSize, () => {
  const { width, height } = screen.getPrimaryDisplay().workAreaSize;
  // Margen para la barra de título de la app standalone y un respiro visual.
  return { width: Math.max(200, width - 40), height: Math.max(200, height - 100) };
});

ipcMain.handle(IPC.importImage, async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog(dlgWin(), {
    properties: ['openFile'],
    filters: [{ name: 'Imagen', extensions: ['png', 'jpg', 'jpeg', 'webp'] }],
    title: 'Importar imagen (textura o filmstrip)',
  });
  if (canceled || filePaths.length === 0) return null;
  const p = filePaths[0];
  const buf = await readFile(p);
  const ext = path.extname(p).toLowerCase();
  const mime = ext === '.jpg' || ext === '.jpeg' ? 'image/jpeg' : ext === '.webp' ? 'image/webp' : 'image/png';
  // Dimensiones desde la cabecera PNG (IHDR) si es PNG; para otros formatos las
  // resuelve el renderer al cargar la imagen.
  let width = 0, height = 0;
  if (mime === 'image/png' && buf.length > 24 && buf.toString('ascii', 12, 16) === 'IHDR') {
    width = buf.readUInt32BE(16);
    height = buf.readUInt32BE(20);
  }
  return {
    name: path.basename(p),
    dataUri: `data:${mime};base64,${buf.toString('base64')}`,
    width,
    height,
  };
});

ipcMain.handle(IPC.importFont, async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog(dlgWin(), {
    properties: ['openFile'],
    filters: [{ name: 'Fuente', extensions: ['ttf', 'otf', 'woff', 'woff2'] }],
    title: 'Importar fuente (.ttf/.otf/.woff/.woff2)',
  });
  if (canceled || filePaths.length === 0) return null;
  const p = filePaths[0];
  const buf = await readFile(p);
  const ext = path.extname(p).toLowerCase();
  const mime =
    ext === '.otf' ? 'font/otf' : ext === '.woff' ? 'font/woff' : ext === '.woff2' ? 'font/woff2' : 'font/ttf';
  return { name: path.basename(p), dataUri: `data:${mime};base64,${buf.toString('base64')}` };
});

ipcMain.handle(IPC.saveImage, async (_e, dataUri: string, suggestedName: string) => {
  const { canceled, filePath } = await dialog.showSaveDialog(dlgWin(), {
    defaultPath: suggestedName || 'filmstrip.png',
    filters: [{ name: 'PNG', extensions: ['png'] }],
  });
  if (canceled || !filePath) return null;
  const b64 = dataUri.replace(/^data:image\/\w+;base64,/, '');
  await writeFile(filePath, Buffer.from(b64, 'base64'));
  return filePath;
});

app.whenReady().then(createWindow);
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
