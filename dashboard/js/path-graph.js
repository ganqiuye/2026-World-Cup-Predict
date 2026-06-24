/**
 * 晋级路线：小组赛（已赛+预测）→ 路径权重 → 淘汰赛
 */
(function () {
  "use strict";

  const tn = (c, n) => window.teamName(c || n);
  const fg = (c) => (window.FLAG && window.FLAG[c]) ? window.FLAG[c] + " " : "";

  const RESULT = {
    win:  { label: "胜", gf: 2, ga: 1, cls: "branch-win" },
    draw: { label: "平", gf: 1, ga: 1, cls: "branch-draw" },
    loss: { label: "负", gf: 0, ga: 2, cls: "branch-loss" },
  };

  const KNOCKOUT_ROUNDS = [
    { key: "R32", name: "32强" },
    { key: "R16", name: "16强" },
    { key: "QF",  name: "8强" },
    { key: "SF",  name: "半决赛" },
    { key: "F",   name: "决赛" },
  ];

  let predictionMap = {};
  /** matchId → predicted | win | draw | loss */
  let matchBranches = {};

  function initMaps() {
    predictionMap = {};
    (WC_DATA.predictions?.matches || []).forEach(p => { predictionMap[p.id] = p; });
  }

  function matchTime(m) {
    return new Date(m.datetime_cst || m.datetime).getTime();
  }

  function fmtKickoff(m) {
    const iso = m.datetime_cst || m.datetime;
    if (!iso) return "";
    return new Date(iso).toLocaleString("zh-CN", {
      month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit",
    });
  }

  function parseScore(s) {
    if (!s) return null;
    const p = s.split("-").map(Number);
    return p.length === 2 ? { h: p[0], a: p[1] } : null;
  }

  function roundNum(r) {
    const m = (r || "").match(/R(\d)/);
    return m ? +m[1] : 0;
  }

  function roundLabel(r) {
    return (r || "").replace("Group Stage R1", "第1轮").replace("Group Stage R2", "第2轮").replace("Group Stage R3", "第3轮");
  }

  function groupMatches(groupId) {
    return WC_DATA.schedule.matches
      .filter(m => m.group === groupId)
      .sort((a, b) => roundNum(a.round) - roundNum(b.round) || a.datetime.localeCompare(b.datetime));
  }

  function teamMatches(groupId, teamEn) {
    return groupMatches(groupId).filter(m => m.home === teamEn || m.away === teamEn);
  }

  function upcomingTeamMatch(groupId, teamEn) {
    return teamMatches(groupId, teamEn).find(m => !m.actual_score);
  }

  function findTeamInfo(teamEn) {
    for (const [g, list] of Object.entries(WC_DATA.standings.groups || {})) {
      const t = list.find(x => x.team === teamEn);
      if (t) return { ...t, group: g };
    }
    return null;
  }

  function cloneStandings(groupId) {
    return (WC_DATA.standings.groups[groupId] || []).map(t => ({ ...t }));
  }

  function sortGroup(teams) {
    return teams.sort((a, b) => b.points - a.points || b.gd - a.gd || b.gf - a.gf)
      .map((t, i) => ({ ...t, rank: i + 1 }));
  }

  function applyScoreToTeams(teams, home, away, sc) {
    teams.forEach(t => {
      if (t.team === home) {
        t.played++; t.gf += sc.h; t.ga += sc.a; t.gd = t.gf - t.ga;
        if (sc.h > sc.a) t.won++;
        else if (sc.h === sc.a) t.drawn++;
        else t.lost++;
        t.points += sc.h > sc.a ? 3 : sc.h === sc.a ? 1 : 0;
      } else if (t.team === away) {
        t.played++; t.gf += sc.a; t.ga += sc.h; t.gd = t.gf - t.ga;
        if (sc.a > sc.h) t.won++;
        else if (sc.h === sc.a) t.drawn++;
        else t.lost++;
        t.points += sc.a > sc.h ? 3 : sc.h === sc.a ? 1 : 0;
      }
    });
  }

  function scoreFromBranch(m, teamEn, branch) {
    const cfg = RESULT[branch];
    const isHome = m.home === teamEn;
    return isHome ? { h: cfg.gf, a: cfg.ga } : { h: cfg.ga, a: cfg.gf };
  }

  /** 同组其他场次：胜/平/负按主队视角 */
  function scoreFromHomeBranch(m, branch) {
    const cfg = RESULT[branch];
    return { h: cfg.gf, a: cfg.ga };
  }

  function branchScoreForMatch(m, teamEn, upcoming, branch) {
    if (upcoming && m.id === upcoming.id) return scoreFromBranch(m, teamEn, branch);
    return scoreFromHomeBranch(m, branch);
  }

  function currentBranch(m) {
    return matchBranches[m.id] || "predicted";
  }

  /** 开球时间不晚于本队下场 → 可能影响本队当轮战意 */
  function isOtherMatchEditable(other, upcoming) {
    if (!upcoming || other.actual_score) return false;
    return matchTime(other) <= matchTime(upcoming);
  }

  function scoreFromPrediction(m, pred) {
    return parseScore(pred?.prediction?.most_likely_score) || { h: 1, a: 1 };
  }

  function resolveMatchScore(m, teamEn, upcoming) {
    if (m.actual_score) return { score: m.actual_score, source: "finished", sc: parseScore(m.actual_score) };
    const branch = currentBranch(m);
    if (branch !== "predicted") {
      const sc = branchScoreForMatch(m, teamEn, upcoming, branch);
      return { score: `${sc.h}-${sc.a}`, source: "branch", sc, branch };
    }
    const pred = predictionMap[m.id];
    if (pred) {
      const sc = scoreFromPrediction(m, pred);
      const kp = pred.analysis?.knockout_path;
      return {
        score: pred.prediction.most_likely_score, source: "predicted", sc,
        prob: pred.prediction.most_likely_probability,
        pathNote: kp?.effort_note,
        pathWeight: kp?.effort_modifier,
      };
    }
    return { score: "待预测", source: "pending", sc: null };
  }

  function simulateGroupEnd(groupId, teamEn) {
    const teams = cloneStandings(groupId);
    const all = groupMatches(groupId);
    const upcoming = upcomingTeamMatch(groupId, teamEn);

    all.forEach(m => {
      if (m.actual_score) {
        applyScoreToTeams(teams, m.home, m.away, parseScore(m.actual_score));
        return;
      }
      const branch = currentBranch(m);
      let sc = null;
      if (branch !== "predicted") {
        sc = branchScoreForMatch(m, teamEn, upcoming, branch);
      } else if (predictionMap[m.id]) {
        sc = scoreFromPrediction(m, predictionMap[m.id]);
      }
      if (sc) applyScoreToTeams(teams, m.home, m.away, sc);
    });

    return sortGroup(teams);
  }

  function evalQualify(team, sorted) {
    const row = sorted.find(t => t.team === team.team) || {};
    const rank = row.rank || 4;
    const pts = row.points || 0;
    const gd = row.gd || 0;
    if (rank <= 2) return { rank, pts, gd, status: `直接晋级（小组第${rank}）`, out: false, seed: rank === 1 ? "小组第一" : "小组第二" };
    if (rank === 3 && pts >= 4) return { rank, pts, gd, status: "可能以最佳第三名晋级", out: false, seed: "最佳第三名" };
    if (rank === 3) return { rank, pts, gd, status: "第三名，出线希望渺茫", out: true, seed: null };
    return { rank, pts, gd, status: "小组出局", out: true, seed: null };
  }

  function renderPathWeightAnalysis(info, outcome, sorted) {
    if (!window.KnockoutPath) return "";
    const ew = KnockoutPath.effortWeight(info.team, info.team_code, info.group, info.scenario_code);
    const simRank = outcome.rank;
    const activePath = ew.paths.find(p => p.rank === simRank) || ew.paths[0];

    let html = `<div class="path-phase path-weight-phase">
      <div class="phase-title">🎯 淘汰赛路径权重（情景 J）</div>
      <p class="path-weight-note">${ew.note}</p>
      ${ew.modifier ? `<p class="path-weight-mod">战意修正：<strong>${ew.modifier > 0 ? "+" : ""}${ew.modifier}%</strong>
        ${ew.preferRank ? ` · 倾向争夺小组第${ew.preferRank}` : ""}</p>` : ""}
      <table class="path-r32-table">
        <thead><tr><th>小组名次</th><th>32强对手</th><th>预估胜率</th><th>说明</th></tr></thead>
        <tbody>${ew.paths.map(p => {
          const isActive = p.rank === simRank;
          const isBest = p.winProb === Math.max(...ew.paths.map(x => x.winProb));
          return `<tr class="${isActive ? "row-active" : ""}${isBest ? " row-best" : ""}">
            <td>${p.label}${isActive ? " ← 当前模拟" : ""}</td>
            <td>${fg(p.r32Opponent === "待定第三名" ? "TBD" : "")}${p.r32Opponent}</td>
            <td><strong>${p.winProb}%</strong></td>
            <td>${isBest ? "路径最优" : ""}${ew.preferRank === p.rank ? " · 战意倾向" : ""}</td>
          </tr>`;
        }).join("")}</tbody>
      </table>`;

    if (activePath && !outcome.out) {
      html += `<div class="next-opponent-box">
        <div class="next-opponent-title">模拟出线后下一场（32强）</div>
        <div class="next-opponent-match">${fg(info.team_code)}${tn(info.team_code, info.team)}
          vs ${fg(activePath.r32Opponent)}${activePath.r32Opponent}</div>
        <div class="next-opponent-prob">预估胜率 <strong>${activePath.winProb}%</strong>
          · ${activePath.winProb >= 60 ? "有希望晋级16强" : activePath.winProb >= 45 ? "势均力敌" : "晋级难度较大"}</div>
      </div>`;
    }
    html += "</div>";
    return html;
  }

  function buildKnockoutPath(outcome, teamZh, info) {
    if (outcome.out || !window.KnockoutPath) {
      return KNOCKOUT_ROUNDS.map(r => ({ ...r, desc: "未能晋级", active: false, opponent: null }));
    }
    const r32 = KnockoutPath.r32Opponent(info.group, outcome.rank);
    const oppZh = r32?.opponentZh || "待定";
    const paths = KnockoutPath.analyzePaths(info.team, info.team_code, info.group);
    const active = paths.find(p => p.rank === outcome.rank);
    const winP = active?.winProb || 50;

    return KNOCKOUT_ROUNDS.map((r, i) => {
      if (i === 0) {
        return {
          ...r, active: true,
          desc: `vs ${oppZh}`,
          sub: `预估胜率 ${winP}%`,
          opponent: oppZh,
        };
      }
      if (i === 1) return { ...r, active: winP >= 50, desc: winP >= 50 ? "若32强过关" : "难度较大", sub: "" };
      return { ...r, active: false, desc: "若持续晋级", sub: "" };
    });
  }

  function renderBranchPicker(m, opts) {
    const { label, isTeamMatch } = opts;
    const pred = predictionMap[m.id];
    const cur = currentBranch(m);
    const winLabel = isTeamMatch ? "胜" : "主胜";
    const lossLabel = isTeamMatch ? "负" : "客胜";
    return `<div class="branch-picker branch-picker-inline${isTeamMatch ? "" : " branch-picker-other"}">
      <span class="picker-label">${label}</span>
      <button type="button" class="branch-btn${cur === "predicted" ? " active" : ""}" data-match-id="${m.id}" data-branch="predicted">📊 预测${pred ? " " + pred.prediction.most_likely_score : ""}</button>
      <button type="button" class="branch-btn branch-win${cur === "win" ? " active" : ""}" data-match-id="${m.id}" data-branch="win">${winLabel}</button>
      <button type="button" class="branch-btn branch-draw${cur === "draw" ? " active" : ""}" data-match-id="${m.id}" data-branch="draw">平</button>
      <button type="button" class="branch-btn branch-loss${cur === "loss" ? " active" : ""}" data-match-id="${m.id}" data-branch="loss">${lossLabel}</button>
    </div>`;
  }

  function renderGroupTimeline(groupId, teamEn) {
    const myMatches = teamMatches(groupId, teamEn);
    const allGroup = groupMatches(groupId);
    const upcoming = upcomingTeamMatch(groupId, teamEn);
    let html = '<div class="path-phase"><div class="phase-title">📋 小组赛</div><div class="path-timeline">';

    myMatches.forEach(m => {
      const isHome = m.home === teamEn;
      const isUpcoming = upcoming && m.id === upcoming.id;
      const resolved = resolveMatchScore(m, teamEn, upcoming);
      const badge = { finished: "已赛", predicted: "预测", branch: "假设", pending: "待预测" }[resolved.source];
      const opp = m.home === teamEn ? m.away : m.home;
      const oppCode = m.home === teamEn ? m.away_code : m.home_code;

      html += `<div class="path-node node-${resolved.source}${isUpcoming ? " node-upcoming" : ""}">
        <div class="node-badge">${badge}</div>
        <div class="node-round">${roundLabel(m.round)}${isUpcoming ? ` · ${fmtKickoff(m)}` : ""}</div>
        <div class="node-match">${fg(m.home_code)}${tn(m.home_code,m.home)} ${resolved.score} ${tn(m.away_code,m.away)}${fg(m.away_code)}
          ${isHome ? "（主）" : "（客）"}</div>
        ${resolved.prob ? `<div class="node-prob">预测概率 ${resolved.prob}%</div>` : ""}
        ${resolved.pathNote ? `<div class="node-path">🎯 ${resolved.pathNote}</div>` : ""}
        ${resolved.branch ? `<div class="node-prob">假设${isTeamMatchLabel(resolved.branch, true)}</div>` : ""}
        ${isUpcoming ? renderBranchPicker(m, { label: `本场 vs ${tn(oppCode, opp)} 结果假设：`, isTeamMatch: true }) : ""}
      </div>`;
    });

    html += "</div>";
    const others = allGroup.filter(m => !m.actual_score && m.home !== teamEn && m.away !== teamEn);
    if (others.length) {
      const early = others.filter(m => isOtherMatchEditable(m, upcoming));
      const late = others.filter(m => !isOtherMatchEditable(m, upcoming));

      if (early.length) {
        html += `<p class="other-matches-hint">以下场次<strong>开球不晚于本队下场</strong>，其结果可能影响本队当轮进攻积极性（情景 F/K），可切换胜/平/负假设。</p>`;
        html += '<div class="path-subtitle">同组关联场次（可假设）</div><div class="path-timeline secondary">';
        early.forEach(m => {
          const resolved = resolveMatchScore(m, teamEn, upcoming);
          const badge = resolved.source === "branch" ? "假设" : resolved.source === "predicted" ? "预测" : "待预测";
          html += `<div class="path-node node-editable node-${resolved.source}">
            <div class="node-badge">${badge}</div>
            <div class="node-round">${roundLabel(m.round)} · ${fmtKickoff(m)}</div>
            <div class="node-match">${fg(m.home_code)}${tn(m.home_code,m.home)} ${resolved.score} ${tn(m.away_code,m.away)}</div>
            ${resolved.prob && resolved.source === "predicted" ? `<div class="node-prob">预测概率 ${resolved.prob}%</div>` : ""}
            ${resolved.branch ? `<div class="node-prob">假设${isTeamMatchLabel(resolved.branch, false)}</div>` : ""}
            ${renderBranchPicker(m, { label: `${tn(m.home_code, m.home)} vs ${tn(m.away_code, m.away)}：`, isTeamMatch: false })}
          </div>`;
        });
        html += "</div>";
      }

      if (late.length) {
        html += `<p class="other-matches-hint other-matches-hint-muted">以下场次<strong>开球晚于本队下场</strong>，不影响本队当轮战意，固定采用模型预测（仍计入最终积分榜模拟）。</p>`;
        html += '<div class="path-subtitle">同组后续场次（预测·只读）</div><div class="path-timeline secondary">';
        late.forEach(m => {
          const resolved = resolveMatchScore(m, teamEn, upcoming);
          const badge = resolved.source === "predicted" ? "预测·固定" : "待预测";
          html += `<div class="path-node node-readonly node-${resolved.source}">
            <div class="node-badge">${badge}</div>
            <div class="node-round">${roundLabel(m.round)} · ${fmtKickoff(m)}</div>
            <div class="node-match">${fg(m.home_code)}${tn(m.home_code,m.home)} ${resolved.score} ${tn(m.away_code,m.away)}</div>
            ${resolved.prob ? `<div class="node-prob">预测概率 ${resolved.prob}%</div>` : ""}
            <div class="node-readonly-note">⏱ 开球较晚，不影响本场战意</div>
          </div>`;
        });
        html += "</div>";
      }
    }
    html += "</div>";
    return html;
  }

  function isTeamMatchLabel(branch, forTeam) {
    if (!forTeam) {
      return { win: "主胜", draw: "平局", loss: "客胜" }[branch] || "";
    }
    return RESULT[branch]?.label || "";
  }

  function renderStandingsTable(sorted, teamEn) {
    return `<div class="path-phase"><div class="phase-title">📊 小组赛后积分榜（模拟）</div>
      <table class="path-standings"><thead><tr><th>#</th><th>球队</th><th>分</th><th>GD</th></tr></thead><tbody>
      ${sorted.map(t => `<tr class="${t.team === teamEn ? "highlight" : ""}${t.rank <= 2 ? " qualified" : ""}">
        <td>${t.rank}</td><td>${fg(t.team_code)}${tn(t.team_code,t.team)}</td><td>${t.points}</td><td>${t.gd >= 0 ? "+" : ""}${t.gd}</td>
      </tr>`).join("")}
      </tbody></table></div>`;
  }

  function renderKnockoutPhase(outcome, teamZh, info) {
    const steps = buildKnockoutPath(outcome, teamZh, info);
    const cls = outcome.out ? "knockout-out" : "knockout-in";
    return `<div class="path-phase ${cls}"><div class="phase-title">🏆 淘汰赛</div>
      <div class="knockout-status">${outcome.status}</div>
      <div class="knockout-flow">${steps.map((s, i) => `
        <div class="ko-step ${s.active ? "active" : ""}${outcome.out ? " dim" : ""}">
          <div class="ko-round">${s.name}</div>
          ${s.opponent ? `<div class="ko-opponent">${s.desc}</div>` : `<div class="ko-desc">${s.desc}</div>`}
          ${s.sub ? `<div class="ko-sub">${s.sub}</div>` : ""}
          <div class="ko-connector">${i < steps.length - 1 ? "↓" : ""}</div>
        </div>`).join("")}
      </div></div>`;
  }

  function renderGraph(teamEn) {
    const container = document.getElementById("path-graph-container");
    if (!container) return;

    const info = findTeamInfo(teamEn);
    if (!info) {
      container.innerHTML = '<p class="path-empty">未找到该队数据</p>';
      return;
    }

    const groupId = info.group;
    const teamZh = tn(info.team_code, info.team);
    const sorted = simulateGroupEnd(groupId, teamEn);
    const outcome = evalQualify(info, sorted);

    let html = `<div class="path-header">
      <h3>${fg(info.team_code)}${teamZh} · ${groupId}组 晋级全景</h3>
      <p class="path-current">当前：第 ${info.rank} 名 · ${info.points} 分 · 净胜球 ${info.gd >= 0 ? "+" : ""}${info.gd}</p>
      ${upcomingTeamMatch(groupId, teamEn) ? `<p class="path-cross">下场：${fmtKickoff(upcomingTeamMatch(groupId, teamEn))} · 同组同时/更早开球场次可假设结果</p>` : ""}
    </div>`;

    html += renderPathWeightAnalysis(info, outcome, sorted);
    html += renderGroupTimeline(groupId, teamEn);
    html += renderStandingsTable(sorted, teamEn);
    html += renderKnockoutPhase(outcome, teamZh, info);

    container.innerHTML = html;
    container.querySelectorAll(".branch-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        const mid = btn.dataset.matchId;
        if (mid) matchBranches[mid] = btn.dataset.branch;
        renderGraph(teamEn);
      });
    });
  }

  function populateTeamSelect() {
    const sel = document.getElementById("team-select");
    if (!sel) return;
    const teams = [];
    Object.entries(WC_DATA.standings.groups || {}).forEach(([g, list]) => {
      list.forEach(t => teams.push({ ...t, group: g }));
    });
    teams.sort((a, b) => a.group.localeCompare(b.group) || a.rank - b.rank);
    sel.innerHTML = teams.map(t =>
      `<option value="${t.team}">${t.group}组 · ${tn(t.team_code, t.team)}（${t.points}分 第${t.rank}）</option>`
    ).join("");
  }

  window.PathGraph = {
    init() {
      initMaps();
      populateTeamSelect();
      document.getElementById("btn-gen-path")?.addEventListener("click", () => {
        matchBranches = {};
        renderGraph(document.getElementById("team-select").value);
      });
      document.getElementById("groups-grid")?.addEventListener("click", e => {
        const row = e.target.closest(".standing-row");
        if (!row?.dataset.team) return;
        matchBranches = {};
        document.getElementById("team-select").value = row.dataset.team;
        renderGraph(row.dataset.team);
        document.getElementById("path-section")?.scrollIntoView({ behavior: "smooth" });
      });
    },
    render(teamEn) { initMaps(); renderGraph(teamEn); },
    resetBranch() { matchBranches = {}; },
  };
})();
