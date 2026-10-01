import { contextBridge } from 'electron';

// 渲染进程可通过 window.electronAPI 调用预加载接口
contextBridge.exposeInMainWorld('electronAPI', {
  // 如有需要，可在此暴露 IPC 接口
  // 当前方案：渲染进程直接通过 fetch/axios 访问 Express 后端
});
