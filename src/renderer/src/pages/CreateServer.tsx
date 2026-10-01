import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';

export default function CreateServer() {
  const nav = useNavigate();
  const [name, setName] = useState('');
  const [version, setVersion] = useState('1.20.1');
  const [type, setType] = useState<'vanilla' | 'forge' | 'fabric' | 'paper'>('vanilla');
  const [port, setPort] = useState(25565);
  const [memMin, setMemMin] = useState('512M');
  const [memMax, setMemMax] = useState('2G');
  const [busy, setBusy] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      await api.createServer({
        name,
        version,
        type,
        port,
        memory: { min: memMin, max: memMax }
      });
      nav('/');
    } catch (err: any) {
      alert(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="page create-server">
      <div className="toolbar">
        <button className="btn" onClick={() => nav(-1)}>返回</button>
        <h2>创建服务器</h2>
      </div>
      <form className="form" onSubmit={onSubmit}>
        <label>
          服务器名称
          <input required value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        <label>
          类型
          <select value={type} onChange={(e) => setType(e.target.value as any)}>
            <option value="vanilla">Vanilla</option>
            <option value="paper">Paper</option>
            <option value="forge">Forge</option>
            <option value="fabric">Fabric</option>
          </select>
        </label>
        <label>
          游戏版本
          <input required value={version} onChange={(e) => setVersion(e.target.value)} />
        </label>
        <label>
          端口
          <input type="number" value={port} onChange={(e) => setPort(Number(e.target.value))} />
        </label>
        <label>
          最小内存
          <input value={memMin} onChange={(e) => setMemMin(e.target.value)} />
        </label>
        <label>
          最大内存
          <input value={memMax} onChange={(e) => setMemMax(e.target.value)} />
        </label>
        <button className="btn primary" disabled={busy}>
          {busy ? '创建中...' : '创建'}
        </button>
      </form>
    </div>
  );
}
