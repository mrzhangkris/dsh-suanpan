#!/usr/bin/env bash
# dsh-suanpan 一键安装脚本（macOS/Linux）
# 用法：bash install.sh [--profile web]
#
# 步骤：
#   1. 在目标 profile 安装本插件依赖（npm 或 pnpm 均可）
#   2. 把 "dsh-suanpan" 加入 package.json 的 dsh.profile.bundles
#   3. 提示重启 dsh web 并硬刷新浏览器
set -euo pipefail

PROFILE="${1:-web}"
DSH_HOME="${DSH_HOME:-$HOME/.dsh}"
PROFILE_DIR="$DSH_HOME/profiles/$PROFILE"
PKG="dsh-suanpan"

if [ ! -d "$PROFILE_DIR" ]; then
  echo "❌ profile 目录不存在：$PROFILE_DIR"
  echo "   请先确认 dsh web profile 已创建（dsh --profile $PROFILE boot）"
  exit 1
fi

echo "📦 在 profile [$PROFILE] 安装 $PKG ..."
cd "$PROFILE_DIR"

if command -v pnpm >/dev/null 2>&1; then
  pnpm add "$PKG" --save
else
  npm install "$PKG" --save
fi

# 确保 bundles 列表含本插件
if ! grep -q '"dsh-suanpan"' package.json; then
  echo "⚠️  package.json 的 dsh.profile.bundles 未包含 dsh-suanpan，请手动添加："
  echo '   "dsh-suanpan",'
fi

echo ""
echo "✅ 安装完成。下一步："
echo "   1. 确认 package.json 的 dsh.profile.bundles 含 \"dsh-suanpan\"（自动安装包不会自动加，需手动）"
echo "   2. 重启 dsh web：launchctl kickstart -k gui/\$(id -u)/com.deepseek.dsh-web  （macOS launchd）"
echo "      或重启 DeepSeek Harness 应用"
echo "   3. 浏览器硬刷新（Cmd+Shift+R），左下角出现悬浮窗即成功"
echo ""
echo "   验证：/usage 命令 / composer 读条（选中 DeepSeek/MiniMax/OpenCode 模型时）"
