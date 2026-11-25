import type { QuotaRecord } from "../../api/quotaApi";

export type { QuotaRecord };

export const DEMO_QUOTA: QuotaRecord = {
  accountId: "acme-labs",
  value: 1000,
  version: 1,
  updatedAt: 1722168000000,
};
