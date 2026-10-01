import path from 'path';
import fs from 'fs-extra';
import { ModFile } from '../types';
import { ConfigManager } from '../config/ConfigManager';

/** 模组管理：负责 mods/ 目录内文件的增删改查 */
export class ModManager {
  constructor(private config: ConfigManager) {}

  private modsDir(serverId: string): string {
    const server = this.config.getServer(serverId);
    if (!server) throw new Error(`服务器不存在: ${serverId}`);
    return path.join(server.workingDir, 'mods');
  }

  async list(serverId: string): Promise<ModFile[]> {
    const dir = this.modsDir(serverId);
    await fs.ensureDir(dir);
    const files = await fs.readdir(dir);
    const mods: ModFile[] = [];
    for (const filename of files) {
      if (!filename.endsWith('.jar') && !filename.endsWith('.jar.disabled')) continue;
      const stat = await fs.stat(path.join(dir, filename));
      mods.push({
        id: filename,
        filename,
        size: stat.size,
        enabled: filename.endsWith('.jar')
      });
    }
    return mods;
  }

  /** 安装本地上传的模组 jar */
  async installLocal(serverId: string, sourceFile: string, originalName: string): Promise<ModFile> {
    const dir = this.modsDir(serverId);
    await fs.ensureDir(dir);
    const dest = path.join(dir, path.basename(originalName));
    await fs.copy(sourceFile, dest, { overwrite: true });
    const stat = await fs.stat(dest);
    return { id: path.basename(dest), filename: path.basename(dest), size: stat.size, enabled: true };
  }

  /** 启用/禁用模组（通过重命名后缀实现，无需删除文件） */
  async toggle(serverId: string, modId: string, enabled: boolean): Promise<void> {
    const dir = this.modsDir(serverId);
    const current = path.join(dir, modId);
    if (!(await fs.pathExists(current))) throw new Error(`模组不存在: ${modId}`);

    const target = enabled
      ? current.replace(/\.disabled$/, '')
      : current + '.disabled';
    if (current === target) return;
    await fs.rename(current, target);
  }

  async remove(serverId: string, modId: string): Promise<void> {
    const file = path.join(this.modsDir(serverId), path.basename(modId));
    if (!(await fs.pathExists(file))) throw new Error(`模组不存在: ${modId}`);
    await fs.remove(file);
  }

  // TODO: installFromCurseforge / installFromModrinth —— 在线搜索安装（V1.2）
}
