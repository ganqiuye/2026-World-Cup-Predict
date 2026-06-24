(function () {
  "use strict";

  /** 博弈情景代号（与 game-theory.md / calibration.md 对齐） */
  const LEGEND = {
    A: { name: "生死战", desc: "必须赢球或特定净胜球才能出线/晋级；进攻与比分方差上升" },
    B: { name: "打平即出线", desc: "平局确保晋级；保守战术，平局概率 +8~15%" },
    "B+": { name: "同分可接受平局", desc: "双方同分且平局后仍处前二区，非末轮；平局 +12%（如英格兰 0-0）" },
    C: { name: "已出线/已淘汰", desc: "名次已定或出局；轮换，实力系数 ×0.75~0.85" },
    D: { name: "淘汰赛路径选择", desc: "某名次可避开淘汰赛强敌；可能战略性控分" },
    E: { name: "战略性控分", desc: "赢球反而遇强敌 / 小组第二路径更优；强队接受平局或小负" },
    F: { name: "协同博弈", desc: "同轮多场同时开球，A 场结果影响 B 场；R3 必分析" },
    G: { name: "净胜球算计", desc: "需赢 N 球但不必大胜；领先后收手，大比分概率下降" },
    H: { name: "默契球风险", desc: "两队打平均可携手出线；平局概率 +10~20%" },
    I: { name: "轮换保存", desc: "已锁定名次，为淘汰赛留力；冷门概率上升，xG 下调 20%" },
    J: { name: "淘汰赛路径胜率", desc: "小组第一 vs 第二导致 32 强对手强弱不同；影响当前战意 ±5~15%" },
    K: { name: "同组赛序传导", desc: "同组先后开赛，先赛结果改变后赛战意（与 F 同时开球区分）" },
    L: { name: "球员个人目标", desc: "金靴/最佳球员/纪录追逐；核心 λ +5~8%，目标已达成则 −10%" },
    M: { name: "射门转化效率", desc: "高控球低射正/xGOT；进球 λ −5~12%（英格兰低效控球案）" },
    N: { name: "VAR/越位/哨音", desc: "大比分预期下调 5~10%；越位/VOR 吹判影响" },
    O: { name: "舆论反弹战意", desc: "首轮爆冷后正名之战；λ +8~15%，禁用 G 收手" },
    P: { name: "里程碑场次", desc: "生涯 N 场纪念等；战意 +5%，非进球保证" },
    Q: { name: "最佳第三全局", desc: "48 队制 8 个最佳第三名；R3 跨组第三出线竞争" },
    R: { name: "替补奇兵", desc: "超级替补 xG 不确定性；冷门尾部概率上升" },
  };

  /** 图例展示顺序 */
  const ORDER = ["A", "B", "B+", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L", "M", "N", "O", "P", "Q", "R"];

  function esc(s) {
    if (s == null) return "";
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function lookup(code) {
    return LEGEND[code] || null;
  }

  function tooltip(code) {
    const e = lookup(code);
    if (!e) return String(code);
    return `${code} · ${e.name}：${e.desc}`;
  }

  function renderBadge(code, opts) {
    const compact = !opts || opts.compact !== false;
    const e = lookup(code);
    const tip = esc(tooltip(code));
    const label = esc(code);
    const nameHint = (!compact && e) ? `<span class="scenario-name">${esc(e.name)}</span>` : "";
    return `<span class="badge badge-scenario" data-tip="${tip}" title="${tip}" tabindex="0" role="button" aria-label="${tip}">${label}${nameHint}</span>`;
  }

  function renderLegendGrid() {
    return ORDER.map(code => {
      const e = LEGEND[code];
      return `<div class="legend-item">
        <span class="legend-code">${esc(code)}</span>
        <span class="legend-name">${esc(e.name)}</span>
        <span class="legend-desc">${esc(e.desc)}</span>
      </div>`;
    }).join("");
  }

  function mountLegend(containerId) {
    const el = document.getElementById(containerId);
    if (el) el.innerHTML = renderLegendGrid();
  }

  window.ScenarioLegend = {
    LEGEND,
    ORDER,
    lookup,
    tooltip,
    renderBadge,
    renderLegendGrid,
    mountLegend,
  };
})();
