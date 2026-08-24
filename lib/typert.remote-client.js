/* Client-face Typert remote manifest for dsh-suanpan（手写）。
   与 host 端 zod 校验对齐，client 只做严格 codec 形状校验。 */

const balancePricingSchema = {
  parse(value) {
    if (!value || typeof value !== "object") throw new TypeError("expected a balance pricing object");
    return {
      isPeak: typeof value.isPeak === "boolean" ? value.isPeak : false,
      label: typeof value.label === "string" ? value.label : ""
    };
  }
};

const balanceSnapshotSchema = {
  parse(value) {
    if (!value || typeof value !== "object") throw new TypeError("expected a balance snapshot object");
    return {
      isAvailable: typeof value.isAvailable === "boolean" ? value.isAvailable : null,
      currency: typeof value.currency === "string" ? value.currency : null,
      total: typeof value.total === "number" ? value.total : null,
      granted: typeof value.granted === "number" ? value.granted : null,
      toppedUp: typeof value.toppedUp === "number" ? value.toppedUp : null,
      pricing: balancePricingSchema.parse(value.pricing)
    };
  }
};

const miniMaxWindowSchema = {
  parse(value) {
    if (value === null || value === undefined) return null;
    if (typeof value !== "object") throw new TypeError("expected a minimax window snapshot object");
    return {
      percent: typeof value.percent === "number" ? value.percent : null,
      remaining_percent: typeof value.remaining_percent === "number" ? value.remaining_percent : null,
      total_count: typeof value.total_count === "number" ? value.total_count : null,
      usage_count: typeof value.usage_count === "number" ? value.usage_count : null,
      status: typeof value.status === "number" ? value.status : null,
      start_time: typeof value.start_time === "number" ? value.start_time : null,
      reset_at: typeof value.reset_at === "string" ? value.reset_at : null,
      remains_ms: typeof value.remains_ms === "number" ? value.remains_ms : null
    };
  }
};

const miniMaxModelSchema = {
  parse(value) {
    if (!value || typeof value !== "object") throw new TypeError("expected a minimax model snapshot object");
    return {
      name: typeof value.name === "string" ? value.name : "unknown",
      rolling: miniMaxWindowSchema.parse(value.rolling),
      weekly: miniMaxWindowSchema.parse(value.weekly),
      monthly: miniMaxWindowSchema.parse(value.monthly)
    };
  }
};

const openCodeWindowSchema = {
  parse(value) {
    if (value === null || value === undefined) return null;
    if (typeof value !== "object") throw new TypeError("expected an opencode window snapshot object");
    return {
      percent: typeof value.percent === "number" ? value.percent : null,
      resetsAt: typeof value.resetsAt === "string" ? value.resetsAt : null
    };
  }
};

const suanpanSnapshotSchema = {
  parse(value) {
    if (!value || typeof value !== "object") {
      throw new TypeError("expected a suanpan snapshot object");
    }
    const models = value.minimax && Array.isArray(value.minimax.models)
      ? value.minimax.models.map((entry) => miniMaxModelSchema.parse(entry))
      : [];
    const minimaxStatus = value.minimax && value.minimax.status && typeof value.minimax.status === "object"
      ? {
          code: typeof value.minimax.status.code === "number" ? value.minimax.status.code : null,
          msg: typeof value.minimax.status.msg === "string" ? value.minimax.status.msg : null
        }
      : { code: null, msg: null };
    return {
      deepseek: balanceSnapshotSchema.parse(value.deepseek),
      minimax: { models, status: minimaxStatus },
      opencode: {
        rolling: openCodeWindowSchema.parse(value.opencode && value.opencode.rolling),
        weekly: openCodeWindowSchema.parse(value.opencode && value.opencode.weekly),
        monthly: openCodeWindowSchema.parse(value.opencode && value.opencode.monthly)
      }
    };
  }
};

export const TYPERT_REMOTE = {
  package: "dsh-suanpan",
  descriptors: [
    {
      id: "dsh-suanpan#suanpan/snapshot",
      service: "suanpan",
      namespace: "suanpan",
      method: "snapshot",
      invocation: { kind: "direct" },
      parameters: [],
      result: {
        mode: "strict",
        typeSymbol: "dsh-suanpan/types#SuanpanSnapshot",
        schema: suanpanSnapshotSchema
      },
      sourceLocation: { file: "lib/index.js", line: 1, column: 1 }
    }
  ]
};

export default TYPERT_REMOTE;
