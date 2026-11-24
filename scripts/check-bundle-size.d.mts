import type { BudgetEvaluation } from './bundleBudget.mjs';

export interface BundleReport extends BudgetEvaluation {
  ok: boolean;
  error: string | null;
  budget: Record<string, number> | null;
}

export function runCheck(options?: {
  distDir?: string;
  budgetPath?: string;
}): BundleReport;
