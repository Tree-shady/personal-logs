import { app, BrowserWindow } from 'electron';
import path from 'path';
import express, { Express } from 'express';
import http from 'http';
import { ConfigManager } from './config/ConfigManager';
import { ServerManager } from './server/ServerManager';
import { ProcessPool } from './server/ProcessPool';
import { CoreDownloader } from './server/CoreDownloader';
import { ModManager } from './mod/ModManager';
import { createRouter, setupLogWebSocket } from './api/routes';

const IS_DEV = !app.isPackaged;
const BASE_DIR = app.getPath('userData');

let mainWindow: BrowserWindow | null = null;
let expressApp: Express;
let httpServer: http.Server;

async function bootstrap() {
  // 初始化配置
  const configManager = new ConfigManager(BASE_DIR);
  await configManager.init();

  // 初始化各核心模块
  const pool = new ProcessPool();
  const downloader = new CoreDownloader();
  const serverManager = new ServerManager(BASE_DIR, configManager, pool, downloader);
  const modManager = new ModManager(configManager);

  // 启动 Express API
  expressApp = express();
  expressApp.use(express.json());
  expressApp.use('/api', createRouter({ serverManager, coreDownloader: downloader, modManager, configManager }));

  httpServer = http.createServer(expressApp);
  setupLogWebSocket(httpServer, { serverManager, coreDownloader: downloader, modManager, configManager });

  const port = configManager.settings.apiPort;
  httpServer.listen(port, () => {
    console.log(`API 服务运行在 http://localhost:${port}`);
  });

  // 应用启动后自动拉起标记 autoStart 的服务器
  await serverManager.startAutoStartServers().catch(() => {});

  // 创建 Electron 窗口
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    title: 'Raspberry MC Server Manager',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true
    }
  });

  if (IS_DEV) {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // 应用退出时优雅关闭所有服务端进程
  app.on('before-quit', async () => {
    await serverManager.shutdown();
  });
}

app.whenReady().then(bootstrap);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (mainWindow === null) {
    bootstrap();
  }
});
