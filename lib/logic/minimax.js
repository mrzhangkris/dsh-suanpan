/**
 * dsh-suanpan — MiniMax（minimax-cn）Coding Plan 配额查询器。
 *
 * 借鉴 dsh-usage-minimax-cn（jooey, MIT）的端点与字段语义，重写为
 * 本插件统一的 snapshot 形状。官方端点 GET /v1/coding_plan/remains
 * 返回每个 model 的 rolling / weekly / monthly 窗口配额与剩余倒计时。
 *
 * key 别名回退：本机 settings.yaml 的 minimax-cn provider 使用
 * MINIMAX_API_KEY；jooey 插件用 MINIMAX_CN_API_KEY。两者都支持。
 */

/** 官方 MiniMax Coding Plan 配额端点。 */
export const USAGE_URL = "https://api.minimaxi.com/v1/coding_plan/remains";
/** MiniMax 开发者平台 Coding Plan 页（读条点击目标）。 */
export const PLATFORM_URL = "https://platform.minimaxi.com/user-center/payment/coding-plan";
/** 凭据候选 key 名（别名回退）。 */
export const API_KEY_REFS = ["MINIMAX_API_KEY", "MINIMAX_CN_API_KEY"];
/** 网络超时上限。 */
export const TIMEOUT_MS = 20000;

/** 规范窗口 id。 */
export const WINDOW_IDS = ["rolling", "weekly", "monthly"];
/** 窗口的人类标签。 */
export const WINDOW_LABELS = {
  rolling: "Rolling",
  weekly: "Weekly",
  monthly: "Monthly"
};

/** 规范窗口 -> API 时间字段前缀。 */
const TIME_KEY_MAP = {
  rolling: "",
  weekly: "weekly_",
  monthly: "monthly_"
};
/** 规范窗口 -> API 计量字段前缀。 */
const METER_KEY_MAP = {
  rolling: "current_interval",
  weekly: "current_weekly",
  monthly: "current_monthly"
};

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

/** 解析 base URL：MINIMAX_BASE_URL 覆盖，默认官方地址。 */
export function resolveBaseUrl() {
  const env = globalThis.process?.env?.MINIMAX_BASE_URL;
  if (typeof env === "string" && env.length > 0) return env.replace(/\/+$/, "");
  return "https://api.minimaxi.com";
}

/** 构建配额端点 URL。 */
export function resolveUsageUrl() {
  return `${resolveBaseUrl()}/v1/coding_plan/remains`;
}

/** 数字转百分比字符串，容忍缺失。 */
export function formatPercent(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "n/a";
  return `${n.toFixed(1)}%`;
}

/** Unix 毫秒时间戳转 ISO 8601；非法输入返回 null。 */
export function epochMsToIso(ms) {
  const t = Number(ms);
  if (!Number.isFinite(t) || t <= 0) return null;
  return new Date(t).toISOString();
}

/**
 * 把 API 返回的剩余毫秒数格式化为 "Xd Yh Zm"。
 * Coding Plan 端点的 `*_remains_time` 单位是毫秒（尽管后缀是 time）。
 */
export function formatRemainsRelative(ms) {
  const totalMs = Number(ms);
  if (!Number.isFinite(totalMs) || totalMs <= 0) return null;
  const totalSec = Math.floor(totalMs / 1000);
  const days = Math.floor(totalSec / 86400);
  const hours = Math.floor((totalSec % 86400) / 3600);
  const minutes = Math.floor((totalSec % 3600) / 60);
  const parts = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0 || days > 0) parts.push(`${hours}h`);
  parts.push(`${minutes}m`);
  return parts.join(" ");
}

/** 从一个 model 记录中抽出一个窗口的字段。 */
function pickOneWindow(model, windowId) {
  if (!model || typeof model !== "object") return null;
  const meter = METER_KEY_MAP[windowId];
  const time = TIME_KEY_MAP[windowId];
  if (!meter) return null;
  const start = time === "" ? model.start_time : model[`${time}start_time`];
  const end = time === "" ? model.end_time : model[`${time}end_time`];
  const remains = time === "" ? model.remains_time : model[`${time}remains_time`];
  const hasAny =
    model[`${meter}_total_count`] !== undefined ||
    model[`${meter}_usage_count`] !== undefined ||
    model[`${meter}_remaining_percent`] !== undefined ||
    model[`${meter}_status`] !== undefined ||
    start !== undefined || end !== undefined || remains !== undefined;
  if (!hasAny) return null;
  return {
    total_count: model[`${meter}_total_count`],
    usage_count: model[`${meter}_usage_count`],
    status: model[`${meter}_status`],
    remaining_percent: model[`${meter}_remaining_percent`],
    start_time: start,
    end_time: end,
    remains_time: remains
  };
}

/** 把三个窗口从一条 model 记录中抽出。 */
export function pickModelWindows(model) {
  if (!model || typeof model !== "object") return { rolling: null, weekly: null, monthly: null };
  const out = {};
  for (const id of WINDOW_IDS) {
    out[id] = pickOneWindow(model, id);
  }
  return out;
}

/** 归一化一个窗口条目为规范快照形状。 */
export function normalizeWindow(entry) {
  if (!entry || typeof entry !== "object") return null;
  const total = Number(entry.total_count);
  const usage = Number(entry.usage_count);
  const remainingPct = Number(entry.remaining_percent);
  const status = Number(entry.status);
  const end = Number(entry.end_time);
  const start = Number(entry.start_time);
  const remainsMs = Number(entry.remains_time);
  const percent = Number.isFinite(remainingPct)
    ? Math.max(0, Math.min(100, 100 - remainingPct))
    : null;
  return {
    percent,
    remaining_percent: Number.isFinite(remainingPct) ? remainingPct : null,
    total_count: Number.isFinite(total) ? total : null,
    usage_count: Number.isFinite(usage) ? usage : null,
    status: Number.isFinite(status) ? status : null,
    start_time: Number.isFinite(start) && start > 0 ? start : null,
    reset_at: epochMsToIso(end),
    remains_ms: Number.isFinite(remainsMs) && remainsMs > 0 ? remainsMs : null
  };
}

/** 遍历 model_remains，产出每模型归一化记录。 */
export function* iterateModels(usage) {
  if (!usage || typeof usage !== "object") return;
  const models = Array.isArray(usage.model_remains) ? usage.model_remains : [];
  for (const raw of models) {
    if (!raw || typeof raw !== "object") continue;
    yield {
      name: typeof raw.model_name === "string" && raw.model_name.length > 0 ? raw.model_name : "unknown",
      windows: pickModelWindows(raw)
    };
  }
}

/** 拉取原始配额数据（不格式化），供 /usage 命令使用。 */
export async function fetchUsage(ctx) {
  const key = await resolveApiKey(ctx.credentials);
  if (!key) {
    return {
      ok: false,
      error: `${API_KEY_REFS[0]} 未配置。请写入 ~/.dsh/.credentials.yaml 或设置环境变量。`
    };
  }
  const response = await fetch(resolveUsageUrl(), {
    headers: {
      Authorization: `Bearer ${key.value}`,
      Accept: "application/json"
    },
    signal: AbortSignal.timeout(TIMEOUT_MS)
  });
  if (!response.ok) {
    return { ok: false, error: `MiniMax Coding Plan 接口返回 HTTP ${response.status}` };
  }
  let body;
  try {
    body = await response.json();
  } catch (error) {
    return {
      ok: false,
      error: `MiniMax Coding Plan 接口返回非 JSON：${error instanceof Error ? error.message : String(error)}`
    };
  }
  const baseResp = body && typeof body === "object" ? body.base_resp : undefined;
  if (baseResp && typeof baseResp === "object" && Number(baseResp.status_code) !== 0) {
    return {
      ok: false,
      error: `MiniMax Coding Plan 接口错误：${baseResp.status_msg ?? `status ${baseResp.status_code}`}`
    };
  }
  return { ok: true, usage: body };
}

/** 拉取归一化快照（抛错版，供 Typert 网关）。 */
export async function fetchUsageSnapshot(credentials) {
  const key = await resolveApiKey(credentials);
  if (!key) {
    throw new Error(`${API_KEY_REFS[0]} 未配置。请写入 ~/.dsh/.credentials.yaml 或设置环境变量。`);
  }
  const response = await fetch(resolveUsageUrl(), {
    headers: {
      Authorization: `Bearer ${key.value}`,
      Accept: "application/json"
    },
    signal: AbortSignal.timeout(TIMEOUT_MS)
  });
  if (!response.ok) {
    throw new Error(`MiniMax Coding Plan 接口返回 HTTP ${response.status}`);
  }
  let body;
  try {
    body = await response.json();
  } catch (error) {
    throw new Error(`MiniMax Coding Plan 接口返回非 JSON：${error instanceof Error ? error.message : String(error)}`);
  }
  const models = [];
  for (const model of iterateModels(body)) {
    models.push({
      name: model.name,
      rolling: normalizeWindow(model.windows.rolling),
      weekly: normalizeWindow(model.windows.weekly),
      monthly: normalizeWindow(model.windows.monthly)
    });
  }
  return {
    models,
    status: body && typeof body.base_resp === "object"
      ? { code: Number(body.base_resp.status_code) || null, msg: typeof body.base_resp.status_msg === "string" ? body.base_resp.status_msg : null }
      : { code: null, msg: null }
  };
}

/** 渲染 model_remains 为人类可读多行报告。 */
export function formatUsages(usage, windowFilter = null) {
  if (!usage || typeof usage !== "object") return "无用量数据。";
  const baseResp = usage.base_resp;
  if (baseResp && typeof baseResp === "object" && Number(baseResp.status_code) !== 0) {
    return `接口错误：${baseResp.status_msg ?? `status ${baseResp.status_code}`}`;
  }
  const lines = [];
  for (const model of iterateModels(usage)) {
    const ids = windowFilter ? [windowFilter] : WINDOW_IDS;
    for (const id of ids) {
      const win = normalizeWindow(model.windows[id]);
      if (!win) continue;
      if (win.percent === null && win.usage_count === null && win.total_count === null) continue;
      const label = WINDOW_LABELS[id];
      const counts = (win.usage_count !== null && win.total_count !== null)
        ? ` · ${win.usage_count}/${win.total_count}`
        : "";
      const reset = win.remains_ms !== null
        ? ` · ${formatRemainsRelative(win.remains_ms)} 后重置`
        : (win.reset_at ? ` · ${win.reset_at} 重置` : "");
      const status = win.status !== null ? ` (status ${win.status})` : "";
      lines.push(`[${model.name}] ${label}: 已用 ${formatPercent(win.percent)}${counts}${reset}${status}`);
    }
  }
  return lines.length > 0 ? lines.join("\n") : "无用量数据。";
}

/** 原始 payload 的 JSON 输出（/usage minimax --json）。 */
export function formatUsageAsJson(usage, windowFilter = null) {
  if (!usage || typeof usage !== "object") return JSON.stringify(usage, null, 2);
  if (!windowFilter) return JSON.stringify(usage, null, 2);
  const out = [];
  for (const model of iterateModels(usage)) {
    const win = normalizeWindow(model.windows[windowFilter]);
    if (!win) continue;
    out.push({ model_name: model.name, ...win });
  }
  return JSON.stringify(out, null, 2);
}
