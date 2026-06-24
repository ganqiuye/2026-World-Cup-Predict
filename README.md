# World Cup Predict — 博弈化世界杯比分预测

Cursor Agent Skill + 静态 HTML 仪表盘：结合实力模型、出线博弈（情景 A–R）、赛序传导与球员因素，预测未来 2 天比赛比分。

## 功能

- **Cursor Skill**（`.cursor/skills/world-cup-predict/`）：11 步预测流程、六维权重、回测校准
- **数据层**（`data/*.json`）：赛程、积分、预测、球员、实力评分
- **仪表盘**（`dashboard/`）：赛程时间轴、积分榜、比赛预测侧栏、晋级路线图、晋级全景树

## 快速开始

### 1. 安装 Skill

将本仓库克隆到本地后，Skill 位于：

```
.cursor/skills/world-cup-predict/
```

在 Cursor 中打开项目目录，提及「世界杯预测」「重新生成今明两天预测」或 `@world-cup-predict` 即可触发。

### 2. 生成预测并刷新仪表盘

```bash
# Skill 运行后会更新 data/predictions.json 等文件，然后执行：
python3 scripts/inject_dashboard.py
```

浏览器打开 `dashboard/index.html`（纯静态，可离线）。

### 3. 全景树
****<img width="1252" height="1096" alt="QQ_1782290117434" src="https://github.com/user-attachments/assets/9ec4d3f1-2990-46e0-b757-44dfb90600c9" />

### 4. 晋级路线图

在仪表盘「晋级路线图」区块选择球队，可对本队下场及**同组同时/更早开球**的场次切换胜/平/负假设，模拟出线与淘汰赛路径。
<img width="2510" height="1074" alt="QQ_1782289989282" src="https://github.com/user-attachments/assets/758d8aa9-b485-49a6-8fe3-e9290f95e8db" />

### 5. 当天预测结果
<img width="2133" height="858" alt="QQ_1782290177608" src="https://github.com/user-attachments/assets/7a0dbff5-cbb6-4e37-9572-722afb4fbf13" />

### 6. 预测分析
<img width="408" height="1261" alt="QQ_1782290213801" src="https://github.com/user-attachments/assets/aabe69ee-fc9f-46b5-9197-04003f96b45d" />




## 目录结构

```
.cursor/skills/world-cup-predict/   # Skill 主入口与参考文档
data/                             # JSON 数据（赛程、积分、预测等）
dashboard/                        # HTML / CSS / JS 仪表盘
scripts/inject_dashboard.py       # 将 data 注入 index.html
```

## Skill 参考文档

| 文件 | 说明 |
|------|------|
| `SKILL.md` | 主流程 |
| `game-theory.md` | 博弈情景 A–R |
| `weights-algorithm.md` | 权重公式 |
| `calibration.md` | 回测与阶段调权 |
| `data-sources.md` | 数据源与北京时间 |
| `html-schema.md` | JSON 字段规范 |

## 免责声明

本预测基于公开数据与战术博弈模型，仅供分析参考，不构成任何投注建议。
