import { MOCK_TRANSACTIONS } from "../../data/billingFixtures";
import { DEMO_INVOICE, type InvoiceItem } from "../../api/invoicesApi";

export { MOCK_TRANSACTIONS, DEMO_INVOICE };
export type { InvoiceItem };

export const DEMO_INVOICES_RESPONSE = {
  data: [DEMO_INVOICE],
  meta: {
    limit: 20,
    nextCursor: null,
    hasMore: false,
  },
};
