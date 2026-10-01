/** 与服务端交互的 API 封装 */
const BASE = '/api';

export interface ServerInstance {
  id: string;
  name: string;
  version: string;
  type: 'vanilla' | 'forge' | 'fabric' | 'paper';
  status: 'stopped' | 'starting' | 'running' | 'stopping' | 'crashed';
  port: number;
  autoStart: boolean;
}

export interface ModFile {
  id: string;
  filename: string;
  size: number;
  enabled: boolean;
}

export interface VersionInfo {
  id: string;
  type: string;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(BASE + path, {
    headers: { 'Content-Type': 'application/json' },
    ...init
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `请求失败: ${res.status}`);
  }
  return res.status === 204 ? (undefined as T) : res.json();
}

export const api = {
  listServers: () => request<ServerInstance[]>('/servers'),
  getServer: (id: string) => request<ServerInstance>(`/servers/${id}`),
  createServer: (cfg: unknown) =>
    request<ServerInstance>('/servers', { method: 'POST', body: JSON.stringify(cfg) }),
  deleteServer: (id: string) => request<void>(`/servers/${id}`, { method: 'DELETE' }),
  startServer: (id: string) => request(`/servers/${id}/start`, { method: 'POST' }),
  stopServer: (id: string) => request(`/servers/${id}/stop`, { method: 'POST' }),
  sendCommand: (id: string, command: string) =>
    request(`/servers/${id}/command`, { method: 'POST', body: JSON.stringify({ command }) }),
  getLogs: (id: string, lines = 200) =>
    request<{ logs: string[] }>(`/servers/${id}/logs?lines=${lines}`),
  fetchVersions: (type: string) => request<VersionInfo[]>(`/versions/${type}`),
  listMods: (id: string) => request<ModFile[]>(`/servers/${id}/mods`),
  uploadMod: (id: string, file: File) => {
    const form = new FormData();
    form.append('file', file);
    return fetch(`${BASE}/servers/${id}/mods`, { method: 'POST', body: form })
      .then((r) => {
        if (!r.ok) throw new Error('上传失败');
        return r.json();
      });
  },
  toggleMod: (id: string, modId: string, enabled: boolean) =>
    request(`/servers/${id}/mods/${encodeURIComponent(modId)}/toggle`, {
      method: 'POST',
      body: JSON.stringify({ enabled })
    }),
  deleteMod: (id: string, modId: string) =>
    request<void>(`/servers/${id}/mods/${encodeURIComponent(modId)}`, { method: 'DELETE' })
};
