/**
 * dsh-suanpan（算盘）— browser half。
 *
 * 两个 UI 表达，共用 host 端 `suanpan/snapshot` 归一化快照：
 *   1. composer 右下角读条（conversation.input.right）：
 *      按当前会话选中的 provider 自动切换显示对应通道——
 *      deepseek-official → 余额+峰谷 / minimax-cn → Coding Plan 配额 /
 *      opencode-go → Zen Go 配额；其他 provider 不渲染。
 *   2. 悬浮窗（sidebar.footer.action）：左下角 dock 一行三家汇总，
 *      点击展开详情面板（余额明细 / MiniMax 窗口 / OpenCode 窗口），
 *      每 5 分钟自动刷新，含手动刷新。
 *
 * 借鉴：dsh-usage（Aisland-SJL, MIT）的 dock/panel 结构与 dsh-ui 令牌；
 *       dsh-usage-minimax-cn（jooey, MIT）的 composer 读条与 Typert 挂载。
 * 手写 __ModuleLoader__ bundle（无构建步骤）。
 */
window.__ModuleLoader__.load({
	id: "dsh-suanpan",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });

		let React = require("react");

		const NS = "dsh-suanpan";

		//#region Typert remote manifest（内联，与 lib/typert.remote-client.js 同构）
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
				if (value && typeof value === "object" && typeof value.error === "string") {
					return { error: value.error };
				}
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
				if (!value || typeof value !== "object") throw new TypeError("expected a suanpan snapshot object");
				// 每家独立解析；{ error } 形状原样透传，UI 端单家显示 n/a。
				let deepseek = null;
				if (value.deepseek && typeof value.deepseek === "object") {
					deepseek = balanceSnapshotSchema.parse(value.deepseek);
				}
				let minimax = null;
				if (value.minimax && typeof value.minimax === "object") {
					if (typeof value.minimax.error === "string") {
						minimax = { error: value.minimax.error };
					} else {
						const models = Array.isArray(value.minimax.models)
							? value.minimax.models.map((entry) => miniMaxModelSchema.parse(entry))
							: [];
						const minimaxStatus = value.minimax.status && typeof value.minimax.status === "object"
							? {
									code: typeof value.minimax.status.code === "number" ? value.minimax.status.code : null,
									msg: typeof value.minimax.status.msg === "string" ? value.minimax.status.msg : null
								}
							: { code: null, msg: null };
						minimax = { models, status: minimaxStatus };
					}
				}
				let opencode = null;
				if (value.opencode && typeof value.opencode === "object") {
					if (typeof value.opencode.error === "string") {
						opencode = { error: value.opencode.error };
					} else {
						opencode = {
							rolling: openCodeWindowSchema.parse(value.opencode.rolling),
							weekly: openCodeWindowSchema.parse(value.opencode.weekly),
							monthly: openCodeWindowSchema.parse(value.opencode.monthly)
						};
					}
				}
				return { deepseek, minimax, opencode };
			}
		};
		const TYPERT_REMOTE = {
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
		//#endregion

		// Provider id（settings.yaml 实际注册值）→ 显示名
		const PROVIDER_IDS = {
			deepseek: "deepseek-official",
			minimax: "minimax-cn",
			opencode: "opencode-go"
		};

		//#region css
		const css = [
			// floating dock（左下角常驻一行，高于侧边栏设置）
			".sp_dock{position:fixed;left:14px;bottom:72px;z-index:30;display:flex;flex-direction:column;gap:6px;align-items:flex-start}",
			".sp_dockFrame{position:relative;box-sizing:border-box;width:100%;min-width:192px;max-width:272px;padding:8px 14px;border-radius:12px;border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-base);box-shadow:var(--dsw-shadow-lv2);display:flex;flex-direction:column}",
			".sp_dockRow{display:flex;align-items:center;gap:8px;padding:4px 0;border:none;background:0 0;cursor:pointer;font:inherit;text-align:left;color:inherit;width:100%}",
			".sp_dockRow:hover .sp_dockValue{color:var(--dsw-alias-label-primary)}",
			".sp_dockLabel{flex:none;color:var(--dsw-alias-label-secondary);font-size:12px;line-height:18px}",
			".sp_dockValue{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--dsw-alias-label-primary);font-size:13px;font-weight:600;line-height:18px;font-variant-numeric:tabular-nums;margin-left:auto;transition:color .15s ease}",
			".sp_dockValue[data-tone=ok]{color:var(--dsw-alias-state-success-primary)}",
			".sp_dockValue[data-tone=warn]{color:var(--dsw-alias-state-warning-primary,#d29922)}",
			".sp_dockValue[data-tone=bad]{color:var(--dsw-alias-state-error-primary)}",
			".sp_dockRefresh{position:absolute;top:8px;right:8px;display:flex;align-items:center;justify-content:center;width:20px;height:20px;border-radius:50%;border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-tertiary);cursor:pointer;padding:0}",
			".sp_dockRefresh:hover{color:#1f6feb}",
			// detail panel
			".sp_panel{z-index:40;box-sizing:border-box;border:1px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-base);width:420px;max-width:calc(100vw - 24px);max-height:78vh;box-shadow:var(--dsw-shadow-lv2);border-radius:12px;flex-direction:column;display:flex;position:fixed;bottom:12px;left:12px;overflow:hidden}",
			".sp_panelHead{display:flex;align-items:center;gap:8px;padding:12px 14px;border-bottom:1px solid var(--dsw-alias-border-l1)}",
			".sp_panelTitle{flex:1;font-size:14px;font-weight:600;color:var(--dsw-alias-label-primary)}",
			".sp_panelClose{cursor:pointer;width:26px;height:26px;color:var(--dsw-alias-label-tertiary);background:0 0;border:none;border-radius:6px;display:inline-flex;align-items:center;justify-content:center;padding:0}",
			".sp_panelClose:hover{color:var(--dsw-alias-label-primary);background:var(--dsw-alias-interactive-bg-hover)}",
			".sp_panelBody{padding:12px 14px;overflow-y:auto;display:flex;flex-direction:column;gap:14px}",
			".sp_section{display:flex;flex-direction:column;gap:6px}",
			".sp_sectionTitle{font-size:12px;font-weight:600;color:var(--dsw-alias-label-secondary)}",
			".sp_line{display:flex;align-items:center;gap:8px;font-size:13px;line-height:20px;color:var(--dsw-alias-label-primary)}",
			".sp_lineLabel{color:var(--dsw-alias-label-secondary);flex:none}",
			".sp_lineValue{font-weight:600;font-variant-numeric:tabular-nums}",
			".sp_bar{height:4px;border-radius:2px;background:var(--dsw-alias-interactive-bg-hover);overflow:hidden}",
			".sp_barFill{height:100%;border-radius:2px;background:#1f6feb}",
			".sp_barFill[data-tone=warn]{background:var(--dsw-alias-state-warning-primary,#d29922)}",
			".sp_barFill[data-tone=bad]{background:var(--dsw-alias-state-error-primary)}",
			".sp_err{font-size:12px;color:var(--dsw-alias-state-error-primary)}",
			".sp_note{font-size:11px;color:var(--dsw-alias-label-tertiary)}",
			// composer chip
			".sp_chip{display:inline-flex;align-items:center;gap:6px;height:100%;font-size:12px;font-weight:500;line-height:1;color:var(--dsw-alias-label-tertiary);text-decoration:none;cursor:pointer;white-space:nowrap;min-width:0;overflow:hidden}",
			".sp_chip:hover{color:var(--dsw-alias-label-primary)}"
		].join("");
		//#endregion

		//#region format helpers
		function formatPercent(value) {
			const n = Number(value);
			if (!Number.isFinite(n)) return "n/a";
			return n.toFixed(1) + "%";
		}

		function formatRemainsShort(ms) {
			const total = Number(ms);
			if (!Number.isFinite(total) || total <= 0) return null;
			const totalSec = Math.floor(total / 1000);
			const days = Math.floor(totalSec / 86400);
			const hours = Math.floor((totalSec % 86400) / 3600);
			const minutes = Math.floor((totalSec % 3600) / 60);
			const parts = [];
			if (days > 0) parts.push(days + "d");
			if (hours > 0 || days > 0) parts.push(hours + "h");
			parts.push(minutes + "m");
			return parts.join(" ");
		}

		function formatBalance(value) {
			if (value === null || value === undefined) return "n/a";
			const currency = value.currency === "USD" ? "$" : "¥";
			return currency + Number(value).toFixed(2);
		}

		function formatDate(iso) {
			if (!iso) return null;
			try {
				const d = new Date(iso);
				return d.toLocaleString(undefined, { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" });
			} catch {
				return iso;
			}
		}
		//#endregion

		//#region shared hook: load snapshot
		/**
		 * 每 60s 拉一次三家快照（Typert remote）。失败保持旧值并标记 failed。
		 */
		function useSnapshot(loadSnapshot) {
			const [data, setData] = React.useState(null);
			const [failed, setFailed] = React.useState(false);
			React.useEffect(() => {
				let alive = true;
				const load = async () => {
					try {
						const result = await loadSnapshot();
						if (!alive) return;
						if (result && result.ok) {
							setData(result.value);
							setFailed(false);
						} else {
							setData(null);
							setFailed(true);
						}
					} catch {
						if (alive) {
							setData(null);
							setFailed(true);
						}
					}
				};
				load();
				const timer = setInterval(load, 60000);
				return () => {
					alive = false;
					clearInterval(timer);
				};
			}, [loadSnapshot]);
			return { data, failed };
		}
		//#endregion

		//#region composer chip（按当前 provider 切换显示）
		function SuanpanChip(props) {
			const directory = props.directory;
			const snapshot = props.snapshot;

			const state = React.useSyncExternalStore(
				(fn) => directory.subscribe(fn),
				() => directory.getSnapshot()
			);
			const currentProvider = !!(state && state.current) ? state.current.provider : null;
			// 仅在命中三家时渲染；其余 provider 隐藏读条。
			const isRelevant = currentProvider === PROVIDER_IDS.deepseek
				|| currentProvider === PROVIDER_IDS.minimax
				|| currentProvider === PROVIDER_IDS.opencode;

			const { data, failed } = useSnapshot(snapshot);

			if (!isRelevant) return null;

			let text = null;
			let href = null;
			if (currentProvider === PROVIDER_IDS.deepseek) {
				const bal = data && data.deepseek;
				if (bal && typeof bal.total === "number") {
					text = "DeepSeek " + formatBalance(bal.total) + (bal.pricing && bal.pricing.isPeak ? " · 峰价" : "");
				} else if (bal && typeof bal.error === "string") {
					text = "DeepSeek n/a";
				}
				href = "https://platform.deepseek.com/usage";
			} else if (currentProvider === PROVIDER_IDS.minimax) {
				const mm = data && data.minimax;
				const models = mm && Array.isArray(mm.models) ? mm.models : [];
				// 取最受限（剩余 % 最小）的模型窗口作摘要
				let best = null;
				for (const model of models) {
					const win = model.rolling || model.weekly || model.monthly;
					if (!win || win.remaining_percent === null) continue;
					const label = model.name === "general" ? "coding" : model.name;
					if (!best || win.remaining_percent < best.remaining_percent) {
						best = { label, win };
					}
				}
				if (best) {
					const used = 100 - best.win.remaining_percent;
					const tail = best.win.remains_ms !== null ? formatRemainsShort(best.win.remains_ms) : null;
					text = "MiniMax " + best.label + " " + formatPercent(used) + (tail ? " (" + tail + ")" : "");
				} else if (mm && typeof mm.error === "string") {
					text = "MiniMax n/a";
				}
				href = "https://platform.minimaxi.com/user-center/payment/coding-plan";
			} else if (currentProvider === PROVIDER_IDS.opencode) {
				const oc = data && data.opencode;
				const win = oc && (oc.rolling || oc.weekly || oc.monthly);
				if (win && win.percent !== null) {
					text = "OpenCode " + formatPercent(win.percent);
				} else if (oc && typeof oc.error === "string") {
					text = "OpenCode n/a";
				}
				href = "https://opencode.ai/go";
			}

			if (text === null) {
				text = "算盘 loading…";
			}

			return React.createElement(
				"a",
				{
					href,
					target: "_blank",
					rel: "noreferrer noopener",
					title: "dsh-suanpan：DeepSeek 余额 / MiniMax Coding Plan / OpenCode Go 配额",
					style: { display: "inline-flex", alignItems: "center", gap: "6px", height: "100%", fontSize: "12px", fontWeight: 500, lineHeight: 1, color: "var(--dsw-alias-label-tertiary)", textDecoration: "none", cursor: "pointer", whiteSpace: "nowrap", minWidth: "0", overflow: "hidden" }
				},
				React.createElement("span", { style: { opacity: 0.7 } }, "🫘"),
				React.createElement("span", { key: "text" }, text)
			);
		}
		//#endregion

		//#region floating dock + detail panel
		/** 悬浮窗主体：dock 一行三家汇总，点击展开面板。 */
		function SuanpanWidget(props) {
			const { data, failed } = useSnapshot(props.snapshot);
			const [open, setOpen] = React.useState(false);

			// 汇总行（dock）——每家独立判断：该家 error 才显示 n/a
			const rows = [];
			const bal = data && data.deepseek;
			if (bal && typeof bal.total === "number") {
				rows.push({ key: "ds", label: "DeepSeek", value: formatBalance(bal.total), tone: bal.isAvailable === false ? "bad" : (bal.pricing && bal.pricing.isPeak ? "warn" : "ok") });
			} else if (bal && typeof bal.error === "string") {
				rows.push({ key: "ds", label: "DeepSeek", value: "n/a", tone: "bad" });
			}
			const mm = data && data.minimax;
			if (mm && Array.isArray(mm.models) && mm.models.length > 0) {
				let min = null;
				for (const model of mm.models) {
					const win = model.rolling || model.weekly || model.monthly;
					if (!win || win.remaining_percent === null) continue;
					const used = 100 - win.remaining_percent;
					if (min === null || used > min.used) min = { used, label: model.name === "general" ? "coding" : model.name };
				}
				if (min) {
					rows.push({ key: "mm", label: "MiniMax", value: "coding " + formatPercent(min.used), tone: min.used >= 100 ? "bad" : (min.used >= 80 ? "warn" : "ok") });
				}
			} else if (mm && typeof mm.error === "string") {
				rows.push({ key: "mm", label: "MiniMax", value: "n/a", tone: "bad" });
			}
			const oc = data && data.opencode;
			if (oc && (oc.rolling || oc.weekly || oc.monthly)) {
				const win = oc.rolling || oc.weekly || oc.monthly;
				if (win && win.percent !== null) {
					rows.push({ key: "oc", label: "OpenCode", value: formatPercent(win.percent), tone: win.percent >= 100 ? "bad" : (win.percent >= 80 ? "warn" : "ok") });
				}
			} else if (oc && typeof oc.error === "string") {
				rows.push({ key: "oc", label: "OpenCode", value: "n/a", tone: "bad" });
			}
			if (rows.length === 0) {
				rows.push({ key: "none", label: "算盘", value: "loading…", tone: "ok" });
			}

			// 详情面板
			let panel = null;
			if (open) {
				const sections = [];
				// DeepSeek 余额
				if (bal) {
					sections.push(React.createElement("div", { key: "ds", className: "sp_section" },
						React.createElement("div", { className: "sp_sectionTitle" }, "DeepSeek 余额"),
						React.createElement("div", { className: "sp_line" },
							React.createElement("span", { className: "sp_lineLabel" }, "可用"),
							React.createElement("span", { className: "sp_lineValue" }, formatBalance(bal.total))),
						typeof bal.granted === "number" && React.createElement("div", { className: "sp_line" },
							React.createElement("span", { className: "sp_lineLabel" }, "赠送"),
							React.createElement("span", { className: "sp_lineValue" }, formatBalance(bal.granted))),
						typeof bal.toppedUp === "number" && React.createElement("div", { className: "sp_line" },
							React.createElement("span", { className: "sp_lineLabel" }, "充值"),
							React.createElement("span", { className: "sp_lineValue" }, formatBalance(bal.toppedUp))),
						bal.pricing && React.createElement("div", { className: "sp_line" },
							React.createElement("span", { className: "sp_lineLabel" }, "时段"),
							React.createElement("span", { className: "sp_lineValue", style: { fontSize: "12px", fontWeight: 400 } }, bal.pricing.label))
					));
				}
				// MiniMax 窗口
				if (mm && Array.isArray(mm.models)) {
					const mmLines = [];
					for (const model of mm.models) {
						const label = model.name === "general" ? "coding" : model.name;
						for (const winKey of ["rolling", "weekly", "monthly"]) {
							const win = model[winKey];
							if (!win || win.percent === null) continue;
							const used = win.percent;
							const tail = win.remains_ms !== null ? " · " + formatRemainsShort(win.remains_ms) + " 后重置" : "";
							const pctLabel = winKey === "rolling" ? "Rolling" : winKey === "weekly" ? "Weekly" : "Monthly";
							const tone = used >= 100 ? "bad" : (used >= 80 ? "warn" : "ok");
							mmLines.push(React.createElement("div", { key: label + winKey, className: "sp_line" },
								React.createElement("span", { className: "sp_lineLabel" }, label + " " + pctLabel),
								React.createElement("span", { className: "sp_lineValue", "data-tone": tone }, formatPercent(used) + tail)));
						}
					}
					if (mmLines.length > 0) {
						sections.push(React.createElement("div", { key: "mm", className: "sp_section" },
							React.createElement("div", { className: "sp_sectionTitle" }, "MiniMax Coding Plan"),
							...mmLines));
					}
				}
				// OpenCode 窗口
				if (oc) {
					const ocLines = [];
					const winTitles = { rolling: "Rolling (3d)", weekly: "Weekly", monthly: "Monthly" };
					for (const [winKey, win] of Object.entries(oc)) {
						if (!win || win.percent === null) continue;
						const tone = win.percent >= 100 ? "bad" : (win.percent >= 80 ? "warn" : "ok");
						const reset = win.resetsAt ? " · " + formatDate(win.resetsAt) + " 重置" : "";
						ocLines.push(React.createElement("div", { key: winKey, className: "sp_line" },
							React.createElement("span", { className: "sp_lineLabel" }, winTitles[winKey] ?? winKey),
							React.createElement("span", { className: "sp_lineValue", "data-tone": tone }, formatPercent(win.percent) + reset)));
					}
					if (ocLines.length > 0) {
						sections.push(React.createElement("div", { key: "oc", className: "sp_section" },
							React.createElement("div", { className: "sp_sectionTitle" }, "OpenCode Go"),
							...ocLines));
					}
				}
				if (sections.length === 0) {
					const anyError = (data && (typeof data.deepseek?.error === "string" || typeof data.minimax?.error === "string" || typeof data.opencode?.error === "string"));
					sections.push(React.createElement("div", { key: "err", className: "sp_err" },
						failed ? "用量数据不可用（请检查凭据配置）" : (anyError ? "各通道暂无可显示数据" : "加载中…")));
				}
				panel = React.createElement("div", { className: "sp_panel" },
					React.createElement("div", { className: "sp_panelHead" },
						React.createElement("span", { className: "sp_panelTitle" }, "算盘 · 用量"),
						React.createElement("button", { className: "sp_panelClose", onClick: () => setOpen(false), "aria-label": "关闭" },
							React.createElement("span", null, "✕"))),
					React.createElement("div", { className: "sp_panelBody" }, ...sections));
			}

			return React.createElement(React.Fragment, null,
				React.createElement("div", { className: "sp_dock" },
					React.createElement("div", { className: "sp_dockFrame" },
						rows.map((row) => React.createElement("button", {
							key: row.key,
							className: "sp_dockRow",
							onClick: () => setOpen((v) => !v),
							title: "点击展开详情"
						},
							React.createElement("span", { className: "sp_dockLabel" }, row.label),
							React.createElement("span", { className: "sp_dockValue", "data-tone": row.tone }, row.value)))),
					React.createElement("style", null, css)
				),
				panel);
		}
		//#endregion

		//#region plugin body
		const inject = ["slots", "remote", "modelDirectories"];

		async function apply(ctx) {
			await ctx.remote.$mount(TYPERT_REMOTE);
			// ctx.get() 读取挂载后的 namespace 服务，避免自挂载插件的 inject 死锁。
			const suanpan = ctx.get("remote.suanpan");

			// 1) composer 读条
			ctx.slots.inject("conversation.input.right", () => ctx.slots.register({
				name: "conversation.input.right",
				id: "suanpan-usage",
				order: 0,
				inject: (sessionId) => {
					let directory = null;
					try {
						directory = ctx.modelDirectories.directoryFor(sessionId).store;
					} catch {
						directory = null;
					}
					return {
						directory,
						snapshot: () => suanpan.snapshot()
					};
				}
			}, SuanpanChip));

			// 2) 悬浮窗（侧边栏底部入口）
			ctx.slots.inject("sidebar.footer.action", () => ctx.slots.register({
				name: "sidebar.footer.action",
				id: "suanpan",
				order: 10,
				inject: () => ({
					snapshot: () => suanpan.snapshot()
				})
			}, SuanpanWidget));
		}

		exports.apply = apply;
		exports.inject = inject;
		exports.SuanpanChip = SuanpanChip;
		exports.SuanpanWidget = SuanpanWidget;
		exports.formatPercent = formatPercent;
		exports.formatBalance = formatBalance;
		exports.formatRemainsShort = formatRemainsShort;
		return module.exports;
	}
});
