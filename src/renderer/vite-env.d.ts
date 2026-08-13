/// <reference types="vite/client" />

import type { IpcEventChannel, IpcEventMap, IpcInvokeMap } from "../shared/ipc";

type WindowApi = {
  invoke: <K extends keyof IpcInvokeMap>(
    channel: K,
    ...args: Parameters<IpcInvokeMap[K]>
  ) => Promise<Awaited<ReturnType<IpcInvokeMap[K]>>>;
  on: <K extends IpcEventChannel>(channel: K, listener: IpcEventMap[K]) => void;
  off: <K extends IpcEventChannel>(channel: K, listener: IpcEventMap[K]) => void;
  minimizeWindow: () => Promise<Awaited<ReturnType<IpcInvokeMap["window:minimize"]>>>;
  toggleMaximizeWindow: () => Promise<Awaited<ReturnType<IpcInvokeMap["window:toggleMaximize"]>>>;
  isWindowMaximized: () => Promise<Awaited<ReturnType<IpcInvokeMap["window:isMaximized"]>>>;
  resetWindowLayout: () => Promise<Awaited<ReturnType<IpcInvokeMap["window:resetLayout"]>>>;
  closeWindow: () => Promise<Awaited<ReturnType<IpcInvokeMap["window:close"]>>>;
};

interface Window {
  api?: WindowApi;
}
