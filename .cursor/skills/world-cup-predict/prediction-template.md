# 七步推理模板（v2）

执行每场预测时按此模板逐步输出。  
博弈规则 → [game-theory.md](game-theory.md)  
权重公式 → [weights-algorithm.md](weights-algorithm.md)

---

## 前置：赛序排序（K）

**同组窗口内有多场时，先完成此步：**

1. 按 `datetime_cst` 升序列出同组本轮场次
2. 标记 `order_index`：1 = 先赛，2 = 后赛 …
3. 已结束的先赛场 → 用 `actual_score` 更新临时积分榜
4. 当前场若是后赛 → 在步骤 2、5 中显式引用先赛结果

---

## 输入数据区

### 基础信息
- 比赛：____ vs ____
- 轮次：小组赛第__轮 / 淘汰赛
- **北京时间**：`datetime_cst`
- 地点、气温、湿度

### 同组已赛（K 必填）
| 顺序 | 北京时间 | 比分 | 对本场出线形势的影响 |
|------|----------|------|----------------------|

### 当前积分/晋级形势
- 各队积分、排名、净胜球
- 出线规则（2026：前 2 + 8 个最佳第 3）

### 球员因素（L）
- 查阅 `data/players.json`
- 列出本场相关球员：`pressure ≥ 0.65` 必分析

### 球队状态
- 伤病/停赛、体能、历史交锋

---

## 步骤 1：数据清洗与基准建立

1. 近 10 场正式比赛：xG、xGA、PPDA
2. Elo 差 → 胜率基准（差 100 ≈ 64% 主胜）
3. 友谊赛 ×0.5，近 6 月 ×1.3

**输出**：`pure_strength_score`、λ_home、λ_away

---

## 步骤 2：战意与策略博弈

判定情景 **A–L**：

| 必查 | 情景 |
|------|------|
| 出线形势 | A/B/C/D/E |
| 同轮同时开球 | F |
| 净胜球/默契 | G/H |
| 已锁定名次 | I |
| 32 强路径 | J |
| **同组先赛后赛** | **K** |
| **球员荣誉** | **L** |

输出：
- 预期阵型、攻防节奏
- `game_theory_score` 及修正原因
- `sequence_notes`（K）
- `player_factors`（L）

---

## 步骤 3：战术克制矩阵

| 维度 | 主队 | 客队 | 均衡 | 依据 |
|------|------|------|------|------|
| 控球 vs 反击 | | | | |
| 边路 vs 中路 | | | | |
| 高位逼抢 vs 出球 | | | | |
| 定位球 | | | | |
| 体能 vs 经验 | | | | |

标注 1–2 个**决定性维度** → 写入 `score_distribution[].reason`

---

## 步骤 4：外部变量修正

气候/海拔、裁判、赛程密度（少休 1 天 → λ −3%）、伤病（核心 −8~15%）。

→ 计入 `weight_contributions.external_pct`

---

## 步骤 5：概率化预测

### 5.1 六维合成

按 [weights-algorithm.md](weights-algorithm.md) 计算 `S_str … S_ext`，合成 Top 8 比分。

**每个比分必须写 `reason`**（实力/博弈/赛序/球员，一句话）。

### 5.2 衍生预测

- `win_draw_loss`：主胜/平/客胜 %
- `btts`：可选 `{ yes, no }`

### 5.3 权重贡献

填写 `weight_contributions`（六项之和 ≈ 100）：

```json
{
  "strength_pct": 40,
  "game_theory_pct": 22,
  "sequence_pct": 18,
  "path_pct": 8,
  "player_pct": 9,
  "external_pct": 3
}
```

### 5.4 置信度

| 星级 | 最可能比分概率 |
|------|----------------|
| 5 | > 22% 且单一维度主导 |
| 4 | 18–22% |
| 3 | 14–18% |
| 2 | 10–14% |
| 1 | < 10% 或多情景冲突 |

---

## 步骤 6：反事实与赛序传导

- 先赛若出现冷门 → 后赛战意如何变？
- 30 分钟红牌、半场 0-0 必须赢球
- 写入 `cross_match_notes`

---

## 步骤 7：模型自检

1. 与赔率/主流预测差异
2. 最可能错误原因
3. 会推翻结论的新信息

→ 写入 `steps_summary.step7`

---

## JSON 输出检查表

写入 `predictions.json` 前逐项确认：

```
[ ] id / datetime_cst / venue
[ ] most_likely_score + pure_strength_score + game_theory_score
[ ] score_distribution ×8，每条有 reason
[ ] analysis.scenario + scenario_summary（一句话原因）
[ ] analysis.game_theory_adjustment
[ ] weight_breakdown + weight_contributions
[ ] dominant_factor + confidence
[ ] steps_summary step1–step7
[ ] K → sequence_notes + cross_match_notes
[ ] L → player_factors
[ ] J → knockout_path
```

---

## 输出规范

1. 百分比保留 1 位小数
2. 每结论附 `[依据：…]`
3. 禁止模糊词，必须量化
4. 数据不足 → `[数据缺失：…]`，降 confidence，不猜测
