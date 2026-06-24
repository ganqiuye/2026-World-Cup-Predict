(function () {
  "use strict";

  const DOM = {
    dataAsOf: document.getElementById("data-as-of"),
    windowRange: document.getElementById("window-range"),
    timeline: document.getElementById("timeline"),
    groupsGrid: document.getElementById("groups-grid"),
    knockoutBar: document.getElementById("knockout-bar"),
    matchList: document.getElementById("match-list"),
    filters: document.querySelectorAll(".filter-btn"),
    sidebar: document.getElementById("sidebar"),
    sidebarContent: document.getElementById("sidebar-content"),
    sidebarClose: document.getElementById("sidebar-close"),
  };

  let state = {
    filter: "all",
    selectedDay: null,
    selectedMatchId: null,
    predictionMap: {},
    windowFrom: null,
    windowTo: null,
    finishedCollapsed: true,
  };

  function flag(code) {
    return (window.FLAG && FLAG[code]) ? FLAG[code] : "🏳️";
  }

  function tn(code, name) {
    return teamName(code) || teamName(name) || name || "待定";
  }

  function parseDate(iso) {
    return new Date(iso);
  }

  function fmtDate(d) {
    return d.toLocaleDateString("zh-CN", { month: "short", day: "numeric", weekday: "short" });
  }

  function fmtTime(iso) {
    return parseDate(iso).toLocaleString("zh-CN", {
      month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit"
    });
  }

  function matchDatetime(m) {
    return m.datetime_cst || m.datetime;
  }

  function dateKey(iso) {
    return parseDate(iso).toISOString().slice(0, 10);
  }

  function matchDateKey(m) {
    const iso = matchDatetime(m);
    if (iso && iso.includes("+08:00")) return iso.slice(0, 10);
    return dateKey(iso);
  }

  function inWindow(iso) {
    if (!state.windowFrom || !state.windowTo) return false;
    const k = dateKey(iso);
    return k >= state.windowFrom && k <= state.windowTo;
  }

  function matchInWindow(m) {
    if (!state.windowFrom || !state.windowTo) return false;
    const k = matchDateKey(m);
    return k >= state.windowFrom && k <= state.windowTo;
  }

  function matchStatus(m) {
    if (m.status === "finished" || m.actual_score) return "finished";
    if (m.status === "live") return "live";
    if (state.predictionMap[m.id]) return "predicted";
    if (matchInWindow(m)) return "pending";
    return "future";
  }

  function esc(s) {
    if (s == null) return "";
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function scenarioBadge(code, compact) {
    if (window.ScenarioLegend) return ScenarioLegend.renderBadge(code, { compact: compact !== false });
    return `<span class="badge badge-scenario" title="${esc(code)}">${esc(code)}</span>`;
  }

  function isLifeOrDeath(m) {
    const standings = WC_DATA.standings.groups[m.group];
    if (!standings) return false;
    const teams = [m.home, m.away];
    return standings.some(s => teams.includes(s.team) && s.scenario_code === "A");
  }

  function dominantLabel(f) {
    return { balanced: "均衡", game_theory: "博弈主导", strength: "实力主导" }[f] || f;
  }

  function roundZh(r) {
    return (r || "").replace("Group Stage R2", "小组赛第2轮")
      .replace("Group Stage R3", "小组赛第3轮")
      .replace("Group Stage R1", "小组赛第1轮");
  }

  function stars(n) {
    return "★".repeat(n) + "☆".repeat(5 - n);
  }

  function renderSidebarPath(kp, homeZh, awayZh) {
    if (!kp) return "";
    if (kp.paths) {
      const rows = Object.entries(kp.paths).map(([rank, p]) =>
        `<tr><td>${esc(p.label || rank)}</td><td>${esc(p.r32_opponent)}</td>
         <td>${esc(homeZh)} ${p.home_win_prob}% / ${esc(awayZh)} ${p.away_win_prob}%</td></tr>`
      ).join("");
      return `<div class="detail-section">
        <h3>🎯 淘汰赛路径权重</h3>
        <p class="analysis-note gold">${esc(kp.effort_note || "")}</p>
        ${kp.effort_modifier ? `<p class="analysis-note">战意修正：${kp.effort_modifier > 0 ? "+" : ""}${kp.effort_modifier}%</p>` : ""}
        <table class="score-table"><thead><tr><th>名次</th><th>32强对手</th><th>胜率</th></tr></thead>
        <tbody>${rows}</tbody></table></div>`;
    }
    const rows = ["if_win", "if_draw", "if_lose"].filter(k => kp[k]).map(k => {
      const p = kp[k];
      const label = { if_win: "若取胜", if_draw: "若平局", if_lose: "若失利" }[k];
      return `<tr><td>${label}</td><td>${esc(p.rank != null ? `第${p.rank}名` : "—")}</td>
        <td>${esc(p.opponent_r32 || p.r32_opponent || "待定")} · 胜率 ${p.win_prob != null ? Math.round(p.win_prob * 100) : (p.win_prob_pct || "—")}%</td></tr>`;
    }).join("");
    if (!rows) return "";
    return `<div class="detail-section">
      <h3>🎯 淘汰赛路径权重</h3>
      <table class="score-table"><tbody>${rows}</tbody></table></div>`;
  }

  function renderWeightBar(wc) {
    if (!wc) return "";
    const items = [
      ["实力", wc.strength_pct, "var(--blue)"],
      ["博弈", wc.game_theory_pct, "var(--gold)"],
      ["赛序", wc.sequence_pct, "#a371f7"],
      ["路径", wc.path_pct, "#39d353"],
      ["球员", wc.player_pct, "#ff7b72"],
      ["外部", wc.external_pct, "var(--gray)"],
    ].filter(([, v]) => v > 0);
    const bars = items.map(([label, pct, color]) =>
      `<div class="weight-row"><span class="weight-label">${label}</span>
       <div class="weight-track"><div class="weight-fill" style="width:${pct}%;background:${color}"></div></div>
       <span class="weight-pct">${pct}%</span></div>`
    ).join("");
    return `<div class="detail-section"><h3>权重贡献</h3><div class="weight-bars">${bars}</div></div>`;
  }

  function renderPlayerFactors(factors) {
    if (!factors || !factors.length) return "";
    const rows = factors.map(f =>
      `<li><strong>${esc(f.player)}</strong>（${esc(f.award === "golden_boot" ? "金靴" : f.award || "个人目标")}）
        · 压力 ${Math.round((f.pressure || 0) * 100)}% · ${esc(f.impact || "")}</li>`
    ).join("");
    return `<div class="detail-section"><h3>球员因素（L）</h3><ul class="factor-list">${rows}</ul></div>`;
  }

  function renderMatchCard(m, i) {
    const st = matchStatus(m);
    const pred = state.predictionMap[m.id];
    let scoreHtml;
    if (st === "finished") scoreHtml = `<span class="match-score actual">${esc(m.actual_score)}</span>`;
    else if (st === "live") scoreHtml = '<span class="match-score live">进行中</span>';
    else if (st === "predicted") scoreHtml = `<span class="match-score predicted">${esc(pred.prediction.most_likely_score)}</span>`;
    else if (st === "pending") scoreHtml = '<span class="match-score pending">待预测</span>';
    else scoreHtml = '<span class="match-score pending">窗口外</span>';

    const badges = [];
    if (isLifeOrDeath(m)) badges.push('<span class="badge badge-life">生死战</span>');
    if (pred?.dominant_factor === "game_theory") badges.push('<span class="badge badge-game">博弈</span>');
    const homeZh = tn(m.home_code, m.home);
    const awayZh = tn(m.away_code, m.away);

    const analysisLine = (st === "predicted" && pred?.analysis?.scenario_summary)
      ? `<div class="match-analysis-preview">${esc(pred.analysis.scenario_summary)}</div>`
      : "";
    const scenarioPreview = (st === "predicted" && pred?.analysis?.scenario?.length)
      ? `<div class="match-scenario-preview">${pred.analysis.scenario.map(s => scenarioBadge(s)).join("")}</div>`
      : "";

    return `<div class="match-card status-${st}${pred && pred.confidence <= 2 ? " low-confidence" : ""}${state.selectedMatchId === m.id ? " selected" : ""}"
      data-id="${m.id}" style="animation-delay:${i * 0.05}s">
      <span class="match-time">${fmtTime(matchDatetime(m))}</span>
      <div class="match-main">
        <span class="match-teams">
          ${flag(m.home_code)} ${esc(homeZh)} <strong>vs</strong> ${esc(awayZh)} ${flag(m.away_code)}
          ${m.group ? `<small style="color:var(--text-muted)"> · ${m.group}组</small>` : ""}
        </span>
        ${analysisLine}
        ${scenarioPreview}
      </div>
      ${scoreHtml}
      ${badges.join(" ")}
      <button class="btn-path-mini" data-home="${esc(m.home)}" data-away="${esc(m.away)}" title="晋级路线">📊</button>
    </div>`;
  }

  function init() {
    const pred = WC_DATA.predictions;
    state.windowFrom = pred.window?.from || null;
    state.windowTo = pred.window?.to || null;
    pred.matches.forEach(p => { state.predictionMap[p.id] = p; });

    DOM.dataAsOf.textContent = "数据: " + (WC_DATA.standings.data_as_of || pred.generated_at || "").slice(0, 16).replace("T", " ");
    DOM.windowRange.textContent = state.windowFrom
      ? `预测窗口: ${state.windowFrom} ~ ${state.windowTo}`
      : "";

    renderTimeline();
    renderGroups();
    renderKnockout();
    renderMatches();
    bindEvents();
    if (window.ScenarioLegend) ScenarioLegend.mountLegend("scenario-legend-grid");
    if (window.PathGraph) PathGraph.init();
    if (window.BracketTree) BracketTree.init();
  }

  function renderTimeline() {
    const matches = WC_DATA.schedule.matches;
    const dayMap = {};
    matches.forEach(m => {
      const k = matchDateKey(m);
      if (!dayMap[k]) dayMap[k] = { finished: 0, predicted: 0, pending: 0, total: 0 };
      dayMap[k].total++;
      const st = matchStatus(m);
      if (st === "finished") dayMap[k].finished++;
      else if (st === "predicted") dayMap[k].predicted++;
      else if (st === "pending") dayMap[k].pending++;
    });

    const today = new Date().toISOString().slice(0, 10);
    const days = Object.keys(dayMap).sort();
    DOM.timeline.innerHTML = days.map(k => {
      const d = dayMap[k];
      const isToday = k === today;
      const inWin = state.windowFrom && k >= state.windowFrom && k <= state.windowTo;
      return `<div class="timeline-day${isToday ? " today" : ""}${state.selectedDay === k ? " active" : ""}"
        data-day="${k}">
        <div class="date">${fmtDate(new Date(k))}${isToday ? " 今天" : ""}${inWin ? " 📊" : ""}</div>
        <div class="counts">
          ${d.finished ? `<span class="finished">${d.finished}已结束</span> ` : ""}
          ${d.predicted ? `<span class="predicted">${d.predicted}已预测</span> ` : ""}
          ${d.pending ? `<span class="pending">${d.pending}待预测</span>` : ""}
        </div>
      </div>`;
    }).join("");
  }

  function renderGroups() {
    const groups = WC_DATA.standings.groups || {};
    DOM.groupsGrid.innerHTML = Object.entries(groups).map(([g, teams]) => {
      const rows = teams.map(t => {
        let cls = "standing-row clickable";
        if (t.scenario === "qualified" || t.rank <= 2) cls += " qualified";
        if (t.scenario_code === "A") cls += " must-win";
        const scTip = window.ScenarioLegend ? ScenarioLegend.tooltip(t.scenario_code) : t.scenario_code;
        const scBadge = t.scenario_code
          ? `<span class="standing-scenario" data-tip="${esc(scTip)}" title="${esc(scTip)}">${esc(t.scenario_code)}</span>`
          : "";
        return `<div class="${cls}" data-team="${t.team}" title="点击查看晋级路线">
          <span class="rank">${t.rank}</span>
          <span>${flag(t.team_code)} ${tn(t.team_code, t.team)} ${scBadge}</span>
          <span class="gd">${t.gd > 0 ? "+" : ""}${t.gd}</span>
          <span class="pts">${t.points}</span>
        </div>`;
      }).join("");
      return `<div class="group-card"><h3>${g} 组</h3>${rows}</div>`;
    }).join("");
  }

  function renderKnockout() {
    const rounds = [
      { k: "R32", n: "32强" }, { k: "R16", n: "16强" }, { k: "QF", n: "8强" },
      { k: "SF", n: "半决赛" }, { k: "F", n: "决赛" }
    ];
    DOM.knockoutBar.innerHTML = rounds.map((r, i) => {
      const arrow = i < rounds.length - 1 ? '<span class="knockout-arrow">→</span>' : "";
      return `<span class="knockout-node">${r.n} 待定</span>${arrow}`;
    }).join("");
  }

  function filteredMatches() {
    let list = [...WC_DATA.schedule.matches];
    if (state.selectedDay) list = list.filter(m => matchDateKey(m) === state.selectedDay);
    switch (state.filter) {
      case "predicted": list = list.filter(m => matchStatus(m) === "predicted"); break;
      case "pending": list = list.filter(m => matchStatus(m) === "pending"); break;
      case "life": list = list.filter(m => isLifeOrDeath(m)); break;
    }
    return list.sort((a, b) => parseDate(matchDatetime(a)) - parseDate(matchDatetime(b)));
  }

  function renderMatches() {
    const list = filteredMatches();
    if (!list.length) {
      DOM.matchList.innerHTML = '<p style="color:var(--text-muted);padding:20px;">暂无比赛</p>';
      return;
    }

    const finished = list.filter(m => matchStatus(m) === "finished");
    const active = list.filter(m => matchStatus(m) !== "finished");
    let html = "";
    let idx = 0;

    if (finished.length) {
      const collapsed = state.finishedCollapsed;
      html += `<div class="match-group match-group-finished">
        <button type="button" class="match-group-header" data-toggle="finished" aria-expanded="${!collapsed}">
          <span class="match-group-chevron${collapsed ? " collapsed" : ""}">▼</span>
          <span>已结束</span>
          <span class="match-group-count">${finished.length} 场</span>
        </button>
        <div class="match-group-body${collapsed ? " collapsed" : ""}" id="finished-matches-body">
          ${finished.map(m => renderMatchCard(m, idx++)).join("")}
        </div>
      </div>`;
    }

    if (active.length) {
      const label = finished.length ? "未结束 / 待预测" : "全部比赛";
      html += `<div class="match-group match-group-active">
        ${finished.length ? `<div class="match-group-label">${label}（${active.length} 场）</div>` : ""}
        ${active.map(m => renderMatchCard(m, idx++)).join("")}
      </div>`;
    }

    DOM.matchList.innerHTML = html;
  }

  function openSidebar(matchId) {
    const m = WC_DATA.schedule.matches.find(x => x.id === matchId);
    if (!m) return;
    state.selectedMatchId = matchId;
    renderMatches();

    const st = matchStatus(m);
    const pred = state.predictionMap[matchId];
    const homeZh = tn(m.home_code, m.home);
    const awayZh = tn(m.away_code, m.away);

    if (st === "predicted" && pred) {
      const p = pred.prediction;
      const a = pred.analysis || {};
      const dist = (p.score_distribution || []).map(d =>
        `<tr><td>${esc(d.score)}</td><td>${esc(d.reason)}</td><td>${d.probability}%</td></tr>`
      ).join("");
      const steps = a.steps_summary
        ? Object.entries(a.steps_summary).map(([k, v]) =>
            `<li><strong>${k.replace("step", "步骤")}:</strong> ${esc(v)}</li>`
          ).join("")
        : "";
      const scenarioTags = (a.scenario || []).map(s => scenarioBadge(s, false)).join(" ");
      const bttsHtml = p.btts
        ? `<p class="analysis-note">双方进球：是 ${p.btts.yes}% / 否 ${p.btts.no}%</p>`
        : "";
      const wdl = p.win_draw_loss || {};

      DOM.sidebarContent.innerHTML = `
        <h2>${flag(m.home_code)} ${esc(homeZh)} vs ${esc(awayZh)} ${flag(m.away_code)}</h2>
        <p class="venue">${esc(m.venue)} · ${roundZh(m.round)}</p>
        <div class="pred-hero">
          <div class="score">${esc(p.most_likely_score)}</div>
          <div class="prob">最可能比分 · ${p.most_likely_probability}% · ${dominantLabel(pred.dominant_factor)}</div>
          <div class="stars">${stars(pred.confidence || 3)}</div>
        </div>
        <div class="compare-bar">
          <div class="compare-item strength"><div class="label">纯实力</div><div class="val">${esc(p.pure_strength_score)}</div></div>
          <div class="compare-item game"><div class="label">博弈修正</div><div class="val">${esc(p.game_theory_score)}</div></div>
        </div>
        <div class="detail-section analysis-box">
          <h3>📋 预测分析原因 <span class="legend-inline-hint">悬停代号查看释义</span></h3>
          ${scenarioTags ? `<div class="scenario-tags">${scenarioTags}</div>` : ""}
          <p class="analysis-reason">${esc(a.scenario_summary || "暂无情景摘要")}</p>
          ${a.game_theory_adjustment ? `<p class="analysis-note gold">${esc(a.game_theory_adjustment)}</p>` : ""}
          ${a.sequence_notes ? `<p class="analysis-note"><strong>赛序传导（K）：</strong>${esc(a.sequence_notes)}</p>` : ""}
          ${a.cross_match_notes ? `<p class="analysis-note muted">🔗 ${esc(a.cross_match_notes)}</p>` : ""}
        </div>
        ${renderWeightBar(pred.weight_contributions)}
        ${renderPlayerFactors(a.player_factors)}
        <div class="detail-section">
          <h3>比分概率 Top ${(p.score_distribution || []).length || 8}</h3>
          <table class="score-table"><thead><tr><th>比分</th><th>原因</th><th>概率</th></tr></thead><tbody>${dist}</tbody></table>
        </div>
        <div class="detail-section">
          <h3>胜平负</h3>
          <p class="analysis-note">
            主胜 ${wdl.home ?? "—"}% · 平 ${wdl.draw ?? "—"}% · 客胜 ${wdl.away ?? "—"}%
          </p>
          ${bttsHtml}
        </div>
        ${steps ? `<div class="detail-section"><h3>七步分析</h3><ul class="step-list">${steps}</ul></div>` : ""}
        ${renderSidebarPath(a.knockout_path, homeZh, awayZh)}
        <button class="btn-path-sidebar" data-team="${esc(m.home)}">查看 ${esc(homeZh)} 晋级路线</button>
        <button class="btn-path-sidebar" data-team="${esc(m.away)}">查看 ${esc(awayZh)} 晋级路线</button>`;
    } else if (st === "finished" || st === "live") {
      let diff = "";
      if (pred?.prediction) {
        diff = `<div class="detail-section analysis-box">
          <h3>预测对比</h3>
          <p class="analysis-note">预测: <strong>${esc(pred.prediction.most_likely_score)}</strong>
            · 实际: <strong>${esc(m.actual_score || "进行中")}</strong></p>
          ${pred.analysis?.scenario_summary ? `<p class="analysis-reason">${esc(pred.analysis.scenario_summary)}</p>` : ""}
        </div>`;
      }
      DOM.sidebarContent.innerHTML = `
        <h2>${flag(m.home_code)} ${esc(homeZh)} vs ${esc(awayZh)} ${flag(m.away_code)}</h2>
        <p class="venue">${esc(m.venue)}</p>
        <div class="pred-hero">
          <div class="score" style="color:var(--green)">${esc(m.actual_score || "—")}</div>
          <div class="prob">${st === "live" ? "进行中" : "已结束"}</div>
        </div>${diff}`;
    } else {
      DOM.sidebarContent.innerHTML = `
        <h2>${flag(m.home_code)} ${homeZh} vs ${awayZh} ${flag(m.away_code)}</h2>
        <p class="venue">${m.venue} · ${fmtTime(m.datetime)}</p>
        <div class="pending-msg">
          <div class="icon">⏳</div>
          <p><strong>待预测</strong></p>
          <p style="margin-top:12px;font-size:0.85rem;line-height:1.6;">
            ${st === "pending" ? "该比赛在预测窗口内，请重新运行 Skill 生成预测。" : "该比赛尚未进入 2 天预测窗口。"}
          </p>
        </div>`;
    }
    DOM.sidebar.classList.add("open");

    DOM.sidebarContent.querySelectorAll(".btn-path-sidebar").forEach(btn => {
      btn.addEventListener("click", () => showPathForTeam(btn.dataset.team));
    });
  }

  function showPathForTeam(teamEn) {
    const sel = document.getElementById("team-select");
    if (sel) sel.value = teamEn;
    if (window.PathGraph) {
      PathGraph.resetBranch();
      PathGraph.render(teamEn);
    }
    document.getElementById("path-section")?.scrollIntoView({ behavior: "smooth" });
    DOM.sidebar.classList.remove("open");
    state.selectedMatchId = null;
    renderMatches();
  }

  function bindEvents() {
    DOM.filters.forEach(btn => {
      btn.addEventListener("click", () => {
        DOM.filters.forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
        state.filter = btn.dataset.filter;
        renderMatches();
      });
    });

    DOM.timeline.addEventListener("click", e => {
      const day = e.target.closest(".timeline-day");
      if (!day) return;
      state.selectedDay = state.selectedDay === day.dataset.day ? null : day.dataset.day;
      renderTimeline();
      renderMatches();
    });

    DOM.matchList.addEventListener("click", e => {
      const toggle = e.target.closest("[data-toggle='finished']");
      if (toggle) {
        e.stopPropagation();
        state.finishedCollapsed = !state.finishedCollapsed;
        renderMatches();
        return;
      }
      if (e.target.closest(".btn-path-mini")) {
        e.stopPropagation();
        showPathForTeam(e.target.closest(".btn-path-mini").dataset.home);
        return;
      }
      const card = e.target.closest(".match-card");
      if (card) openSidebar(card.dataset.id);
    });

    DOM.sidebarClose.addEventListener("click", () => {
      DOM.sidebar.classList.remove("open");
      state.selectedMatchId = null;
      renderMatches();
    });
  }

  if (typeof WC_DATA !== "undefined") {
    init();
  } else {
    document.body.innerHTML = "<p style='padding:40px;color:#fff;'>未找到 WC_DATA，请先运行 python3 scripts/inject_dashboard.py</p>";
  }
})();
