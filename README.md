# 🫘 dsh-suanpan（算盘）

[![npm version](https://img.shields.io/npm/v/dsh-suanpan?style=flat-square)](https://www.npmjs.com/package/dsh-suanpan)
[![license](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![dsh](https://img.shields.io/badge/DeepSeek%20Harness-dsh--plugin-4176E6)](https://github.com/deepseek-ai/deepseek-harness)

**三合一用量监控插件**：一个插件同时监控 DeepSeek 余额、MiniMax Coding Plan 配额、OpenCode Go 订阅配额，以 **/usage 命令 + composer 读条 + 悬浮窗面板**三种形态呈现。

**Unified usage monitor for dsh web**: DeepSeek balance · MiniMax Coding Plan quota · OpenCode Go subscription quota, in one plugin — `/usage` command, composer readout and a floating panel.

---

**中文** · [English](#english)

## ✨ 功能一览

| 能力 | 说明 |
| --- | --- |
| 💳 **DeepSeek 余额** | 官方 `/user/balance` 端点：可用/赠送/充值明细 + 峰谷计价时段（北京时间工作日 09:00-12:00 / 14:00-18:00 峰价，周末全天谷价） |
| 📊 **MiniMax Coding Plan** | 官方 `/v1/coding_plan/remains` 端点：每个模型的 Rolling / Weekly / Monthly 窗口配额、已用百分比、剩余倒计时 |
| 🎯 **OpenCode Go** | 官方 `/zen/go/v1/usage` 端点：Rolling (3d) / Weekly / Monthly 窗口已用百分比与重置时间 |
| ⌨️ **`/usage` 命令** | `/usage [deepseek\|minimax\|opencode] [rolling\|weekly\|monthly] [--json]`，支持别名（ds/mm/ocg），未指定 provider 时输出全部三家 |
| 🧲 **Composer 读条** | 输入框右下角常驻读条，**按当前选中模型自动切换**对应通道；其他 provider 自动隐藏；每 60s 刷新 |
| 🖥️ **悬浮窗面板** | 侧边栏底部入口，左下角 dock 一行三家汇总（颜色区分健康度），点击展开详情面板，每 5 分钟自动刷新 |
| 🔒 **密钥安全** | 三家 API key 全部经 DSH 凭据 seam 在 host 端解析，**绝不进入浏览器**；key 名别名回退兼容不同环境 |

## 🔑 凭据配置（三选一，全配全显）

写入 `~/.dsh/.credentials.yaml`：

```yaml
DEEPSEEK_API_KEY: sk-...        # DeepSeek（兼容别名：无）
MINIMAX_API_KEY: sk-cp-...      # MiniMax（兼容别名：MINIMAX_CN_API_KEY）
OPENCODE_API_KEY: sk-...        # OpenCode Go（兼容别名：OPENCODE_GO_API_KEY）
```

也可设环境变量。缺哪个 key，对应通道在 UI 中显示 n/a，其余通道不受影响。

## 📦 安装

```bash
# 1. 进 web profile
cd ~/.dsh/profiles/web

# 2. 装依赖（npm 或 pnpm 均可）
npm install dsh-suanpan --save
# 或 pnpm add dsh-suanpan

# 3. 在 package.json 的 dsh.profile.bundles 中加入 "dsh-suanpan"
# 4. 在 cordis.patch.yml 追加：
# - insert:
#     - id: suanpan
#       name: 'dsh-suanpan'

# 5. 重启 dsh web 并硬刷新浏览器
```

> 本插件已声明 `cordis.patch.yml` bundle patch，若通过 `dsh plugin add` 安装会自动合入。

## 🧮 使用

- 输入 `/usage` 查看三家汇总报告
- 输入 `/usage minimax weekly --json` 查看 MiniMax Weekly 窗口原始 JSON
- 选中 DeepSeek/MiniMax/OpenCode 模型时，输入框右下角出现对应读条
- 点击侧边栏底部算盘图标展开悬浮窗面板

## 🧩 实现说明

- **借鉴**：`dsh-usage`（Aisland-SJL, MIT）的 dock/panel 悬浮窗结构；`dsh-usage-minimax-cn` / `dsh-usage-opencode-go` / `dsh-usage-deepseek`（jooey, MIT）的端点语义与 Typert 分层。三者均为 MIT，本插件按 MIT 保留署名并重写实现。
- **架构**：host 端三家查询器（`lib/logic/`，纯 fetch、零依赖、可单测）→ Typert 远程服务 `suanpan/snapshot` → 浏览器端读条与悬浮窗共用一份归一化快照。
- **测试**：`node --test test/` 覆盖归一化、key 别名回退、命令参数解析（12 用例）。

## 🗂️ 结构

```
lib/
├── index.js                # host 入口：/usage 命令 + Typert 网关
├── client.js               # 浏览器端：读条 + 悬浮窗
├── typert.host.js          # host Typert 清单
├── typert.remote-client.js # client Typert 清单
└── logic/
    ├── deepseek.js         # DeepSeek 余额 + 峰谷时段
    ├── minimax.js          # MiniMax Coding Plan 配额
    └── opencode.js         # OpenCode Go 配额
test/logic.test.js          # 冒烟测试
```

## 📄 License

MIT © mrzhangkris

---

## English

A unified usage monitor for the DeepSeek Harness web GUI, covering **DeepSeek balance**, **MiniMax Coding Plan quota** and **OpenCode Go subscription quota** in one plugin.

### Features

| Capability | Description |
| --- | --- |
| 💳 DeepSeek balance | Official `/user/balance`: available/granted/topped-up breakdown + peak/off-peak pricing window (Beijing weekdays 09:00-12:00 / 14:00-18:00 peak; weekends all-day off-peak) |
| 📊 MiniMax Coding Plan | Official `/v1/coding_plan/remains`: per-model Rolling/Weekly/Monthly quota, used %, countdown to reset |
| 🎯 OpenCode Go | Official `/zen/go/v1/usage`: Rolling (3d)/Weekly/Monthly used % and reset time |
| ⌨️ `/usage` command | `/usage [deepseek\|minimax\|opencode] [rolling\|weekly\|monthly] [--json]`, aliases ds/mm/ocg, all providers when omitted |
| 🧲 Composer readout | Bottom-right chip that **auto-switches by the currently selected model's provider**; hides for other providers; refreshes every 60s |
| 🖥️ Floating panel | Sidebar footer entry; bottom-left dock with one-line summary per provider (color-coded), click to expand details; refreshes every 5 min |
| 🔒 Key safety | All three API keys resolved on the host through the DSH credentials seam — never sent to the browser; alias fallback for key names |

### Credentials

In `~/.dsh/.credentials.yaml` (or env vars):

```yaml
DEEPSEEK_API_KEY: sk-...     # alias fallback: none
MINIMAX_API_KEY: sk-cp-...   # alias fallback: MINIMAX_CN_API_KEY
OPENCODE_API_KEY: sk-...     # alias fallback: OPENCODE_GO_API_KEY
```

Missing keys degrade gracefully: the corresponding channel shows `n/a`, others keep working.

### Install

```bash
cd ~/.dsh/profiles/web
npm install dsh-suanpan --save
# add "dsh-suanpan" to dsh.profile.bundles in package.json
# append to cordis.patch.yml:
# - insert:
#     - id: suanpan
#       name: 'dsh-suanpan'
# restart dsh web and hard-refresh
```

### Usage

- `/usage` — all three providers
- `/usage minimax weekly --json` — raw JSON for the MiniMax weekly window
- Select a DeepSeek/MiniMax/OpenCode model to see the composer readout
- Click the abacus icon at the sidebar footer to open the floating panel

### Credits & License

Inspired by `dsh-usage` (Aisland-SJL, MIT) for the dock/panel UI and the `dsh-usage-*` series (jooey, MIT) for endpoint semantics and the Typert layering — reimplemented here, all MIT-licensed.

MIT © mrzhangkris
