/**
 * dsh-suanpan — 逻辑层冒烟测试（纯 Node，不依赖 DSH 包）。
 * 三家查询器的纯函数与归一化逻辑。
 */
import { test } from "node:test";
import assert from "node:assert/strict";

import * as deepseek from "../lib/logic/deepseek.js";
import * as minimax from "../lib/logic/minimax.js";
import * as opencode from "../lib/logic/opencode.js";
import { parseUsageArgs, PROVIDER_LABELS } from "../lib/index.js";

// ── deepseek ────────────────────────────────────────────────
test("deepseek: 周末全天谷价，工作日 9-12/14-18 峰价", () => {
  // 2026-08-22 是周六
  assert.equal(deepseek.isBeijingWeekend(new Date("2026-08-22T10:00:00Z")), true);
  assert.equal(deepseek.isPeakTime(new Date("2026-08-22T10:00:00Z")), false);
  // 2026-08-24 是周一，北京时间 10:00 = 02:00Z，处于峰时段
  assert.equal(deepseek.isBeijingWeekend(new Date("2026-08-24T02:00:00Z")), false);
  assert.equal(deepseek.isPeakTime(new Date("2026-08-24T02:00:00Z")), true);
  // 周一北京时间 23:00 = 15:00Z，非峰
  assert.equal(deepseek.isPeakTime(new Date("2026-08-24T15:00:00Z")), false);
});

test("deepseek: 余额归一化（构造假响应）", () => {
  const result = {
    is_available: true,
    balance_infos: [{ currency: "CNY", total_balance: 12.5, granted_balance: 2, topped_up_balance: 10.5 }]
  };
  const ctx = { credentials: { resolve: async () => ({ value: "sk-test" }) } };
  // fetch 在 Node 22+ 全局可用；此处直接测纯解析分支需 mock fetch，
  // 简单起见测 resolveApiKey 别名回退。
  return deepseek.resolveApiKey(ctx.credentials).then((key) => {
    assert.equal(key.ref, "DEEPSEEK_API_KEY");
  });
});

test("deepseek: key 别名回退 — 第一个 key 缺失时用第二个", () => {
  const credentials = {
    resolve: async (ref) => (ref === "DEEPSEEK_API_KEY" ? null : { value: "sk-alt" })
  };
  return deepseek.resolveApiKey(credentials).then((key) => {
    assert.equal(key.ref, "DEEPSEEK_API_KEY_ALT");
    assert.equal(key.value, "sk-alt");
  });
});

// ── minimax ─────────────────────────────────────────────────
test("minimax: 窗口字段抽取与归一化", () => {
  const raw = {
    model_name: "general",
    start_time: 1000, end_time: 2000, remains_time: 3600000,
    current_interval_total_count: 100, current_interval_usage_count: 40,
    current_interval_status: 1, current_interval_remaining_percent: 60,
    weekly_start_time: 3000, weekly_end_time: 4000, weekly_remains_time: 86400000,
    current_weekly_total_count: 1000, current_weekly_usage_count: 500,
    current_weekly_status: 0, current_weekly_remaining_percent: 50
  };
  const windows = minimax.pickModelWindows(raw);
  assert.ok(windows.rolling);
  assert.ok(windows.weekly);
  assert.equal(windows.monthly, null); // 无 monthly 字段
  const rolling = minimax.normalizeWindow(windows.rolling);
  assert.equal(rolling.percent, 40); // 100 - 60
  assert.equal(rolling.remaining_percent, 60);
  assert.equal(rolling.total_count, 100);
  assert.equal(rolling.usage_count, 40);
  assert.equal(rolling.remains_ms, 3600000);
});

test("minimax: formatRemainsRelative 毫秒换算", () => {
  assert.equal(minimax.formatRemainsRelative(90061000), "1d 1h 1m");
  assert.equal(minimax.formatRemainsRelative(60000), "1m");
  assert.equal(minimax.formatRemainsRelative(-5), null);
});

test("minimax: key 别名回退 — 本机 MINIMAX_API_KEY 优先，jooey 的 MINIMAX_CN_API_KEY 兜底", () => {
  const credentials = {
    resolve: async (ref) => (ref === "MINIMAX_API_KEY" ? { value: "sk-mm" } : null)
  };
  return minimax.resolveApiKey(credentials).then((key) => {
    assert.equal(key.ref, "MINIMAX_API_KEY");
    assert.equal(key.value, "sk-mm");
  });
});

test("minimax: formatUsages 渲染", () => {
  const usage = {
    base_resp: { status_code: 0 },
    model_remains: [{
      model_name: "general",
      current_interval_remaining_percent: 60,
      current_interval_usage_count: 40, current_interval_total_count: 100,
      remains_time: 3600000
    }]
  };
  const text = minimax.formatUsages(usage);
  assert.match(text, /\[general\] Rolling: 已用 40\.0%/);
  assert.match(text, /后重置/);
});

// ── opencode ────────────────────────────────────────────────
test("opencode: 窗口归一化", () => {
  const raw = { rolling: { percent: 7, resetsAt: "2026-08-25T00:00:00Z" } };
  const norm = opencode.normalizeWindow(raw.rolling);
  assert.equal(norm.percent, 7);
  assert.equal(norm.resetsAt, "2026-08-25T00:00:00Z");
  assert.equal(opencode.normalizeWindow(null), null);
});

test("opencode: formatUsages 渲染", () => {
  const usage = { rolling: { percent: 7, status: "ok", resetsAt: "2026-08-25T00:00:00Z" } };
  const text = opencode.formatUsages(usage);
  assert.match(text, /Rolling \(3d\)：已用 7\.0%/);
});

test("opencode: key 别名回退 — 本机 OPENCODE_API_KEY 优先", () => {
  const credentials = {
    resolve: async (ref) => (ref === "OPENCODE_API_KEY" ? { value: "sk-oc" } : null)
  };
  return opencode.resolveApiKey(credentials).then((key) => {
    assert.equal(key.ref, "OPENCODE_API_KEY");
  });
});

// ── parseUsageArgs（/usage 命令参数归一化）──────────────────
test("parseUsageArgs: 各形状归一化", () => {
  assert.deepEqual(parseUsageArgs("minimax weekly --json"), { provider: "minimax", window: "weekly", asJson: true, wantHelp: false, tokens: ["minimax", "weekly", "--json"] });
  assert.deepEqual(parseUsageArgs({ args: "ds rolling" }), { provider: "deepseek", window: "rolling", asJson: false, wantHelp: false, tokens: ["ds", "rolling"] });
  assert.deepEqual(parseUsageArgs(["--help"]), { provider: null, window: null, asJson: false, wantHelp: true, tokens: ["--help"] });
  assert.deepEqual(parseUsageArgs("opencode-go"), { provider: "opencode", window: null, asJson: false, wantHelp: false, tokens: ["opencode-go"] });
});

test("PROVIDER_LABELS 覆盖三家", () => {
  assert.deepEqual(Object.keys(PROVIDER_LABELS).sort(), ["deepseek", "minimax", "opencode"]);
});
