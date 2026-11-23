import MOCK_APIS, { type APIItem } from "../../data/mockApis";

export { MOCK_APIS };
export type { APIItem };

/**
 * Returns the subset of catalogue APIs belonging to the provider `acme-labs`,
 * matching the mock provider API rows used in demo mode.
 */
export function getProviderApis(): (APIItem & { publishStatus: "live" | "pending" | "rejected" })[] {
  const statuses: ("live" | "pending" | "rejected")[] = ["live", "pending", "rejected"];
  return MOCK_APIS
    .filter(
      (api) =>
        api.provider.name.toLowerCase().replace(/\s+/g, "-") === "acme-labs",
    )
    .map((api, i) => ({
      ...api,
      publishStatus: statuses[i % 3] ?? "live",
    }));
}
