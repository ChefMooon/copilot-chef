import { contextBridge, ipcRenderer } from "electron";

type AllowedChannel =
  | "window:minimize"
  | "window:toggleMaximize"
  | "window:isMaximized"
  | "window:close";

function invokeWindowChannel(channel: AllowedChannel): Promise<unknown> {
  return ipcRenderer.invoke(channel);
}

const api = {
  invoke: (channel: string, ...args: unknown[]): Promise<unknown> => {
    return ipcRenderer.invoke(channel, ...args);
  },
  on: (channel: string, listener: (...args: unknown[]) => void): void => {
    ipcRenderer.on(channel, (_event, ...args) => listener(...args));
  },
  minimizeWindow: () => invokeWindowChannel("window:minimize"),
  toggleMaximizeWindow: () => invokeWindowChannel("window:toggleMaximize"),
  isWindowMaximized: async () => {
    return (await invokeWindowChannel("window:isMaximized")) as boolean;
  },
  closeWindow: () => invokeWindowChannel("window:close"),
  off: (channel: string, listener: (...args: unknown[]) => void): void => {
    ipcRenderer.removeListener(channel, listener);
  },
};

contextBridge.exposeInMainWorld("api", api);

export type ElectronApi = typeof api;
