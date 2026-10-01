import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, ServerInstance } from '../api';

export default function ServerList() {
  const [servers, setServers] = useState<ServerInstance[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = () => {
    api.listServers().then(setServers).finally(() => setLoading(false));
  };

  useEffect(() => {
    refresh();
    const t = setInterval(refresh, 3000);
    return () => clearInterval(t);
  }, []);

  const statusClass = (s: ServerInstance['status']) =>
    `status-badge ${s}`;

  if (loading) return <div className="center">加载中...</div>;

  return (
    <div className="page server-list">
      <div className="toolbar">
        <h2>服务器列表</h2>
        <Link to="/create" className="btn primary">创建服务器</Link>
      </div>
      {servers.length === 0 ? (
        <div className="empty">暂无服务器，点击上方按钮创建。</div>
      ) : (
        <div className="server-grid">
          {servers.map((srv) => (
            <div className="server-card" key={srv.id}>
              <div className="card-header">
                <span className="server-name">{srv.name}</span>
                <span className={statusClass(srv.status)}>
                  {srv.status === 'stopped' ? '已停止'
                    : srv.status === 'running' ? '运行中'
                    : srv.status === 'starting' ? '启动中'
                    : srv.status === 'stopping' ? '停止中'
                    : '崩溃'}
                </span>
              </div>
              <div className="card-body">
                <div>版本: {srv.version}</div>
                <div>类型: {srv.type}</div>
                <div>端口: {srv.port}</div>
              </div>
              <div className="card-footer">
                <Link to={`/server/${srv.id}`} className="btn">管理</Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
