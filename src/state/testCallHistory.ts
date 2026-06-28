const STORAGE_KEY = "callora_test_call_history";
const MAX_ENTRIES = 50;

export interface HistoryEntry {
  id: string;
  timestamp: string;
  endpointId: string;
  endpointName: string;
  endpointPath: string;
  method: string;
  requestParams: string;
  response: unknown;
  status: "success" | "error";
  responseTime: number;
  cost: number;
}

export function loadHistory(): HistoryEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as HistoryEntry[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveEntry(entry: HistoryEntry): void {
  if (typeof window === "undefined") return;
  try {
    const history = loadHistory();
    history.unshift(entry);
    if (history.length > MAX_ENTRIES) {
      history.length = MAX_ENTRIES;
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
  } catch {
    /* storage full or blocked — silently ignore */
  }
}

export function clearHistory(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}
