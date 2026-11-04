/**
 * Preload bridge — API base URL + PDF helpers for the renderer.
 */

import { contextBridge, ipcRenderer } from "electron";

export type InvoiceMakerBridge = {
  getApiBaseUrl: () => Promise<string>;
  openPath: (targetPath: string) => Promise<{ ok: boolean; error: string | null }>;
  showItemInFolder: (targetPath: string) => Promise<{ ok: boolean; error: string | null }>;
  printPdfUrl: (pdfUrl: string) => Promise<{ ok: boolean; error: string | null }>;
  platform: NodeJS.Platform;
};

const bridge: InvoiceMakerBridge = {
  getApiBaseUrl: () => ipcRenderer.invoke("get-api-base-url") as Promise<string>,
  openPath: (targetPath: string) =>
    ipcRenderer.invoke("open-path", targetPath) as Promise<{ ok: boolean; error: string | null }>,
  showItemInFolder: (targetPath: string) =>
    ipcRenderer.invoke("show-item-in-folder", targetPath) as Promise<{
      ok: boolean;
      error: string | null;
    }>,
  printPdfUrl: (pdfUrl: string) =>
    ipcRenderer.invoke("print-pdf-url", pdfUrl) as Promise<{ ok: boolean; error: string | null }>,
  platform: process.platform,
};

contextBridge.exposeInMainWorld("invoiceMaker", bridge);

declare global {
  interface Window {
    invoiceMaker: InvoiceMakerBridge;
  }
}
