/* Host-face Typert manifest for dsh-suanpan（手写，无构建步骤）。 */
import z from "zod";

const balancePricingSchema = z.object({
  isPeak: z.boolean(),
  label: z.string()
});

const balanceSnapshotSchema = z.object({
  isAvailable: z.boolean().nullable(),
  currency: z.string().nullable(),
  total: z.number().nullable(),
  granted: z.number().nullable(),
  toppedUp: z.number().nullable(),
  pricing: balancePricingSchema
});

const miniMaxWindowSchema = z.object({
  percent: z.number().nullable(),
  remaining_percent: z.number().nullable(),
  total_count: z.number().nullable(),
  usage_count: z.number().nullable(),
  status: z.number().nullable(),
  start_time: z.number().nullable(),
  reset_at: z.string().nullable(),
  remains_ms: z.number().nullable()
}).nullable();

const miniMaxModelSchema = z.object({
  name: z.string(),
  rolling: miniMaxWindowSchema,
  weekly: miniMaxWindowSchema,
  monthly: miniMaxWindowSchema
});

const miniMaxSnapshotSchema = z.object({
  models: z.array(miniMaxModelSchema),
  status: z.object({
    code: z.number().nullable(),
    msg: z.string().nullable()
  })
});

const openCodeWindowSchema = z.object({
  percent: z.number().nullable(),
  resetsAt: z.string().nullable()
}).nullable();

const openCodeSnapshotSchema = z.object({
  rolling: openCodeWindowSchema,
  weekly: openCodeWindowSchema,
  monthly: openCodeWindowSchema
});

const suanpanSnapshotSchema = z.object({
  deepseek: balanceSnapshotSchema,
  minimax: miniMaxSnapshotSchema,
  opencode: openCodeSnapshotSchema
});

export const TYPERT = {
  package: "dsh-suanpan",
  face: "host",
  schemas: [],
  invocations: [
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
  ],
  model: {
    services: [],
    events: [],
    objects: []
  }
};

export default TYPERT;
