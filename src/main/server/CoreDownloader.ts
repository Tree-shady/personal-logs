import path from 'path';
import fs from 'fs-extra';
import axios from 'axios';
import { ServerType, VersionInfo } from '../types';

/** 各服务端核心的版本清单地址 */
const MANIFEST_URLS: Record<ServerType, string> = {
  vanilla: 'https://launchermeta.mojang.com/mc/game/version_manifest.json',
  forge: 'https://files.minecraftforge.net/net/minecraftforge/forge/promotions_slim.json',
  fabric: 'https://meta.fabricmc.net/v2/versions/game',
  paper: 'https://api.papermc.io/v2/projects/paper'
};

/** 服务端核心下载器：负责获取版本列表与下载核心 jar */
export class CoreDownloader {
  /** 获取指定类型可用的版本列表 */
  async fetchVersions(type: ServerType): Promise<VersionInfo[]> {
    switch (type) {
      case 'vanilla': {
        const { data } = await axios.get(MANIFEST_URLS.vanilla);
        return (data.versions as Array<{ id: string; releaseTime: string }>)
          .slice(0, 50)
          .map((v) => ({ id: v.id, type, releaseTime: v.releaseTime }));
      }
      case 'fabric': {
        const { data } = await axios.get(MANIFEST_URLS.fabric);
        return (data as Array<{ version: string; stable: boolean }>)
          .filter((v) => v.stable)
          .map((v) => ({ id: v.version, type }));
      }
      case 'paper': {
        const { data } = await axios.get(MANIFEST_URLS.paper);
        return (data.versions as string[])
          .reverse()
          .slice(0, 50)
          .map((v) => ({ id: v, type }));
      }
      case 'forge': {
        const { data } = await axios.get(MANIFEST_URLS.forge);
        const promos = data.promos as Record<string, string>;
        const versions = new Map<string, string>();
        for (const [key, forgeVersion] of Object.entries(promos)) {
          if (key.endsWith('-latest')) {
            const mcVersion = key.replace('-latest', '');
            versions.set(mcVersion, forgeVersion);
          }
        }
        return [...versions.entries()].map(([mc]) => ({ id: mc, type }));
      }
    }
  }

  /**
   * 下载服务端核心到目标目录，返回 jar 文件路径。
   * TODO: forge/fabric 需要执行 installer 而非直接得到可运行 jar，后续补全。
   */
  async downloadCore(type: ServerType, version: string, targetDir: string): Promise<string> {
    await fs.ensureDir(targetDir);
    const jarPath = path.join(targetDir, `server-${type}-${version}.jar`);

    switch (type) {
      case 'vanilla': {
        const { data } = await axios.get(MANIFEST_URLS.vanilla);
        const entry = (data.versions as Array<{ id: string; url: string }>)
          .find((v) => v.id === version);
        if (!entry) throw new Error(`未找到版本: ${version}`);
        const { data: detail } = await axios.get(entry.url);
        const serverUrl: string = detail.downloads.server.url;
        await this.downloadFile(serverUrl, jarPath);
        return jarPath;
      }
      case 'paper': {
        const { data: buildData } = await axios.get(
          `https://api.papermc.io/v2/projects/paper/versions/${version}/builds`
        );
        const builds = buildData.builds as Array<{ build: number }>;
        const latest = builds[builds.length - 1].build;
        const fileName = `paper-${version}-${latest}.jar`;
        await this.downloadFile(
          `https://api.papermc.io/v2/projects/paper/versions/${version}/builds/${latest}/downloads/${fileName}`,
          jarPath
        );
        return jarPath;
      }
      case 'fabric':
      case 'forge':
        // 安装器需要下载后执行安装逻辑，骨架阶段先抛错提示
        throw new Error(`${type} 核心安装逻辑待实现（需运行 installer）`);
    }
  }

  private async downloadFile(url: string, dest: string): Promise<void> {
    const response = await axios.get(url, { responseType: 'stream' });
    const writer = fs.createWriteStream(dest);
    await new Promise<void>((resolve, reject) => {
      response.data.pipe(writer);
      writer.on('finish', resolve);
      writer.on('error', reject);
    });
  }
}
