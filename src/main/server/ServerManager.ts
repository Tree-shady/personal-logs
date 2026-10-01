import crypto from 'crypto';
import path from 'path';
import fs from 'fs-extra';
import { EventEmitter } from 'events';
import { ConfigManager } from '../config/ConfigManager';
import { ProcessPool } from './ProcessPool';
import { CoreDownloader } from './CoreDownloader';
import {
  CreateServerConfig,
  ServerInstance,
  ServerStatus
} from '../types';

/** 服务器管理核心：创建/启动/停止/删除 MC 服务端实例 */
export class ServerManager extends EventEmitter {
  constructor(
    private baseDir: string,
    private config: ConfigManager,
    private pool: ProcessPool,
    private downloader: CoreDownloader
  ) {
    super();
    // 进程退出时同步状态到持久化配置
    this.pool.on('exit', async (serverId: string, code: number) => {
      const status: ServerStatus = code === 0 ? 'stopped' : 'crashed';
      await this.config.updateServer(serverId, { status }).catch(() => {});
    });
    // 透传日志事件（供 WebSocket 订阅）
    this.pool.on('log', (serverId: string, line: string) => {
      this.emit('log', serverId, line);
    });
  }

  list(): ServerInstance[] {
    return this.config.servers;
  }

  get(id: string): ServerInstance {
    const server = this.config.getServer(id);
    if (!server) throw new Error(`服务器不存在: ${id}`);
    return server;
  }

  /** 创建服务器：初始化目录、下载核心、写入 eula 与 server.properties */
  async create(cfg: CreateServerConfig): Promise<ServerInstance> {
    const id = 'srv-' + crypto.randomBytes(4).toString('hex');
    const workingDir = path.join(this.baseDir, 'servers', id);
    await fs.ensureDir(workingDir);

    const coreJar = await this.downloader.downloadCore(cfg.type, cfg.version, workingDir);

    // 自动接受 EULA
    await fs.writeFile(path.join(workingDir, 'eula.txt'), 'eula=true\n');

    // 初始化 server.properties
    await fs.writeFile(
      path.join(workingDir, 'server.properties'),
      [
        `server-port=${cfg.port}`,
        'online-mode=false',
        'motd=A Minecraft Server managed by RaspberryMC',
        ''
      ].join('\n')
    );

    const server: ServerInstance = {
      id,
      name: cfg.name,
      version: cfg.version,
      type: cfg.type,
      status: 'stopped',
      port: cfg.port,
      javaPath: cfg.javaPath ?? this.config.settings.defaultJavaPath,
      memory: cfg.memory ?? { ...this.config.settings.defaultMemory },
      workingDir,
      coreJar,
      autoStart: cfg.autoStart ?? false,
      createdAt: new Date().toISOString()
    };

    await this.config.addServer(server);
    return server;
  }

  async start(id: string): Promise<void> {
    const server = this.get(id);
    if (this.pool.isRunning(id)) throw new Error('服务器已在运行');
    if (!server.coreJar || !(await fs.pathExists(server.coreJar))) {
      throw new Error('核心文件缺失，请重新创建服务器');
    }

    await this.config.updateServer(id, { status: 'starting' });
    const ok = this.pool.start(server);
    if (!ok) {
      await this.config.updateServer(id, { status: 'stopped' });
      throw new Error('进程启动失败');
    }
    await this.config.updateServer(id, { status: 'running' });
  }

  async stop(id: string): Promise<void> {
    this.get(id);
    await this.config.updateServer(id, { status: 'stopping' });
    await this.pool.stop(id);
    await this.config.updateServer(id, { status: 'stopped' });
  }

  /** 删除服务器（含工作目录） */
  async remove(id: string): Promise<void> {
    const server = this.get(id);
    if (this.pool.isRunning(id)) {
      await this.stop(id);
    }
    await fs.remove(server.workingDir);
    await this.config.removeServer(id);
  }

  sendCommand(id: string, command: string): boolean {
    return this.pool.sendCommand(id, command);
  }

  getLogs(id: string, lines?: number): string[] {
    return this.pool.getLogs(id, lines);
  }

  /** 应用启动时拉起标记了 autoStart 的服务器 */
  async startAutoStartServers(): Promise<void> {
    for (const server of this.config.servers) {
      if (server.autoStart && !this.pool.isRunning(server.id)) {
        await this.start(server.id).catch((err) => {
          console.error(`自启动失败 [${server.name}]:`, err.message);
        });
      }
    }
  }

  async shutdown(): Promise<void> {
    await this.pool.stopAll();
  }
}
