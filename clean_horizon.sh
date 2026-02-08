#!/bin/bash

# ==========================================
# Redis 特定 Key 清理脚本 (v2.1)
# 作用: 仅删除包含 'horizon' 的 Key
# ==========================================

# Redis 配置
REDIS_HOST="127.0.0.1"
REDIS_PORT="6379"
PATTERN="*horizon*"

echo "------------------------------------------"
echo "� Redis 局部清理工具 (版本: v2.1)"
echo "🔍 目标模式: $PATTERN"
echo "------------------------------------------"

# 检查 redis-cli 是否可用
if ! command -v redis-cli &> /dev/null; then
    echo "❌ 错误: 未找到 redis-cli 工具，请确保已安装 Redis 客户端。"
    exit 1
fi

# 获取匹配的 Key 列表
echo "正在扫描 Redis..."
KEYS_LIST=$(redis-cli -h $REDIS_HOST -p $REDIS_PORT KEYS "$PATTERN")

# 统计数量
# sed 用于去除空行
COUNT=$(echo "$KEYS_LIST" | sed '/^\s*$/d' | wc -l)

if [ "$COUNT" -gt 0 ] && [ ! -z "$KEYS_LIST" ]; then
    echo "✅ 发现匹配 Key 总数: $COUNT"
    echo "Key 示例 (前 5 个):"
    echo "------------------------------------------"
    echo "$KEYS_LIST" | head -n 5
    echo "------------------------------------------"
    
    echo "⚠️ 正在删除上述 $COUNT 个 Key..."
    # 使用 xargs 传递给 DEL。注意：如果 Key 很多，这里建议分批。
    echo "$KEYS_LIST" | xargs redis-cli -h $REDIS_HOST -p $REDIS_PORT DEL
    
    if [ $? -eq 0 ]; then
        echo "✨ 成功: 清理完成。"
    else
        echo "❌ 失败: 删除过程中出现异常。"
    fi
else
    echo "ℹ️ 未发现匹配 '$PATTERN' 的数据，无需清理。"
fi

echo "------------------------------------------"
echo "完成时间: $(date '+%Y-%m-%d %H:%M:%S')"
