# 联网数据源指南（北京时间 + 中文源）

Skill 执行步骤 1 时必读。所有时间最终写入 `datetime_cst`（`+08:00`）。

---

## 1. 搜索词模板

将 `[M月D日]` 替换为窗口内实际日期（今天/明天）：

```
2026世界杯 [M月D日] 赛程 北京时间
2026世界杯 [M月D日] 比分 赛果
2026世界杯 [X]组 积分榜 最新
2026世界杯 [主队] vs [客队] 比分 网易
2026世界杯 射手榜 进球榜 2026
2026世界杯 [球员名] 进球 金靴
2026世界杯 [X]组 出线形势 分析
2026世界杯 [球队] 伤病 停赛 大名单
```

交叉验证（可选）：
```
2026 FIFA World Cup Group [X] standings June [day]
site:fifa.com 2026 world cup [team]
```

---

## 2. 推荐数据源（优先级）

| 优先级 | 来源 | 用途 |
|--------|------|------|
| 1 | 网易体育 (163.com) | 赛果快讯、射手榜、战报 |
| 2 | 虎扑 (hupu.com) | 出线形势、球迷分析 |
| 3 | 懂球帝 | 战术/伤病/首发 |
| 4 | worldcup2026cn.com | **北京时间**完整赛程表 |
| 5 | 新浪体育 / 腾讯体育 | 补充比分 |
| 6 | FIFA 官网 / Wikipedia | 赛制、规则交叉验证 |

**禁止**仅依赖单一英文源而不做北京时间转换。

---

## 3. 时间转换规则

1. 中文源若已标注「北京时间 HH:MM」→ 直接写入 `datetime_cst`
2. 英文源标注 ET/PT/UTC → 换算为 CST（UTC+8）：

| 原时区 | 北京时间 |
|--------|----------|
| ET (UTC-4 夏令时) | +12 小时 |
| PT (UTC-7 夏令时) | +15 小时 |
| UTC | +8 小时 |

3. `datetime_cst` 格式：`2026-06-24T02:00:00+08:00`
4. 保留原始 `datetime`（当地 ISO8601）供对照
5. **预测窗口按 `datetime_cst` 的日期部分** `[from, to]` 筛选

---

## 4. 必拉字段清单

### schedule.json（每场）

| 字段 | 来源 |
|------|------|
| home, away, group, round, venue | 赛程表 |
| datetime_cst | 北京时间开球 |
| actual_score | 已结束场次 |
| status | `scheduled` / `live` / `finished` |

### standings.json（每组每队）

| 字段 | 计算/来源 |
|------|-----------|
| played, won, drawn, lost, gf, ga, gd, points, rank | 积分榜 |
| scenario | `must_win` / `draw_enough` / `qualified` / `eliminated` |
| scenario_code | 对应 game-theory.md 情景 |

### players.json

| 字段 | 来源 |
|------|------|
| golden_boot[].goals, rank | 射手榜 |
| golden_boot[].pressure | 0–1，排名第 1 = 1.0，递减 |
| golden_ball_contenders[].heat | 新闻热度 + 表现综合 0–1 |

---

## 5. 情景判定快速参考

| scenario | scenario_code | 条件 |
|----------|---------------|------|
| must_win | A | 必须赢才能出线 |
| draw_enough | B | 平局即可出线 |
| qualified | C | 已锁定晋级 |
| eliminated | C | 已出局 |

详细博弈（D–L）在预测步骤中叠加，见 game-theory.md。

---

## 6. 数据新鲜度

- 运行前执行 `TZ=Asia/Shanghai date` 确认当前时刻
- 已开球未写入比分的场次 → `status: live`，**不预测**
- `data_as_of` = 最后一次成功联网或缓存读取时间（+08:00）
- 缓存降级时在摘要标注 `[数据时效：YYYY-MM-DD CST]`

---

## 7. 常见错误

| 错误 | 修正 |
|------|------|
| 用 UTC 日期做窗口筛选 | 改用 `datetime_cst` 日期 |
| 忽略同组先赛结果 | 先更新 schedule/standings，再 K 传导 |
| 漏更新 players.json | 射手榜变阵会直接影响 L 权重 |
| predictions 缺 scenario_summary | 仪表盘分析框为空 |
| 访问不存在的 btts 字段 | btts 可选，不写则仪表盘跳过 |
