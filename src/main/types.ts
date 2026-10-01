export type ServerType = 'vanilla' | 'forge' | 'fabric' | 'paper';

export type ServerStatus = 'stopped' | 'starting' | 'running' | 'stopping' | 'crashed';

export interface MemoryConfig {
  min: string;
  max: string;
}

export interface ServerInstance {
  id: string;
  name: string;
  version: string;
  type: ServerType;
  status: ServerStatus;
  port: number;
  javaPath: string;
  memory: MemoryConfig;
  workingDir: string;
  coreJar?: string;
  autoStart: boolean;
  createdAt: string;
}

export interface CreateServerConfig {
  name: string;
  version: string;
  type: ServerType;
  port: number;
  javaPath?: string;
  memory?: MemoryConfig;
  autoStart?: boolean;
}

export interface VersionInfo {
  id: string;
  type: ServerType;
  releaseTime?: string;
  url?: string;
}

export interface ModFile {
  id: string;
  filename: string;
  size: number;
  enabled: boolean;
}

export interface AppSettings {
  defaultJavaPath: string;
  defaultMemory: MemoryConfig;
  apiPort: number;
}

export interface PersistedData {
  servers: ServerInstance[];
  settings: AppSettings;
}
