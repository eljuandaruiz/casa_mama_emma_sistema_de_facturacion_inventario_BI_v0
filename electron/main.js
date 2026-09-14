const { app, BrowserWindow, dialog, shell } = require('electron');
const { spawn } = require('node:child_process');
const crypto = require('node:crypto');
const fs = require('node:fs');
const http = require('node:http');
const net = require('node:net');
const path = require('node:path');

const raizRecursos = app.isPackaged ? process.resourcesPath : path.join(__dirname, '..');
const dirApp = app.isPackaged ? path.join(raizRecursos, 'app') : path.join(raizRecursos, '.next', 'standalone');
const dirPlantilla = app.isPackaged ? path.join(raizRecursos, 'plantilla') : path.join(__dirname, 'plantilla');
// Portable: los datos viven en una carpeta "datos" junto al .exe (USB, escritorio, etc.)
const dirDatos = process.env.PORTABLE_EXECUTABLE_DIR
  ? path.join(process.env.PORTABLE_EXECUTABLE_DIR, 'datos')
  : path.join(app.isPackaged ? app.getPath('userData') : path.join(__dirname, '..'), 'datos');

let servidor = null;
let ventana = null;

function prepararDatos() {
  for (const d of ['certificados', path.join('uploads', 'comprobantes')]) {
    fs.mkdirSync(path.join(dirDatos, d), { recursive: true });
  }
  const env = path.join(dirDatos, '.env');
  if (!fs.existsSync(env)) {
    const texto = fs
      .readFileSync(path.join(dirPlantilla, 'env.plantilla'), 'utf8')
      .replace('AUTH_SECRET="genera-un-secreto-largo-y-unico"', `AUTH_SECRET="${crypto.randomBytes(32).toString('base64')}"`)
      .replace(/^DATABASE_URL=.*$/m, '# Base de datos: casa-mama-emma.db, en esta misma carpeta (la fija el programa).');
    fs.writeFileSync(env, texto);
  }
  const db = path.join(dirDatos, 'casa-mama-emma.db');
  if (!fs.existsSync(db)) fs.copyFileSync(path.join(dirPlantilla, 'casa-mama-emma.db'), db);
  const leeme = path.join(dirDatos, 'LEEME.txt');
  if (!fs.existsSync(leeme)) fs.copyFileSync(path.join(dirPlantilla, 'LEEME.txt'), leeme);
  return { env, db };
}

function leerEnv(ruta) {
  const valores = {};
  for (const linea of fs.readFileSync(ruta, 'utf8').split(/\r?\n/)) {
    const m = linea.match(/^\s*([A-Za-z0-9_]+)\s*=\s*(.*)$/);
    if (!m) continue;
    let v = m[2].trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    valores[m[1]] = v;
  }
  return valores;
}

function puertoLibre(preferido) {
  return new Promise((resolve) => {
    const escuchar = (puerto, siFalla) => {
      const s = net.createServer();
      s.once('error', siFalla);
      s.listen(puerto, '127.0.0.1', () => {
        const real = s.address().port;
        s.close(() => resolve(real));
      });
    };
    escuchar(preferido, () => escuchar(0, () => resolve(preferido)));
  });
}

function esperarServidor(url, proceso, maxMs = 90000) {
  return new Promise((resolve, reject) => {
    const inicio = Date.now();
    const intentar = () => {
      if (proceso.exitCode !== null) return reject(new Error(`El servidor se cerró con código ${proceso.exitCode}.`));
      if (Date.now() - inicio > maxMs) return reject(new Error('El servidor no respondió a tiempo.'));
      http
        .get(url, (res) => {
          res.resume();
          resolve();
        })
        .on('error', () => setTimeout(intentar, 400));
    };
    intentar();
  });
}

function pantallaCarga() {
  const html = `<!doctype html><meta charset="utf-8"><title>Casa Mamá Emma</title>
<body style="margin:0;height:100vh;display:grid;place-items:center;font-family:Segoe UI,system-ui,sans-serif;background:#fafaf9;color:#292524">
<div style="text-align:center"><div style="font-size:28px;font-weight:600">Casa Mamá Emma</div>
<div style="margin-top:10px;color:#78716c">Encendiendo el sistema, un momento…</div></div></body>`;
  return 'data:text/html;charset=utf-8,' + encodeURIComponent(html);
}

async function arrancar() {
  const { env, db } = prepararDatos();
  const puerto = await puertoLibre(3000);
  const url = `http://127.0.0.1:${puerto}`;

  ventana = new BrowserWindow({
    width: 1280,
    height: 820,
    title: 'Casa Mamá Emma',
    autoHideMenuBar: true,
    webPreferences: { contextIsolation: true, nodeIntegration: false },
  });
  ventana.on('closed', () => {
    ventana = null;
    app.quit();
  });
  ventana.webContents.setWindowOpenHandler(({ url: destino }) => {
    if (destino.startsWith(url)) return { action: 'allow' };
    shell.openExternal(destino);
    return { action: 'deny' };
  });
  await ventana.loadURL(pantallaCarga());

  const log = fs.openSync(path.join(dirDatos, 'servidor.log'), 'w');
  servidor = spawn(process.execPath, [path.join(__dirname, 'servidor.js')], {
    cwd: dirDatos,
    stdio: ['ignore', log, log],
    env: {
      ...process.env,
      ...leerEnv(env),
      ELECTRON_RUN_AS_NODE: '1',
      NODE_ENV: 'production',
      HOSTNAME: '127.0.0.1',
      PORT: String(puerto),
      APP_URL: url,
      DATABASE_URL: 'file:' + db.replace(/\\/g, '/'),
      DIR_APP: dirApp,
    },
  });

  await esperarServidor(`${url}/login`, servidor);
  if (ventana) await ventana.loadURL(url);
}

function detenerServidor() {
  if (servidor && servidor.exitCode === null) servidor.kill();
  servidor = null;
}

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (ventana) {
      if (ventana.isMinimized()) ventana.restore();
      ventana.focus();
    }
  });
  app.whenReady().then(() =>
    arrancar().catch((e) => {
      detenerServidor();
      dialog.showErrorBox(
        'Casa Mamá Emma no pudo iniciar',
        `${e.message}\n\nRevisa el archivo:\n${path.join(dirDatos, 'servidor.log')}`,
      );
      app.quit();
    }),
  );
  app.on('window-all-closed', () => app.quit());
  app.on('will-quit', detenerServidor);
}
