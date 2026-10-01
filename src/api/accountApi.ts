import type { Account } from "../state/accountStore";

type DeveloperProfile = {
  id?: string | number;
  user_id?: string;
  name?: string | null;
  timezone?: string | null;
};

type ResponseEnvelope = {
  success?: unknown;
  data?: unknown;
};

function asDeveloperProfile(body: unknown): DeveloperProfile {
  if (!body || typeof body !== "object") throw new Error("Invalid account response");
  const envelope = body as ResponseEnvelope;
  const payload = envelope.success === true ? envelope.data : body;
  if (!payload || typeof payload !== "object") throw new Error("Invalid account response");
  return payload as DeveloperProfile;
}

export async function fetchAuthenticatedAccount(
  signal?: AbortSignal,
): Promise<Account | null> {
  const response = await fetch("/api/developers/me", {
    method: "GET",
    headers: { Accept: "application/json" },
    credentials: "include",
    signal,
  });
  if (response.status === 401 || response.status === 403) return null;
  if (!response.ok) {
    throw new Error("Failed to load account profile (HTTP " + response.status + ")");
  }
  const profile = asDeveloperProfile(await response.json());
  const rawId = profile.user_id ?? profile.id;
  if (
    (typeof rawId !== "string" && typeof rawId !== "number") ||
    String(rawId).trim() === ""
  ) {
    throw new Error("Account profile is missing an identifier");
  }
  const account: Account = {
    id: String(rawId),
    label:
      typeof profile.name === "string" && profile.name.trim()
        ? profile.name.trim()
        : "Developer account",
  };
  if (typeof profile.timezone === "string" && profile.timezone.trim()) {
    account.timezone = profile.timezone.trim();
  }
  return account;
}
