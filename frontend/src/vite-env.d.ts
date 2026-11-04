/// <reference types="vite/client" />

interface InvoiceMakerBridge {
  getApiBaseUrl: () => Promise<string>;
  openPath?: (targetPath: string) => Promise<{ ok: boolean; error: string | null }>;
  showItemInFolder?: (targetPath: string) => Promise<{ ok: boolean; error: string | null }>;
  printPdfUrl?: (pdfUrl: string) => Promise<{ ok: boolean; error: string | null }>;
  platform: NodeJS.Platform;
}

interface Window {
  invoiceMaker?: InvoiceMakerBridge;
}
