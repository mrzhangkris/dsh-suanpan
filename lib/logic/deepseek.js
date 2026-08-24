/**
 * dsh-suanpan — DeepSeek 官方余额查询器。
 *
 * 借鉴 dsh-usage-deepseek（jooey, MIT）的端点与字段语义，重写为
 * 本插件统一的 snapshot 形状。官方计费端点 GET /user/balance 返回
 * 各币种余额（granted 赠送 / topped_up 充值），无 rolling/weekly 窗口。
 *
 * 依赖零外部包，仅用 Web/Node 平台全局（fetch / AbortSignal），
 * 可被纯 Node 工具直接 import 做冒烟测试。
 */

/** 官方 DeepSeek 平台 base URL（可用 DEEPSEEK_BASE_URL 覆盖）。 */
export const DEFAULT_BASE_URL = "https://api.deepseek.com";
/** DeepSeek 平台账单页（悬浮窗/命令的点击目标）。 */
export const PLATFORM_URL = "https://platform.deepseek.com/usage";
/** 凭据候选 key 名（别名回退：本机常用名优先）。 */
export const API_KEY_REFS = ["DEEPSEEK_API_KEY", "DEEPSEEK_API_KEY_ALT"];
/** 网络超时上限，防止端点无响应挂起一轮。 */
export const TIMEOUT_MS = 20000;

/** 各币种符号。 */
export const CURRENCY_SYMBOLS = {
  CNY: "¥",
  USD: "$",
  EUR: "€",
  GBP: "£"
};

/** DeepSeek 峰谷计价窗口按北京时间（UTC+8）定义。 */
export const BEIJING_TIME_ZONE = "Asia/Shanghai";
/** 峰时段为分钟级 [start, end) 区间。 */
export const PEAK_WINDOWS = [
  { start: 9 * 60, end: 12 * 60 },
  { start: 14 * 60, end: 18 * 60 }
];
/**
 * 2026-08-23 起 DeepSeek 周末全天按谷价计费：峰时段仅工作日适用。
 */
export const WEEKEND_ALL_DAY_OFF_PEAK_SINCE = "2026-08-23";
/** 人类可读的峰谷说明，用于 /usage 报告与读条标题。 */
export const PEAK_WINDOW_LABEL = "北京时间工作日 09:00-12:00, 14:00-18:00 · 周末全天谷价";

/** 当前北京时间分钟数（0-1439）。 */
export function beijingMinutesNow(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: BEIJING_TIME_ZONE,
    hour12: false,
    hour: "2-digit",
    minute: "2-digit"
  }).formatToParts(date);
  const hour = Number(parts.find((part) => part.type === "hour").value);
  const minute = Number(parts.find((part) => part.type === "minute").value);
  return hour * 60 + minute;
}

/** 北京时间星期几：0 = 周日 … 6 = 周六。 */
export function beijingDayOfWeek(date = new Date()) {
  const name = new Intl.DateTimeFormat("en-US", {
    timeZone: BEIJING_TIME_ZONE,
    weekday: "short"
  }).format(date);
  return { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 }[name];
}

/** 北京时间是否为周六/周日。 */
export function isBeijingWeekend(date = new Date()) {
  const day = beijingDayOfWeek(date);
  return day === 0 || day === 6;
}

/** 当前是否处于峰价时段（周末永不峰价）。 */
export function isPeakTime(date = new Date()) {
  if (isBeijingWeekend(date)) return false;
  const minutes = beijingMinutesNow(date);
  return PEAK_WINDOWS.some(({ start, end }) => minutes >= start && minutes < end);
}

/** 一行峰谷状态文本。 */
export function formatPricingWindow(date = new Date()) {
  if (isBeijingWeekend(date)) {
    return "谷价（峰值 50%）· 周末全天谷价";
  }
  return isPeakTime(date)
    ? `峰价 · ${PEAK_WINDOW_LABEL}`
    : "谷价（峰值 50%）";
}

/** 解析 base URL：环境变量覆盖，默认官方地址。 */
export function resolveBaseUrl() {
  const env = globalThis.process?.env?.DEEPSEEK_BASE_URL;
  if (typeof env === "string" && env.length > 0) return env.replace(/\/+$/, "");
  return DEFAULT_BASE_URL;
}

/** 通过凭据 seam 解析 key（别名回退）。 */
export async function resolveApiKey(credentials) {
  for (const ref of API_KEY_REFS) {
    const credential = await credentials.resolve(ref).catch(() => null);
    if (credential && typeof credential.value === "string" && credential.value.length > 0) {
      return { ref, value: credential.value };
    }
  }
  return null;
}

/** 拉取并归一化余额快照。返回 { ok, data } 或 { ok:false, error }。 */
export async function fetchDeepSeekBalance(ctx) {
  const key = await resolveApiKey(ctx.credentials);
  if (!key) {
    return {
      ok: false,
      error: `${API_KEY_REFS[0]} 未配置。请写入 ~/.dsh/.credentials.yaml 或设置环境变量。`
    };
  }
  const response = await fetch(`${resolveBaseUrl()}/user/balance`, {
    headers: {
      Authorization: `Bearer ${key.value}`,
      Accept: "application/json"
    },
    signal: AbortSignal.timeout(TIMEOUT_MS)
  });
  if (!response.ok) {
    return { ok: false, error: `DeepSeek 余额接口返回 HTTP ${response.status}` };
  }
  let body;
  try {
    body = await response.json();
  } catch (error) {
    return {
      ok: false,
      error: `DeepSeek 余额接口返回非 JSON：${error instanceof Error ? error.message : String(error)}`
    };
  }
  const infos = Array.isArray(body?.balance_infos) ? body.balance_infos : [];
  const info = infos.find((entry) => entry?.currency === "CNY") ?? infos[0];
  const num = (value) => {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  };
  return {
    ok: true,
    data: {
      isAvailable: body?.is_available === true,
      currency: info?.currency ?? null,
      total: num(info?.total_balance),
      granted: num(info?.granted_balance),
      toppedUp: num(info?.topped_up_balance),
      pricing: {
        isPeak: isPeakTime(),
        label: formatPricingWindow()
      }
    }
  };
}

/** 拉取归一化余额快照（抛错版，供 Typert 网关使用）。 */
export async function fetchBalanceSnapshot(credentials) {
  const key = await resolveApiKey(credentials);
  if (!key) {
    throw new Error(`${API_KEY_REFS[0]} 未配置。请写入 ~/.dsh/.credentials.yaml 或设置环境变量。`);
  }
  const response = await fetch(`${resolveBaseUrl()}/user/balance`, {
    headers: {
      Authorization: `Bearer ${key.value}`,
      Accept: "application/json"
    },
    signal: AbortSignal.timeout(TIMEOUT_MS)
  });
  if (!response.ok) {
    throw new Error(`DeepSeek 余额接口返回 HTTP ${response.status}`);
  }
  let body;
  try {
    body = await response.json();
  } catch (error) {
    throw new Error(`DeepSeek 余额接口返回非 JSON：${error instanceof Error ? error.message : String(error)}`);
  }
  const infos = Array.isArray(body?.balance_infos) ? body.balance_infos : [];
  const info = infos.find((entry) => entry?.currency === "CNY") ?? infos[0];
  const num = (value) => {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  };
  return {
    isAvailable: body?.is_available === true,
    currency: info?.currency ?? null,
    total: num(info?.total_balance),
    granted: num(info?.granted_balance),
    toppedUp: num(info?.topped_up_balance),
    pricing: {
      isPeak: isPeakTime(),
      label: formatPricingWindow()
    }
  };
}

/** 把余额数据渲染为文本报告（供 /usage deepseek 使用）。 */
export function formatBalanceReport(data) {
  if (!data) return "无余额数据。";
  const symbol = CURRENCY_SYMBOLS[data.currency] ?? "";
  const fmt = (value) => (typeof value === "number" ? `${symbol}${value.toFixed(2)}` : "n/a");
  const lines = [];
  lines.push(`可用余额：${fmt(data.total)}（总 ${fmt(data.total)} · 赠送 ${fmt(data.granted)} · 充值 ${fmt(data.toppedUp)}）`);
  lines.push(`计价时段：${data.pricing?.label ?? "n/a"}`);
  return lines.join("\n");
}
