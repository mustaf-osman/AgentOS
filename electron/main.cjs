const { app, BrowserWindow, shell, dialog } = require('electron');
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const PRODUCT = 'AgentOS';
if (process.env.AGENTOS_ELECTRON_PROFILE) {
  app.setPath('userData', path.resolve(process.env.AGENTOS_ELECTRON_PROFILE));
}
const APP_ROOT = app.isPackaged ? app.getAppPath() : path.resolve(__dirname, '..');
const RESOURCE_ROOT = app.isPackaged && APP_ROOT.endsWith('.asar')
  ? APP_ROOT.slice(0, -5) + '.asar.unpacked'
  : APP_ROOT;
const DATA_DIR = process.env.AGENTOS_DATA_DIR
  ? path.resolve(process.env.AGENTOS_DATA_DIR)
  : app.isPackaged
    ? path.join(app.getPath('userData'), 'data')
    : path.join(APP_ROOT, 'data');
const PORT_FILE = path.join(DATA_DIR, 'instance.json');
const SINGLE_INSTANCE = app.requestSingleInstanceLock();
let mainWindow;
let backend;
let ownsBackend = false;
let quitting = false;
let origin;

if (!SINGLE_INSTANCE) app.quit();

function readInstance() {
  try { return JSON.parse(fs.readFileSync(PORT_FILE, 'utf8')); }
  catch { return null; }
}

async function reachable(instance) {
  if (!instance?.port || !instance?.instanceId) return false;
  try {
    const response = await fetch(`http://127.0.0.1:${instance.port}/api/health`, { signal: AbortSignal.timeout(1800) });
    const health = await response.json();
    return health.service === 'agentos' && health.instanceId === instance.instanceId;
  } catch { return false; }
}

async function startBackend() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const existing = readInstance();
  if (await reachable(existing)) return `http://127.0.0.1:${existing.port}`;

  const serverFile = path.join(RESOURCE_ROOT, 'src', 'server.mjs');
  if (!fs.existsSync(serverFile)) throw new Error(`找不到 AgentOS 服务文件：${serverFile}`);
  const logsDir = path.join(DATA_DIR, 'logs');
  fs.mkdirSync(logsDir, { recursive: true });
  const stdout = fs.createWriteStream(path.join(logsDir, 'desktop-service.log'), { flags: 'a' });
  backend = spawn(process.execPath, [serverFile], {
    cwd: RESOURCE_ROOT,
    windowsHide: true,
    env: {
      ...process.env,
      ELECTRON_RUN_AS_NODE: '1',
      AGENTOS_DATA_DIR: DATA_DIR,
      AGENTOS_PORT: '4330',
      AGENTOS_NO_OPEN: '1'
    },
    stdio: ['ignore', 'pipe', 'pipe']
  });
  ownsBackend = true;
  backend.stdout.pipe(stdout);
  backend.stderr.pipe(stdout);

  const started = Date.now();
  while (Date.now() - started < 30000) {
    if (backend.exitCode !== null) throw new Error('AgentOS 后台服务启动失败，请查看本机数据目录中的 logs/desktop-service.log。');
    const instance = readInstance();
    if (await reachable(instance)) return `http://127.0.0.1:${instance.port}`;
    await new Promise(resolve => setTimeout(resolve, 250));
  }
  backend.kill();
  throw new Error('AgentOS 后台服务启动超时，请查看本机数据目录中的 logs/desktop-service.log。');
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1420,
    height: 920,
    minWidth: 780,
    minHeight: 600,
    show: false,
    title: PRODUCT,
    backgroundColor: '#f5f7f1',
    autoHideMenuBar: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: true
    }
  });

  mainWindow.once('ready-to-show', () => mainWindow.show());
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    try {
      const target = new URL(url);
      if (target.protocol === 'https:') shell.openExternal(target.href);
    } catch { /* reject invalid external targets */ }
    return { action: 'deny' };
  });
  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (!url.startsWith(origin + '/')) event.preventDefault();
  });
  mainWindow.webContents.on('will-attach-webview', event => event.preventDefault());
  mainWindow.webContents.on('did-fail-load', (_event, code, description, validatedURL, isMainFrame) => {
    if (isMainFrame && code !== -3) console.error('AgentOS 页面加载失败:', code, description, validatedURL);
  });
  mainWindow.loadURL(`${origin}/#chat`);
  mainWindow.on('closed', () => { mainWindow = null; });
}

async function boot() {
  try {
    origin = await startBackend();
    createWindow();
  } catch (error) {
    console.error(error);
    await dialog.showMessageBox({
      type: 'error',
      title: `${PRODUCT} 无法启动`,
      message: error.message,
      buttons: ['退出']
    });
    app.quit();
  }
}

app.on('second-instance', () => {
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  }
});

app.whenReady().then(boot);
app.on('activate', () => {
  if (mainWindow) mainWindow.show();
  else if (origin) createWindow();
});
app.on('before-quit', event => {
  if (quitting) return;
  quitting = true;
  if (ownsBackend && backend && backend.exitCode === null) {
    event.preventDefault();
    backend.once('exit', () => app.quit());
    backend.kill('SIGTERM');
    setTimeout(() => {
      if (backend && backend.exitCode === null) backend.kill();
      app.quit();
    }, 4000).unref();
  }
});
