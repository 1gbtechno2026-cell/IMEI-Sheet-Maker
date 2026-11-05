import type { InvoiceType } from "../api/invoices";

/** localStorage keys for work in progress on the IMEI sheet page. */
export const templateStorageKey = (type: InvoiceType) => `invoiceMaker.dataTemplate.${type}`;
export const scanStorageKey = (type: InvoiceType) => `invoiceMaker.scanSheet.${type}`;
