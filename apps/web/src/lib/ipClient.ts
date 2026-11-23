import type { Remote } from "comlink";
import * as Comlink from "comlink";
import type { WorkerApi } from "../workers/ip.worker";

export interface IpWorkerHandle {
  api: Remote<WorkerApi>;
  terminate: () => void;
}

export function createIpWorker(): IpWorkerHandle {
  const worker = new Worker(new URL("../workers/ip.worker.ts", import.meta.url), {
    type: "module",
  });
  return {
    api: Comlink.wrap<WorkerApi>(worker),
    terminate: () => worker.terminate(),
  };
}
