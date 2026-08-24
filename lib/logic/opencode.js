/**
 * dsh-suanpan — OpenCode Go（Zen Go）订阅配额查询器。
 *
 * 借鉴 dsh-usage-opencode-go（jooey, MIT）的端点与字段语义，重写为
 * 本插件统一的 snapshot 形状。官方端点 GET /zen/go/v1/usage 返回
 * rolling / weekly / monthly 三个窗口的 percent 与 resetsAt。
 *
 * key 别名回退：本机 settings.yaml 的 opencode-go provider 使用
 * OPENCODE_API_KEY；jooey 插件用 OPENCODE_GO_API_KEY。两者都支持。
 */

/** 官方 OpenCode Zen Go 用量端点。 */
export const USAGE_URL = "https://opencode.ai/zen/go/v1/usage";
/** OpenCode 邀请注册页。 */
export const REFERRAL_URL = "https://opencode.ai/go";
/** 凭据候选 key 名（别名回退）。 */
export const API_KEY_REFS = ["OPENCODE_API_KEY", "OPENCODE_GO_API_KEY"];
/** 网络超时上限。 */
export const TIMEOUT_MS = 20000;

/** 窗口的人类标签。 */
export const WINDOW_TITLES = {
  rolling: "Rolling (3d)",
  weekly: "Weekly",
  monthly: "Monthly"
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

/** 拉取原始用量数据（不格式化），供 /usage 命令使用。 */
export async function fetchUsage(ctx) {
  const key = await resolveApiKey(ctx.credentials);
  if (!key) {
    return {
      ok: false,
      error: `${API_KEY_REFS[0]} 未配置。请写入 ~/.dsh/.credentials.yaml 或设置环境变量。`
    };
  }
  const response = await fetch(USAGE_URL, {
    headers: {
      Authorization: `Bearer ${key.value}`,
      Accept: "application/json"
    },
    signal: AbortSignal.timeout(TIMEOUT_MS)
  });
  if (!response.ok) {
    return { ok: false, error: `OpenCode 用量接口返回 HTTP ${response.status}` };
  }
  let body;
  try {
    body = await response.json();
  } catch (error) {
    return {
      ok: false,
      error: `OpenCode 用量接口返回非 JSON：${error instanceof Error ? error.message : String(error)}`
    };
  }
  return { ok: true, usage: body?.usage };
}

/** 渲染一个窗口为百分比字符串，容忍缺失。 */
export function formatPercent(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "n/a";
  return `${n.toFixed(1)}%`;
}

/** 渲染各窗口为一行文本；未知窗口丢弃。 */
export function formatUsages(usage) {
  if (!usage || typeof usage !== "object") return "无用量数据。";
  const lines = [];
  for (const [windowKey, window] of Object.entries(usage)) {
    if (!window || typeof window !== "object") continue;
    const label = WINDOW_TITLES[windowKey] ?? windowKey;
    const status = window.status === "ok" ? "正常" : String(window.status ?? "未知");
    const percent = formatPercent(window.percent);
    const reset = typeof window.resetsAt === "string" ? ` · ${window.resetsAt} 重置` : "";
    lines.push(`${label}：已用 ${percent}（状态 ${status}）${reset}`);
  }
  return lines.length > 0 ? lines.join("\n") : "无用量窗口。";
}

/** 归一化一个 API 窗口为规范形状；未知/缺失窗口返回 null。 */
export function normalizeWindow(window) {
  if (!window || typeof window !== "object") return null;
  return {
    percent: Number.isFinite(Number(window.percent)) ? Number(window.percent) : null,
    resetsAt: typeof window.resetsAt === "string" ? window.resetsAt : null
  };
}

/** 拉取归一化快照（抛错版，供 Typert 网关）。 */
export async function fetchUsageSnapshot(credentials) {
  const key = await resolveApiKey(credentials);
  if (!key) {
    throw new Error(`${API_KEY_REFS[0]} 未配置。请写入 ~/.dsh/.credentials.yaml 或设置环境变量。`);
  }
  const response = await fetch(USAGE_URL, {
    headers: {
      Authorization: `Bearer ${key.value}`,
      Accept: "application/json"
    },
    signal: AbortSignal.timeout(TIMEOUT_MS)
  });
  if (!response.ok) {
    throw new Error(`OpenCode 用量接口返回 HTTP ${response.status}`);
  }
  let body;
  try {
    body = await response.json();
  } catch (error) {
    throw new Error(`OpenCode 用量接口返回非 JSON：${error instanceof Error ? error.message : String(error)}`);
  }
  const usage = body && typeof body === "object" ? body.usage : undefined;
  return {
    rolling: normalizeWindow(usage?.rolling),
    weekly: normalizeWindow(usage?.weekly),
    monthly: normalizeWindow(usage?.monthly)
  };
}
