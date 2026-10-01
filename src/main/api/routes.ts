import { Router } from 'express';
import { WebSocketServer, WebSocket } from 'ws';
import type { Server as HttpServer } from 'http';
import multer from 'multer';
import path from 'path';
import os from 'os';
import { ServerManager } from '../server/ServerManager';
import { CoreDownloader } from '../server/CoreDownloader';
import { ModManager } from '../mod/ModManager';
import { ConfigManager } from '../config/ConfigManager';
import { ServerType } from '../types';

interface ApiContext {
  serverManager: ServerManager;
  coreDownloader: CoreDownloader;
  modManager: ModManager;
  configManager: ConfigManager;
}

const upload = multer({ dest: path.join(os.tmpdir(), 'mc-mod-uploads') });

/** 注册 REST API 路由 */
export function createRouter(ctx: ApiContext): Router {
  const router = Router();
  const { serverManager, coreDownloader, modManager } = ctx;

  // ---- 服务器管理 ----
  router.get('/servers', (_req, res) => {
    res.json(serverManager.list());
  });

  router.post('/servers', async (req, res, next) => {
    try {
      const server = await serverManager.create(req.body);
      res.status(201).json(server);
    } catch (e) {
      next(e);
    }
  });

  router.get('/servers/:id', (req, res, next) => {
    try {
      res.json(serverManager.get(req.params.id));
    } catch (e) {
      next(e);
    }
  });

  router.delete('/servers/:id', async (req, res, next) => {
    try {
      await serverManager.remove(req.params.id);
      res.status(204).end();
    } catch (e) {
      next(e);
    }
  });

  router.post('/servers/:id/start', async (req, res, next) => {
    try {
      await serverManager.start(req.params.id);
      res.json({ ok: true });
    } catch (e) {
      next(e);
    }
  });

  router.post('/servers/:id/stop', async (req, res, next) => {
    try {
      await serverManager.stop(req.params.id);
      res.json({ ok: true });
    } catch (e) {
      next(e);
    }
  });

  router.post('/servers/:id/command', (req, res) => {
    const ok = serverManager.sendCommand(req.params.id, req.body.command ?? '');
    res.status(ok ? 200 : 409).json({ ok });
  });

  router.get('/servers/:id/logs', (req, res) => {
    const lines = Number(req.query.lines) || 200;
    res.json({ logs: serverManager.getLogs(req.params.id, lines) });
  });

  // ---- 版本查询 ----
  router.get('/versions/:type', async (req, res, next) => {
    try {
      const versions = await coreDownloader.fetchVersions(req.params.type as ServerType);
      res.json(versions);
    } catch (e) {
      next(e);
    }
  });

  // ---- 模组管理 ----
  router.get('/servers/:id/mods', async (req, res, next) => {
    try {
      res.json(await modManager.list(req.params.id));
    } catch (e) {
      next(e);
    }
  });

  router.post('/servers/:id/mods', upload.single('file'), async (req, res, next) => {
    try {
      if (!req.file) {
        res.status(400).json({ error: '缺少上传文件' });
        return;
      }
      const mod = await modManager.installLocal(
        req.params.id,
        req.file.path,
        req.file.originalname
      );
      res.status(201).json(mod);
    } catch (e) {
      next(e);
    }
  });

  router.post('/servers/:id/mods/:modId/toggle', async (req, res, next) => {
    try {
      await modManager.toggle(req.params.id, req.params.modId, !!req.body.enabled);
      res.json({ ok: true });
    } catch (e) {
      next(e);
    }
  });

  router.delete('/servers/:id/mods/:modId', async (req, res, next) => {
    try {
      await modManager.remove(req.params.id, req.params.modId);
      res.status(204).end();
    } catch (e) {
      next(e);
    }
  });

  // 统一错误处理
  router.use((err: Error, _req: any, res: any, _next: any) => {
    console.error('[API]', err.message);
    res.status(500).json({ error: err.message });
  });

  return router;
}

/** 挂载 WebSocket 日志推送：ws://host/api/ws/logs/:serverId */
export function setupLogWebSocket(httpServer: HttpServer, ctx: ApiContext): void {
  const wss = new WebSocketServer({ noServer: true });

  httpServer.on('upgrade', (req, socket, head) => {
    const match = req.url?.match(/^\/api\/ws\/logs\/([\w-]+)$/);
    if (!match) {
      socket.destroy();
      return;
    }
    wss.handleUpgrade(req, socket, head, (ws) => {
      (ws as any).serverId = match[1];
      wss.emit('connection', ws, req);
    });
  });

  const clients = new Set<WebSocket>();

  wss.on('connection', (ws) => {
    clients.add(ws);
    ws.on('close', () => clients.delete(ws));
  });

  // 日志事件 → 广播给对应订阅者
  ctx.serverManager.on('log', (serverId: string, line: string) => {
    for (const ws of clients) {
      if ((ws as any).serverId === serverId && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'log', line }));
      }
    }
  });
}
