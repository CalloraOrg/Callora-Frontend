export const KIB: number;

export type AssetKind = 'entry' | 'chunk' | 'css';

export interface AssetInput {
  file: string;
  kind: AssetKind;
  rawBytes: number;
  gzipBytes: number;
}

export interface BudgetResult extends AssetInput {
  limitKb: number | null;
  limitBytes: number | null;
  exceeded: boolean;
}

export interface BudgetEvaluation {
  results: BudgetResult[];
  failures: BudgetResult[];
  passed: boolean;
}

export function classifyAsset(file: string, entryFiles: Set<string>): AssetKind;

export function extractEntryFiles(html: string): Set<string>;

export function evaluateBudget(
  assets: AssetInput[],
  budget: Record<string, number>,
): BudgetEvaluation;

export function formatKb(bytes: number): string;
