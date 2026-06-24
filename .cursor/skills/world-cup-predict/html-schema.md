# HTML / JSON 数据格式规范（v2）

Skill 每次运行后更新 `data/` 下 JSON，再执行 `python3 scripts/inject_dashboard.py`。

---

## 合并结构 `window.WC_DATA`

```javascript
{
  tournament:     { /* tournament.json */ },
  schedule:       { /* schedule.json */ },
  standings:      { /* standings.json */ },
  predictions:    { /* predictions.json */ },
  teamStrength:   { /* team-strength.json */ },
  knockoutBracket:{ /* knockout-bracket.json */ },
  players:        { /* players.json，可选 */ }
}
```

---

## schedule.json

| 字段 | 类型 | 说明 |
|------|------|------|
| data_as_of | string | ISO8601 +08:00 |
| timezone | string | `Asia/Shanghai` |
| matches | object[] | 全部赛程 |

**单场 match：**

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| id | string | ✓ | 如 `2026-GROUP-J-R2-ARG-AUT` |
| home, away | string | ✓ | 英文名 |
| home_code, away_code | string | ✓ | 三字母代码 |
| group | string | ✓ | A–L |
| round | string | ✓ | 如 `Group Stage R2` |
| datetime | string | ✓ | 当地 ISO8601 |
| datetime_cst | string | ✓ | **北京时间** ISO8601 |
| venue | string | ✓ | 场馆 |
| knockout_round | string | | null 或 R32/R16/... |
| actual_score | string | | null 或 `"2-1"` |
| status | string | ✓ | `scheduled` / `live` / `finished` / `postponed` |

---

## standings.json

| 字段 | 说明 |
|------|------|
| data_as_of | +08:00 |
| timezone | `Asia/Shanghai` |
| groups | `"A": [ standing, ... ]` |
| best_third_place | 最佳第三名（可选） |
| knockout | 淘汰赛对阵（可选） |

**球队 standing：**

| 字段 | 说明 |
|------|------|
| team, team_code | 队名 |
| played, won, drawn, lost, gf, ga, gd, points, rank | 标准 |
| scenario | `must_win` / `draw_enough` / `qualified` / `eliminated` |
| scenario_code | A–L 主情景 |

---

## players.json

| 字段 | 说明 |
|------|------|
| data_as_of | +08:00 |
| timezone | `Asia/Shanghai` |
| source | 数据来源说明 |
| golden_boot | 射手榜 `[{ rank, player, team, team_code, goals, pressure, note }]` |
| golden_ball_contenders | `[{ player, team_code, heat, note }]` |

`pressure` / `heat`：0.0–1.0，≥ 0.65 触发情景 L。

---

## predictions.json

### 顶层

| 字段 | 必填 | 说明 |
|------|------|------|
| generated_at | ✓ | +08:00 |
| timezone | ✓ | `Asia/Shanghai` |
| data_source | ✓ | 中文源说明 |
| window.from / to | ✓ | 北京时间日期 YYYY-MM-DD |
| weight_formula | ✓ | v2 公式字符串 |
| matches | ✓ | 窗口内未赛预测 |
| skipped | | 跳过场次及原因 |
| notes | | 全局说明 |

### 单场 prediction（matches[]）

| 字段 | 必填 | 说明 |
|------|------|------|
| id | ✓ | 对应 schedule.id |
| home, away, home_code, away_code, group, round | ✓ | 冗余便于展示 |
| datetime, datetime_cst, venue | ✓ | |
| status | ✓ | 固定 `predicted` |
| dominant_factor | ✓ | `strength` / `game_theory` / `balanced` |
| confidence | ✓ | 1–5 整数 |
| prediction.most_likely_score | ✓ | 如 `"2-1"` |
| prediction.most_likely_probability | ✓ | 百分比数字 |
| prediction.pure_strength_score | ✓ | 纯实力比分 |
| prediction.game_theory_score | ✓ | 博弈修正比分 |
| prediction.score_distribution | ✓ | `[{ score, probability, reason }]` ×8，**reason 必填** |
| prediction.win_draw_loss | ✓ | `{ home, draw, away }` 百分比 |
| prediction.btts | | `{ yes, no }` 可选 |
| weight_breakdown | ✓ | 六维默认权重 `{ strength, game_theory, sequence, path, player, external }` |
| weight_contributions | ✓ | 该场实际贡献 `{ strength_pct, game_theory_pct, sequence_pct, path_pct, player_pct, external_pct }` |
| analysis.scenario | ✓ | 情景代号数组 `["A","K"]` |
| analysis.scenario_summary | ✓ | **分析原因一句话**（列表预览 + 侧栏） |
| analysis.game_theory_adjustment | ✓ | 博弈修正说明 |
| analysis.sequence_notes | K 时 ✓ | 赛序传导 |
| analysis.player_factors | L 时 ✓ | `[{ player, award, pressure, impact }]` |
| analysis.knockout_path | J 时 | `{ if_win, if_draw, if_lose }` 各含 rank/opponent_r32/win_prob |
| analysis.cross_match_notes | K/F 时 | 同组/同轮关联 |
| analysis.steps_summary | ✓ | `{ step1..step7 }` |
| actual_result | | null，赛后回填 |

### skipped[]

```json
{ "id": "2026-GROUP-J-R2-JOR-ALG", "reason": "比赛已开赛", "status": "live" }
```

---

## 仪表盘 UI 映射

| JSON 字段 | UI 位置 |
|-----------|---------|
| scenario_summary | 列表卡片预览 + 侧栏「预测分析原因」 |
| game_theory_adjustment | 侧栏分析框（金色） |
| sequence_notes | 侧栏「赛序传导 K」 |
| player_factors | 侧栏「球员因素 L」 |
| weight_contributions | 侧栏权重条形图 |
| score_distribution.reason | 侧栏比分概率表 |
| status: finished | 比赛列表「已结束」折叠组 |
| status: live | 红色「进行中」，不预测 |

---

## inject_dashboard.py

1. 读取 `data/tournament.json`, `schedule.json`, `standings.json`, `predictions.json`, `team-strength.json`, `knockout-bracket.json`
2. 若存在 `data/players.json` 一并注入
3. 合并为 `WC_DATA` 写入 `dashboard/index.html`

```bash
python3 scripts/inject_dashboard.py
```

---

## 校验清单（写入前自检）

- [ ] 所有时间字段含 `datetime_cst`（+08:00）
- [ ] window.from/to 与 datetime_cst 日期一致
- [ ] 每场 prediction 有 scenario_summary + score_distribution[].reason
- [ ] K 场次有 sequence_notes；L 场次有 player_factors
- [ ] weight_contributions 六项之和 ≈ 100
- [ ] live/finished 不在 matches[]，在 skipped[] 或仅 schedule
- [ ] 同组后赛预测引用了先赛传导
