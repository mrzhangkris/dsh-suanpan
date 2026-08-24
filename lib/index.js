/**
 * dsh-suanpan（算盘）— host 端入口。
 *
 * 统一用量监控：DeepSeek 余额 / MiniMax Coding Plan / OpenCode Go 配额。
 * - `/usage [deepseek|minimax|opencode] [rolling|weekly|monthly] [--json]`
 *   斜杠命令，按 provider 过滤输出
 * - Typert 远程服务 `suanpan/snapshot`：浏览器端读条/悬浮窗只拿到
 *   归一化快照，三家 API key 全部经凭据 seam 在 host 端解析，绝不下发
 *
 * 借鉴：dsh-usage-minimax-cn / dsh-usage-opencode-go / dsh-usage-deepseek
 * （jooey, MIT）的端点语义与分层结构，重写为三合一。
 */

import { TypertRemoteService } from "@deepseek-ai/dsh-typert-protocol";
import * as deepseek from "./logic/deepseek.js";
import * as minimax from "./logic/minimax.js";
import * as opencode from "./logic/opencode.js";
import TYPERT from "./typert.host.js";

const name = "suanpan";
const inject = ["commands", "credentials"];

/** Provider id -> 展示名。 */
export const PROVIDER_LABELS = {
  deepseek: "DeepSeek",
  minimax: "MiniMax",
  opencode: "OpenCode Go"
};

/** Provider id -> 平台页（报告尾部点击目标）。 */
export const PLATFORM_URLS = {
  deepseek: deepseek.PLATFORM_URL,
  minimax: minimax.PLATFORM_URL,
  opencode: opencode.REFERRAL_URL
};

/**
 * Host 端远程服务：向浏览器暴露最新用量快照。
 * 经 Typert 挂载为 `suanpan` 服务；./typert 清单声明
 * `suanpan/snapshot` 端点，client 端通过 ctx.remote 挂载。
 */
class SuanpanGateway extends TypertRemoteService {
  static inject = ["credentials"];

  constructor(ctx) {
    super(ctx, "suanpan");
  }

  /** 拉取三家归一化快照；任何一家失败则抛错。 */
  async snapshot() {
    const credentials = this.ctx.credentials;
    const [balance, miniMaxUsage, openCodeUsage] = await Promise.all([
      deepseek.fetchBalanceSnapshot(credentials),
      minimax.fetchUsageSnapshot(credentials),
      opencode.fetchUsageSnapshot(credentials)
    ]);
    return {
      deepseek: balance,
      minimax: miniMaxUsage,
      opencode: openCodeUsage
    };
  }
}

/** 归一化 /usage 命令的 rawArgs 各种形状（string/object/array）。 */
export function parseUsageArgs(rawArgs) {
  let tokens = [];
  if (typeof rawArgs === "string") {
    tokens = rawArgs.trim().split(/\s+/).filter(Boolean);
  } else if (Array.isArray(rawArgs)) {
    for (const entry of rawArgs) {
      if (typeof entry === "string") tokens.push(...entry.trim().split(/\s+/).filter(Boolean));
    }
  } else if (rawArgs && typeof rawArgs === "object") {
    const candidate = rawArgs.args ?? rawArgs.text ?? rawArgs.input ?? rawArgs.command;
    if (typeof candidate === "string") tokens = candidate.trim().split(/\s+/).filter(Boolean);
  }
  const lower = tokens.map((token) => token.toLowerCase());
  const providerAliases = {
    deepseek: "deepseek",
    ds: "deepseek",
    minimax: "minimax",
    mm: "minimax",
    "opencode": "opencode",
    "opencode-go": "opencode",
    "opencode go": "opencode",
    ocg: "opencode"
  };
  const windowAliases = { rolling: "rolling", weekly: "weekly", monthly: "monthly" };
  let provider = null;
  let window = null;
  let asJson = false;
  let wantHelp = false;
  for (const token of lower) {
    if (token === "json" || token === "--json" || token === "-j") {
      asJson = true;
    } else if (token === "help" || token === "--help" || token === "-h") {
      wantHelp = true;
    } else if (Object.prototype.hasOwnProperty.call(windowAliases, token)) {
      window = windowAliases[token];
    } else if (Object.prototype.hasOwnProperty.call(providerAliases, token)) {
      provider = providerAliases[token];
    }
  }
  return { provider, window, asJson, wantHelp, tokens };
}

/** 帮助文本。 */
export const USAGE_HELP = [
  "用法：/usage [provider] [window] [--json|-j] [--help|-h]",
  "",
  "查看 DeepSeek 余额 / MiniMax Coding Plan / OpenCode Go 配额。",
  "",
  "provider：",
  "  deepseek (ds)      DeepSeek 官方余额 + 峰谷计价时段",
  "  minimax (mm)       MiniMax Coding Plan rolling/weekly/monthly 配额",
  "  opencode (ocg)     OpenCode Go rolling(3d)/weekly/monthly 配额",
  "  省略则显示全部三家",
  "",
  "window：",
  "  rolling | weekly | monthly    仅显示命名窗口（deepseek 忽略）",
  "",
  "  --json | -j   输出原始 JSON",
  "  --help | -h   显示本帮助"
].join("\n");

/** 组装完整 /usage 报告。 */
function buildUsageMessage(all, opts) {
  if (opts.asJson) {
    const out = {};
    if (!opts.provider || opts.provider === "deepseek") out.deepseek = all.deepseek;
    if (!opts.provider || opts.provider === "minimax") out.minimax = all.minimax;
    if (!opts.provider || opts.provider === "opencode") out.opencode = all.opencode;
    return JSON.stringify(out, null, 2);
  }
  const sections = [];
  if (!opts.provider || opts.provider === "deepseek") {
    sections.push(`【DeepSeek】\n${deepseek.formatBalanceReport(all.deepseek)}`);
  }
  if (!opts.provider || opts.provider === "minimax") {
    sections.push(`【MiniMax Coding Plan】\n${minimax.formatUsages(all.minimax, opts.window)}`);
  }
  if (!opts.provider || opts.provider === "opencode") {
    sections.push(`【OpenCode Go】\n${opencode.formatUsages(all.opencode)}`);
  }
  const platforms = [];
  if (!opts.provider || opts.provider === "deepseek") platforms.push(`DeepSeek: ${PLATFORM_URLS.deepseek}`);
  if (!opts.provider || opts.provider === "minimax") platforms.push(`MiniMax: ${PLATFORM_URLS.minimax}`);
  if (!opts.provider || opts.provider === "opencode") platforms.push(`OpenCode Go: ${PLATFORM_URLS.opencode}`);
  return [...sections, "", platforms.join("\n")].join("\n");
}

/** 注册 /usage 命令并挂载浏览器远程网关。 */
async function apply(ctx) {
  await ctx.plugin(SuanpanGateway);
  ctx.commands.register({
    name: "usage",
    description: "算盘：查看 DeepSeek 余额 / MiniMax Coding Plan / OpenCode Go 配额（[deepseek|minimax|opencode] [rolling|weekly|monthly] [--json]）",
    handler: async (rawArgs) => {
      const opts = parseUsageArgs(rawArgs);
      if (opts.wantHelp) {
        return { kind: "success", text: USAGE_HELP };
      }
      // 一次性并发拉三家，单家失败不影响整体输出。
      const [balanceRes, miniMaxRes, openCodeRes] = await Promise.all([
        deepseek.fetchDeepSeekBalance(ctx),
        minimax.fetchUsage(ctx),
        opencode.fetchUsage(ctx)
      ]);
      if (opts.asJson) {
        return { kind: "success", text: buildUsageMessage(
          { deepseek: balanceRes.ok ? balanceRes.data : { error: balanceRes.error }, minimax: miniMaxRes.ok ? miniMaxRes.usage : { error: miniMaxRes.error }, opencode: openCodeRes.ok ? openCodeRes.usage : { error: openCodeRes.error } },
          opts
        ) };
      }
      const sections = [];
      if (!opts.provider || opts.provider === "deepseek") {
        sections.push(`【DeepSeek】\n${balanceRes.ok ? deepseek.formatBalanceReport(balanceRes.data) : `  ⚠ ${balanceRes.error}`}`);
      }
      if (!opts.provider || opts.provider === "minimax") {
        sections.push(`【MiniMax Coding Plan】\n${miniMaxRes.ok ? minimax.formatUsages(miniMaxRes.usage, opts.window) : `  ⚠ ${miniMaxRes.error}`}`);
      }
      if (!opts.provider || opts.provider === "opencode") {
        sections.push(`【OpenCode Go】\n${openCodeRes.ok ? opencode.formatUsages(openCodeRes.usage) : `  ⚠ ${openCodeRes.error}`}`);
      }
      const platforms = [];
      if (!opts.provider || opts.provider === "deepseek") platforms.push(`DeepSeek: ${PLATFORM_URLS.deepseek}`);
      if (!opts.provider || opts.provider === "minimax") platforms.push(`MiniMax: ${PLATFORM_URLS.minimax}`);
      if (!opts.provider || opts.provider === "opencode") platforms.push(`OpenCode Go: ${PLATFORM_URLS.opencode}`);
      return { kind: "success", text: [...sections, "", platforms.join("\n")].join("\n") };
    }
  });
}

export {
  apply,
  inject,
  name,
  SuanpanGateway,
  buildUsageMessage,
  TYPERT
};
