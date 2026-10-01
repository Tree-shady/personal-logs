import { ChildProcess, spawn } from 'child_process';
import { EventEmitter } from 'events';
import { ServerInstance } from '../types';

interface RunningProcess {
  serverId: string;
  process: ChildProcess;
  logBuffer: string[];
}

const MAX_LOG_LINES = 2000;

/** 服务端进程池：管理所有运行中的 MC 服务端 Java 进程 */
export class ProcessPool extends EventEmitter {
  private processes = new Map<string, RunningProcess>();

  /** 启动服务端进程，返回是否成功拉起 */
  start(server: ServerInstance): boolean {
    if (this.processes.has(server.id)) return false;

    const args = [
      `-Xms${server.memory.min}`,
      `-Xmx${server.memory.max}`,
      '-jar',
      server.coreJar!,
      'nogui'
    ];

    const proc = spawn(server.javaPath, args, {
      cwd: server.workingDir,
      stdio: ['pipe', 'pipe', 'pipe']
    });

    const entry: RunningProcess = { serverId: server.id, process: proc, logBuffer: [] };
    this.processes.set(server.id, entry);

    const onData = (data: Buffer) => {
      const line = data.toString();
      entry.logBuffer.push(line);
      if (entry.logBuffer.length > MAX_LOG_LINES) {
        entry.logBuffer.splice(0, entry.logBuffer.length - MAX_LOG_LINES);
      }
      this.emit('log', server.id, line);
    };

    proc.stdout?.on('data', onData);
    proc.stderr?.on('data', onData);

    proc.on('exit', (code) => {
      this.processes.delete(server.id);
      this.emit('exit', server.id, code);
    });

    proc.on('error', (err) => {
      this.processes.delete(server.id);
      this.emit('error', server.id, err);
    });

    return true;
  }

  /** 优雅停止：先发送 stop 命令，超时后强制 kill */
  async stop(serverId: string, timeoutMs = 30000): Promise<void> {
    const entry = this.processes.get(serverId);
    if (!entry) return;

    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        entry.process.kill('SIGKILL');
      }, timeoutMs);

      entry.process.once('exit', () => {
        clearTimeout(timer);
        resolve();
      });

      entry.process.stdin?.write('stop\n');
    });
  }

  /** 向服务端控制台发送命令 */
  sendCommand(serverId: string, command: string): boolean {
    const entry = this.processes.get(serverId);
    if (!entry) return false;
    entry.process.stdin?.write(command + '\n');
    return true;
  }

  isRunning(serverId: string): boolean {
    return this.processes.has(serverId);
  }

  getLogs(serverId: string, lines = 200): string[] {
    const entry = this.processes.get(serverId);
    if (!entry) return [];
    return entry.logBuffer.slice(-lines);
  }

  /** 停止所有进程（应用退出时调用） */
  async stopAll(): Promise<void> {
    const ids = [...this.processes.keys()];
    await Promise.all(ids.map((id) => this.stop(id, 5000)));
  }
}
