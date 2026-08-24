/**
 * dsh-suanpan — TypeScript 声明（手写，供编辑器提示）。
 */

export interface BalancePricing {
  isPeak: boolean;
  label: string;
}

export interface BalanceSnapshot {
  isAvailable: boolean | null;
  currency: string | null;
  total: number | null;
  granted: number | null;
  toppedUp: number | null;
  pricing: BalancePricing;
}

export interface MiniMaxWindow {
  percent: number | null;
  remaining_percent: number | null;
  total_count: number | null;
  usage_count: number | null;
  status: number | null;
  start_time: number | null;
  reset_at: string | null;
  remains_ms: number | null;
}

export interface MiniMaxModel {
  name: string;
  rolling: MiniMaxWindow | null;
  weekly: MiniMaxWindow | null;
  monthly: MiniMaxWindow | null;
}

export interface MiniMaxSnapshot {
  models: MiniMaxModel[];
  status: { code: number | null; msg: string | null };
}

export interface OpenCodeWindow {
  percent: number | null;
  resetsAt: string | null;
}

export interface OpenCodeSnapshot {
  rolling: OpenCodeWindow | null;
  weekly: OpenCodeWindow | null;
  monthly: OpenCodeWindow | null;
}

export interface SuanpanSnapshot {
  deepseek: BalanceSnapshot;
  minimax: MiniMaxSnapshot;
  opencode: OpenCodeSnapshot;
}

export declare const PROVIDER_LABELS: Record<string, string>;
export declare function parseUsageArgs(rawArgs: unknown): { provider: string | null; window: string | null; asJson: boolean; wantHelp: boolean; tokens: string[] };
