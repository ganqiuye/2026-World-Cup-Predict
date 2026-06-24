/**
 * 晋级全景二叉树 — 可编辑比分，动态生成淘汰赛对阵
 */
(function () {
  "use strict";

  const tn = (c, n) => window.teamName(c || n);
  const fg = (c) => (window.FLAG && window.FLAG[c]) ? window.FLAG[c] + " " : "";

  const ROUND_ZH = { R32: "32强", R16: "16强", QF: "8强", SF: "半决赛", F: "决赛" };

  function render() {
    const el = document.getElementById("bracket-tree-container");
    if (!el || !window.BracketEngine) return;

    BracketEngine.init();
    const tree = BracketEngine.buildTree();

    let html = `<div class="bracket-toolbar">
      <span class="bracket-hint">点击比分可修改 · 修改后自动重算出线与淘汰赛对阵</span>
      <button type="button" id="btn-bracket-reset" class="btn-gen-path">重置比分</button>
    </div>
    <div class="bracket-panorama" id="bracket-panorama">`;

    // ── 小组赛列 ──
    html += `<div class="bracket-stage stage-groups"><div class="stage-label">小组赛</div>`;
    tree.groupIds.forEach(g => {
      html += `<div class="group-tree" data-group="${g}">
        <div class="group-tree-title">${g} 组</div>
        <div class="group-standings-mini">${renderMiniStandings(tree.allStandings[g])}</div>
        <div class="group-matches">${tree.groupMatches[g].map(m => renderMatchNode(m, true)).join("")}</div>
      </div>`;
    });
    html += `</div>`;

    // ── 出线区 ──
    html += `<div class="bracket-stage stage-qualify"><div class="stage-label">出线</div>
      <div class="qualify-slots">${renderQualifySlots(tree)}</div></div>`;

    // ── 淘汰赛列（二叉树向右展开）──
    ["R32", "R16", "QF", "SF", "F"].forEach(round => {
      const matches = tree.knockout[round] || [];
      html += `<div class="bracket-stage stage-ko" data-round="${round}">
        <div class="stage-label">${ROUND_ZH[round]}</div>
        <div class="ko-matches">${matches.length
          ? matches.map(m => renderKoNode(m)).join("")
          : `<p class="path-empty">待小组赛结束后生成</p>`}
        </div>
      </div>`;
    });

    html += `</div>`;
    el.innerHTML = html;
    bindEvents();
    drawConnectors();
  }

  function renderMiniStandings(teams) {
    if (!teams?.length) return "";
    return teams.map(t =>
      `<div class="mini-row${t.rank <= 2 ? " q" : ""}"><span>${t.rank}</span>
       <span>${fg(t.code)}${tn(t.code, t.team)}</span><span>${t.points}分</span></div>`
    ).join("");
  }

  function renderMatchNode(m, editable) {
    const { score, source } = BracketEngine.getMatchScore(m);
    const sc = score || "-";
    const srcCls = source === "finished" ? "src-finished" : source === "predicted" ? "src-pred" : source === "user" ? "src-user" : "src-pending";
    const round = (m.round || "").replace("Group Stage R", "R");
    return `<div class="tree-match ${srcCls}" data-id="${m.id}" data-type="group">
      <div class="tm-round">${round}</div>
      <div class="tm-row tm-home">${fg(m.home_code)}${tn(m.home_code, m.home)}</div>
      <div class="tm-score">${editable
        ? `<input class="score-edit" data-id="${m.id}" value="${sc === "-" ? "" : sc}" placeholder="-" maxlength="5">`
        : `<span>${sc}</span>`}</div>
      <div class="tm-row tm-away">${fg(m.away_code)}${tn(m.away_code, m.away)}</div>
    </div>`;
  }

  function renderQualifySlots(tree) {
    let html = "";
    tree.groupIds.forEach(g => {
      const teams = tree.allStandings[g] || [];
      teams.filter(t => t.rank <= 2).forEach(t => {
        html += `<div class="qualify-chip rank-${t.rank}">${fg(t.code)}${tn(t.code, t.team)}
          <small>${g}${t.rank}</small></div>`;
      });
    });
    if (tree.thirds?.length) {
      html += `<div class="third-title">最佳第三名</div>`;
      tree.thirds.slice(0, 4).forEach(t => {
        html += `<div class="qualify-chip rank-3">${fg(t.code)}${tn(t.code, t.team)}<small>${t.group}3?</small></div>`;
      });
    }
    return html || "<p class='path-empty'>暂无出线队</p>";
  }

  function renderKoNode(m) {
    const home = m.home, away = m.away;
    if (!home || !away) return "";
    const sc = m.score || "vs";
    return `<div class="tree-match src-ko" data-id="${m.id}" data-type="ko">
      <div class="tm-row tm-home winner-candidate">${fg(home.code)}${tn(home.code, home.team)}
        <small>${m.homeSlot || ""}</small></div>
      <div class="tm-score ko-score">${sc}</div>
      <div class="tm-row tm-away winner-candidate">${fg(away.code)}${tn(away.code, away.team)}
        <small>${m.awaySlot || ""}</small></div>
    </div>`;
  }

  function bindEvents() {
    document.querySelectorAll(".score-edit").forEach(input => {
      input.addEventListener("change", onScoreChange);
      input.addEventListener("keydown", e => { if (e.key === "Enter") { input.blur(); } });
    });
    document.getElementById("btn-bracket-reset")?.addEventListener("click", () => {
      BracketEngine.resetOverrides();
      render();
    });
  }

  function onScoreChange(e) {
    const id = e.target.dataset.id;
    const val = e.target.value.trim();
    if (val && !/^\d+-\d+$/.test(val)) {
      e.target.classList.add("score-error");
      return;
    }
    e.target.classList.remove("score-error");
    BracketEngine.setScore(id, val || null);
    render();
  }

  function drawConnectors() {
    const svg = document.getElementById("bracket-connectors");
    const pan = document.getElementById("bracket-panorama");
    if (!svg || !pan) return;

    const panRect = pan.getBoundingClientRect();
    svg.setAttribute("width", pan.scrollWidth);
    svg.setAttribute("height", pan.scrollHeight);
    svg.innerHTML = "";

    const stages = pan.querySelectorAll(".bracket-stage");
    if (stages.length < 2) return;

    for (let i = 0; i < stages.length - 1; i++) {
      const from = stages[i].getBoundingClientRect();
      const to = stages[i + 1].getBoundingClientRect();
      const x1 = from.right - panRect.left + pan.scrollLeft;
      const y1 = from.top + from.height / 2 - panRect.top + pan.scrollTop;
      const x2 = to.left - panRect.left + pan.scrollLeft;
      const y2 = to.top + to.height / 2 - panRect.top + pan.scrollTop;

      const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
      const mx = (x1 + x2) / 2;
      path.setAttribute("d", `M${x1},${y1} C${mx},${y1} ${mx},${y2} ${x2},${y2}`);
      path.setAttribute("class", "connector-line");
      svg.appendChild(path);
    }
  }

  window.BracketTree = {
    init() {
      BracketEngine.init();
      render();
      window.addEventListener("resize", () => drawConnectors());
    },
    render,
  };
})();
