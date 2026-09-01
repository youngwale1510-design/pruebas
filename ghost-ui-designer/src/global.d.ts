import type { GhostApi } from '../electron/ipc-contract';

declare global {
  interface Window {
    ghost: GhostApi;
  }
}

export {};
