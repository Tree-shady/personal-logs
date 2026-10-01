import React, { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api, ServerInstance, ModFile } from '../api';

export default function ServerDetail() {
  const { id } = useParams<{ id: string }>();
  const nav = useNavigate();
  const [server, setServer] = useState<ServerInstance | null>(null);
  const [logs, setLogs] = useState<string[]>([]);
  const [command, setCommand] = useState('');
  const [mods, setMods] = useState<ModFile[]>([]);
  const logEndRef = useRef<HTMLDivElement>(null);
  const wsRef = useRef<WebSocket | null>(null);

  const refresh = () => {
    if (!id) return;
    api.getServer(id).then(setServer);
    api.listMods(id).then(setMods);
  };

  useEffect(() => {
    if (!id) return;
    refresh();
    // 拉取历史日志
    api.getLogs(id, 100).then((r) => setLogs(r.logs));
    // WebSocket 实时日志
    const ws = new WebSocket(`ws://localhost:25560/api/ws/logs/${id}`);
    wsRef.current = ws;
    ws.onmessage = (ev) => {
      const data = JSON.parse(ev.data);
      if (data.type === 'log') {
        setLogs((prev) => [...prev.slice(-499), data.line]);
      }
    };
    const interval = setInterval(refresh, 3000);
    return () => {
      clearInterval(interval);
      ws.close();
    };
  }, [id]);

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'auto' });
  }, [logs]);

  const toggleServer = async () => {
    if (!id || !server) return;
    if (server.status === 'running' || server.status === 'starting') {
      await api.stopServer(id);
    } else {
      await api.startServer(id);
    }
    refresh();
  };

  const onCommand = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id || !command.trim()) return;
    await api.sendCommand(id, command.trim());
    setCommand('');
  };

  const onUploadMod = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !id) return;
    await api.uploadMod(id, file);
    refresh();
  };

  if (!server) return <div className="center">加载中...</div>;

  return (
    <div className="page server-detail">
      <div className="toolbar">
        <button className="btn" onClick={() => nav(-1)}>返回</button>
        <h2>{server.name}</h2>
        <button className="btn primary" onClick={toggleServer}>
          {server.status === 'running' ? '停止' : '启动'}
        </button>
      </div>

      <div className="detail-grid">
        <div className="panel info">
          <h3>基本信息</h3>
          <div>ID: {server.id}</div>
          <div>版本: {server.version}</div>
          <div>类型: {server.type}</div>
          <div>端口: {server.port}</div>
          <div>状态: {server.status}</div>
        </div>

        <div className="panel logs">
          <h3>控制台</h3>
          <div className="log-box">
            {logs.map((l, i) => (
              <pre key={i} className="log-line">{l}</pre>
            ))}
            <div ref={logEndRef} />
          </div>
          <form className="command-bar" onSubmit={onCommand}>
            <input
              value={command}
              onChange={(e) => setCommand(e.target.value)}
              placeholder="输入命令，按回车发送..."
            />
            <button type="submit" className="btn">发送</button>
          </form>
        </div>

        <div className="panel mods">
          <h3>模组管理</h3>
          <input type="file" accept=".jar" onChange={onUploadMod} />
          <div className="mod-list">
            {mods.map((mod) => (
              <div className="mod-item" key={mod.id}>
                <span className={mod.enabled ? '' : 'disabled'}>{mod.filename}</span>
                <div className="mod-actions">
                  <button
                    className="btn small"
                    onClick={() => api.toggleMod(id!, mod.id, !mod.enabled).then(refresh)}
                  >
                    {mod.enabled ? '禁用' : '启用'}
                  </button>
                  <button
                    className="btn small danger"
                    onClick={() => api.deleteMod(id!, mod.id).then(refresh)}
                  >
                    删除
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
