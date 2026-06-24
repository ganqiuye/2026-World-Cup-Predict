---
name: world-cup-predict
description: >-
  预测 2026 FIFA 世界杯比分（v2 六维权重：实力/博弈/赛序/路径/球员/外部）。
  以北京时间为准，优先中文源联网；含同组赛序传导(K)、球员荣誉(L)、协同博弈(F)。
  生成 predictions.json 并刷新 HTML 仪表盘。Use when user mentions 世界杯预测、比分预测、2026 世界杯、晋级形势、重新生成预测。
---

# 2026 世界杯比分预测 Skill（v2）

## 快速开始

用户请求预测时，**严格按顺序**执行：

```
Task Progress:
- [ ] 0. 确定北京时间「今天」「明天」→ 预测窗口 [from, to]
- [ ] 1. 联网获取数据（中文源，见 data-sources.md）
- [ ] 2. 更新 data/schedule.json（含 datetime_cst、已赛比分、status）
- [ ] 3. 更新 data/standings.json（积分、scenario/scenario_code）
- [ ] 4. 更新 data/players.json（射手榜、金靴/最佳球员压力）
- [ ] 5. 筛选窗口内未赛场次；排除 live / 已结束
- [ ] 6. 同组内按 datetime_cst 排序 → 先预测先赛场 → 再预测后赛场（K）
- [ ] 7. 对每场执行七步预测（prediction-template.md）
- [ ] 8. 写入 data/predictions.json（含 weight_contributions、analysis 原因）
- [ ] 9. 运行 python3 scripts/inject_dashboard.py
- [ ] 10. 输出中文摘要 + 仪表盘路径
```

**预测窗口：** 北京时间 **今天 + 明天**（2 个自然日）。  
**不在窗口内** 或 **已开赛/已结束** 的比赛：不写入 `predictions.matches`，可记入 `predictions.skipped`。

---

## 0. 确定预测窗口

```bash
TZ=Asia/Shanghai date '+%Y-%m-%d'          # 今天 → window.from
TZ=Asia/Shanghai date -d '+1 day' '+%Y-%m-%d'  # 明天 → window.to
```

所有 `generated_at`、`data_as_of` 使用 `+08:00` 后缀，例如 `2026-06-23T12:00:00+08:00`。

---

## 1. 联网数据获取

**必须先读** [data-sources.md](data-sources.md)。

要点：
- 搜索词用**中文**，数据源优先网易/虎扑/懂球帝/worldcup2026cn.com
- 赛程时间一律转为 **`datetime_cst`（北京时间 ISO8601）**
- 必须拉取：窗口内赛程、各组积分榜、**同组已赛结果**、射手榜前 10、伤病停赛
- 第三轮同开 12 场 → 标记待 F 情景分析

失败降级：读 `data/` 缓存，标注 `[数据时效：YYYY-MM-DD CST]`，confidence −1。

---

## 2. 博弈与权重（核心）

**必须先读：**
- [game-theory.md](game-theory.md) — 情景 A–L
- [weights-algorithm.md](weights-algorithm.md) — 六维公式与计算顺序

### v2 权重公式

```
P(h,a) ∝ exp( 0.32×S_str + 0.24×S_gt + 0.14×S_seq + 0.12×S_path + 0.10×S_pl + 0.08×S_ext )
```

| 维度 | 权重 | 情景 |
|------|------|------|
| 纯实力 | 0.32 | — |
| 博弈修正 | 0.24 | A–I |
| **同组赛序** | **0.14** | **K** |
| 淘汰赛路径 | 0.12 | J |
| **球员个人** | **0.10** | **L** |
| 战术/外部 | 0.08 | — |

### 每场必须输出

| 输出项 | 说明 |
|--------|------|
| `dominant_factor` | `strength` / `game_theory` / `balanced` |
| `pure_strength_score` vs `game_theory_score` | 纯实力 vs 博弈修正 |
| `analysis.scenario` | 情景代号数组，如 `["A","K","L"]` |
| `analysis.scenario_summary` | **一句话分析原因**（仪表盘卡片预览用） |
| `analysis.game_theory_adjustment` | 博弈修正逻辑（1–3 句） |
| `analysis.sequence_notes` | 同组先赛→后赛传导（K 触发时必填） |
| `analysis.player_factors` | 球员压力（L 触发时必填） |
| `weight_contributions` | 该场六维实际贡献占比（%） |
| `score_distribution[].reason` | 每个比分必须有**原因** |

**典型非直觉结果：** 强队已锁定头名 + 路径更优 → 最可能 1-1 或轮换小负，而非 3-0。

---

## 3. 同组赛序预测（K）— 强制流程

同组窗口内有多场时，**禁止并行独立预测**，必须：

```
1. 按 datetime_cst 升序排列同组本轮场次
2. 对已结束的先赛场：用实际比分更新临时积分榜
3. 预测第一场未赛场 → 写入 JSON
4. 若后赛依赖先赛结果（尚未踢）：
   - 以「先赛最可能比分」为基准情景预测后赛
   - 在 analysis.cross_match_notes 注明依赖关系
   - 可选：在 score_distribution 的 reason 中标注「若先赛 X-Y」
5. 先赛实际结束后用户再次运行 Skill → 用真实比分重算后赛
```

**K 与 F 区别：**
- **K**：同组**先后**开赛（第 1、2 轮常见）
- **F**：第三轮 **12 场同时**开球，交叉动态调整

---

## 4. 球员因素（L）

读取/更新 `data/players.json`：

```json
{
  "golden_boot": [{ "rank", "player", "team_code", "goals", "pressure": 0.0-1.0, "note" }],
  "golden_ball_contenders": [{ "player", "team_code", "heat": 0.0-1.0, "note" }]
}
```

规则（详见 weights-algorithm.md §2.5）：
- `pressure ≥ 0.65` → 必须在 `player_factors` 中输出
- 金靴竞争者 → λ +5~8%，大比分权重 ↑
- 个人目标已达成 + 球队已出线（如梅西破纪录后）→ λ −10%

---

## 5. 七步推理

按 [prediction-template.md](prediction-template.md) 执行，结果写入 `analysis.steps_summary`（step1–step7）。

---

## 6. 写入 JSON

字段规范见 [html-schema.md](html-schema.md)。

### predictions.json 顶层

```json
{
  "generated_at": "2026-06-23T12:00:00+08:00",
  "timezone": "Asia/Shanghai",
  "data_source": "网易体育、worldcup2026cn.com",
  "window": { "from": "2026-06-23", "to": "2026-06-24" },
  "weight_formula": "0.32×实力 + 0.24×博弈 + 0.14×赛序 + 0.12×路径 + 0.10×球员 + 0.08×外部",
  "matches": [],
  "skipped": [{ "id": "...", "reason": "比赛已开赛", "status": "live" }],
  "notes": "可选说明"
}
```

### 排除规则（写入 skipped，不进 matches）

| 条件 | reason 示例 |
|------|-------------|
| `status: live` 或已开球 | 比赛已开赛 |
| `status: finished` 或 `actual_score` 非空 | 已结束 |
| 开球时间 < 当前北京时间 | 已过开球时间 |
| 不在 window 内 | 窗口外 |

### schedule.json 同步

- `actual_score`、`status`（`scheduled` / `live` / `finished`）
- 每条 match 必须有 `datetime_cst`

### standings.json 同步

- `data_as_of`（+08:00）
- 每队 `scenario` + `scenario_code`（A–L 对应）

---

## 7. 刷新仪表盘

```bash
python3 scripts/inject_dashboard.py
```

浏览器打开：`dashboard/index.html`

仪表盘行为（无需改 HTML，但 JSON 必须满足）：
- 侧栏「预测分析原因」依赖 `scenario_summary`、`game_theory_adjustment`、`sequence_notes`
- 列表卡片预览依赖 `scenario_summary`
- 权重条依赖 `weight_contributions`
- 已结束比赛默认折叠；`status: finished` 自动归入折叠组

---

## 8. 对话输出摘要

```markdown
## 2026 世界杯预测摘要（[北京时间日期]）

**数据时效：** [data_as_of] CST
**数据来源：** [data_source]
**预测窗口：** [from] ~ [to]（共 N 场，跳过 M 场）

### 权重公式
0.32×实力 + 0.24×博弈 + 0.14×赛序 + 0.12×路径 + 0.10×球员 + 0.08×外部

### 本期预测
| 北京时间 | 比赛 | 预测 | 主导 | 关键情景 | 置信度 |
|----------|------|------|------|----------|--------|

### 赛序传导（K）亮点
- [先赛] → [后赛]：[影响说明]

### 最值得关注（Top 3）
1. ...

### 相比上次变化
- ...

> 仅供分析参考，不构成投注建议。
```

---

## 9. 用户指定单场

- 在窗口内且未开赛 → 完整七步 + 更新 JSON（若已有则替换）
- 不在窗口内 → 分析但不写入 JSON，提示临近比赛日再运行
- 用户说「重新生成今天明天预测」→ 执行完整 Task Progress 0–10

---

## 10. 回测模式（可选）

用户提供已结束比赛及**赛前**信息时：
- 仅用赛前数据执行七步
- 对比实际比分，报告偏差
- 不写入 predictions.json

---

## 参考文件

| 文件 | 用途 |
|------|------|
| [data-sources.md](data-sources.md) | 中文源搜索策略与字段映射 |
| [game-theory.md](game-theory.md) | 情景 A–L |
| [weights-algorithm.md](weights-algorithm.md) | 六维权重算法 |
| [calibration.md](calibration.md) | 回测校准、动态 K、淘汰赛 v3 |
| [prediction-template.md](prediction-template.md) | 七步推理模板 |
| [html-schema.md](html-schema.md) | JSON 字段规范 |
| `data/players.json` | 金靴/最佳球员 |
| `data/team-strength.json` | 实力指数（路径 J） |
| `data/knockout-bracket.json` | 32 强配对规则 |

---

## 2026 赛制提醒

- 48 队，12 组 × 4 队；前 2 + 8 个最佳第三名 → 32 强
- 第 1、2 轮同组先后开赛 → **K 必分析**
- 第 3 轮 12 场同开 → **F 必分析**
- 所有时间展示与窗口筛选 → **北京时间**

---

*本预测基于公开数据与战术博弈模型，仅供分析参考，不构成任何投注建议。*
