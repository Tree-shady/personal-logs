import path from 'path';
import fs from 'fs-extra';
import { AppSettings, PersistedData, ServerInstance } from '../types';

const DEFAULT_SETTINGS: AppSettings = {
  defaultJavaPath: 'java',
  defaultMemory: { min: '1G', max: '2G' },
  apiPort: 25560
};

/** 应用配置持久化：负责 data/servers.json 的读写 */
export class ConfigManager {
  private dataFile: string;
  private data: PersistedData;

  constructor(baseDir: string) {
    this.dataFile = path.join(baseDir, 'data', 'servers.json');
    this.data = { servers: [], settings: { ...DEFAULT_SETTINGS } };
  }

  async init(): Promise<void> {
    await fs.ensureDir(path.dirname(this.dataFile));
    if (await fs.pathExists(this.dataFile)) {
      this.data = await fs.readJson(this.dataFile);
    } else {
      await this.save();
    }
  }

  get settings(): AppSettings {
    return this.data.settings;
  }

  get servers(): ServerInstance[] {
    return this.data.servers;
  }

  getServer(id: string): ServerInstance | undefined {
    return this.data.servers.find((s) => s.id === id);
  }

  async addServer(server: ServerInstance): Promise<void> {
    this.data.servers.push(server);
    await this.save();
  }

  async updateServer(id: string, patch: Partial<ServerInstance>): Promise<void> {
    const idx = this.data.servers.findIndex((s) => s.id === id);
    if (idx === -1) throw new Error(`服务器不存在: ${id}`);
    this.data.servers[idx] = { ...this.data.servers[idx], ...patch };
    await this.save();
  }

  async removeServer(id: string): Promise<void> {
    this.data.servers = this.data.servers.filter((s) => s.id !== id);
    await this.save();
  }

  async updateSettings(patch: Partial<AppSettings>): Promise<void> {
    this.data.settings = { ...this.data.settings, ...patch };
    await this.save();
  }

  private async save(): Promise<void> {
    await fs.writeJson(this.dataFile, this.data, { spaces: 2 });
  }
}
