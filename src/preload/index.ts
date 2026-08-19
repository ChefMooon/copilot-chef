import { contextBridge, ipcRenderer } from "electron";

import type { IpcEventChannel, IpcEventMap, IpcInvokeMap } from "../shared/ipc";

function invokeWindowChannel<K extends "window:minimize" | "window:toggleMaximize" | "window:isMaximized" | "window:resetLayout" | "window:close">(
  channel: K
): Promise<Awaited<ReturnType<IpcInvokeMap[K]>>> {
  return ipcRenderer.invoke(channel) as Promise<Awaited<ReturnType<IpcInvokeMap[K]>>>;
}

const api = {
  invoke: <K extends keyof IpcInvokeMap>(
    channel: K,
    ...args: Parameters<IpcInvokeMap[K]>
  ): Promise<Awaited<ReturnType<IpcInvokeMap[K]>>> => {
    return ipcRenderer.invoke(channel, ...args) as Promise<
      Awaited<ReturnType<IpcInvokeMap[K]>>
    >;
  },
  on: <K extends IpcEventChannel>(channel: K, listener: IpcEventMap[K]): void => {
    ipcRenderer.on(channel, listener as (...args: unknown[]) => void);
  },
  minimizeWindow: () => invokeWindowChannel("window:minimize"),
  toggleMaximizeWindow: () => invokeWindowChannel("window:toggleMaximize"),
  isWindowMaximized: async () => {
    return invokeWindowChannel("window:isMaximized");
  },
  resetWindowLayout: () => invokeWindowChannel("window:resetLayout"),
  closeWindow: () => invokeWindowChannel("window:close"),
  off: <K extends IpcEventChannel>(
    channel: K,
    listener: IpcEventMap[K]
  ): void => {
    ipcRenderer.removeListener(channel, listener as (...args: unknown[]) => void);
  },
};

contextBridge.exposeInMainWorld("api", api);

export type ElectronApi = typeof api;
