/**
 * BracketEngine — 根据比分（已赛/预测/用户修改）计算积分榜、出线、淘汰赛对阵
 */
(function () {
  "use strict";

  const tn = (c, n) => window.teamName(c || n);

  let overrides = {};
  let predictionMap = {};

  function init() {
    overrides = JSON.parse(localStorage.getItem("wc_bracket_overrides") || "{}");
    predictionMap = {};
    (WC_DATA.predictions?.matches || []).forEach(p => { predictionMap[p.id] = p; });
  }

  function parseScore(s) {
    if (!s || s === "待预测" || s === "-") return null;
    const p = String(s).trim().split("-").map(Number);
    return p.length === 2 && !isNaN(p[0]) && !isNaN(p[1]) ? { h: p[0], a: p[1] } : null;
  }

  function getMatchScore(m) {
    if (overrides[m.id]) return { score: overrides[m.id], source: "user" };
    if (m.actual_score) return { score: m.actual_score, source: "finished" };
    const pred = predictionMap[m.id];
    if (pred) return { score: pred.prediction.most_likely_score, source: "predicted" };
    return { score: null, source: "pending" };
  }

  function setScore(matchId, score) {
    if (!score) delete overrides[matchId];
    else overrides[matchId] = score;
    localStorage.setItem("wc_bracket_overrides", JSON.stringify(overrides));
  }

  function resetOverrides() {
    overrides = {};
    localStorage.removeItem("wc_bracket_overrides");
  }

  function initTeamsFromStandings(groupId) {
    return (WC_DATA.standings.groups[groupId] || []).map(t => ({
      team: t.team, code: t.team_code,
      played: 0, won: 0, drawn: 0, lost: 0,
      gf: 0, ga: 0, gd: 0, points: 0,
    }));
  }

  function applyScore(teams, home, away, sc) {
    teams.forEach(t => {
      if (t.team === home) {
        t.played++; t.gf += sc.h; t.ga += sc.a; t.gd = t.gf - t.ga;
        if (sc.h > sc.a) { t.won++; t.points += 3; }
        else if (sc.h === sc.a) { t.drawn++; t.points += 1; }
        else t.lost++;
      } else if (t.team === away) {
        t.played++; t.gf += sc.a; t.ga += sc.h; t.gd = t.gf - t.ga;
        if (sc.a > sc.h) { t.won++; t.points += 3; }
        else if (sc.h === sc.a) { t.drawn++; t.points += 1; }
        else t.lost++;
      }
    });
  }

  function computeGroupStandings(groupId) {
    const teams = initTeamsFromStandings(groupId);
    WC_DATA.schedule.matches
      .filter(m => m.group === groupId)
      .forEach(m => {
        const { score } = getMatchScore(m);
        const sc = parseScore(score);
        if (sc) applyScore(teams, m.home, m.away, sc);
      });
    return teams.sort((a, b) => b.points - a.points || b.gd - a.gd || b.gf - a.gf)
      .map((t, i) => ({ ...t, rank: i + 1, group: groupId }));
  }

  function computeAllStandings() {
    const groups = {};
    const groupIds = [...new Set(WC_DATA.schedule.matches.filter(m => m.group).map(m => m.group))].sort();
    groupIds.forEach(g => { groups[g] = computeGroupStandings(g); });
    return groups;
  }

  function slotKey(group, rank) {
    return `${group}${rank}`;
  }

  function resolveSlot(slot, allStandings, thirdPool) {
    if (!slot) return null;
    const rank = parseInt(slot.charAt(0), 10);
    const g = slot.charAt(1);
    if (rank <= 2) {
      const t = allStandings[g]?.find(x => x.rank === rank);
      return t ? { ...t, slot, type: rank === 1 ? "winner" : "runner" } : null;
    }
    if (rank === 3 && thirdPool?.length) {
      const t = thirdPool[0];
      return t ? { ...t, slot, type: "third" } : null;
    }
    return null;
  }

  function pickBestThirdPlaces(allStandings, count) {
    const thirds = [];
    Object.entries(allStandings).forEach(([g, teams]) => {
      const t = teams.find(x => x.rank === 3);
      if (t && t.points > 0) thirds.push({ ...t, group: g });
    });
    return thirds.sort((a, b) => b.points - a.points || b.gd - a.gd || b.gf - a.gf).slice(0, count);
  }

  function strength(code, team) {
    const s = WC_DATA.teamStrength;
    return (s?.ratings?.[code]) || (s?.by_name?.[team]) || 55;
  }

  function pickWinner(home, away, scoreStr) {
    const sc = parseScore(scoreStr);
    if (sc) {
      if (sc.h > sc.a) return home;
      if (sc.a > sc.h) return away;
      return strength(home.code, home.team) >= strength(away.code, away.team) ? home : away;
    }
    return strength(home.code, home.team) >= strength(away.code, away.team) ? home : away;
  }

  function buildR32Matches(allStandings) {
    const pairing = WC_DATA.knockoutBracket?.r32_pairing || {};
    const thirds = pickBestThirdPlaces(allStandings, 8);
    const usedThirds = new Set();
    const matches = [];
    const seen = new Set();

    Object.keys(pairing).sort().forEach(key => {
      const oppSlot = pairing[key];
      const pairKey = [key, oppSlot].sort().join("|");
      if (seen.has(pairKey)) return;
      seen.add(pairKey);

      const g = key.charAt(0);
      const rank = parseInt(key.charAt(1), 10);
      const team = allStandings[g]?.find(t => t.rank === rank);
      if (!team) return;

      const availThirds = thirds.filter(t => !usedThirds.has(t.team));
      let opp = resolveSlot(oppSlot, allStandings, availThirds);
      if (!opp) return;
      if (opp.type === "third") usedThirds.add(opp.team);

      matches.push({
        id: `R32-${matches.length + 1}`,
        round: "R32",
        home: team, away: opp,
        homeSlot: key, awaySlot: oppSlot,
        score: autoKnockoutScore(team, opp).score,
        source: "generated",
      });
    });

    return matches;
  }

  function buildKnockoutRound(prevMatches, roundName, idPrefix, nextMap) {
    const out = [];
    const pairs = [];
    for (let i = 0; i < prevMatches.length; i += 2) {
      pairs.push([prevMatches[i], prevMatches[i + 1]]);
    }
    pairs.forEach((pair, i) => {
      if (!pair[0] || !pair[1]) return;
      const w1 = pickWinner(pair[0].home, pair[0].away, pair[0].score);
      const w2 = pickWinner(pair[1].home, pair[1].away, pair[1].score);
      if (!w1 || !w2) return;
      const id = `${idPrefix}-${i + 1}`;
      const koScore = autoKnockoutScore(w1, w2);
      out.push({
        id, round: roundName,
        home: w1, away: w2,
        score: koScore.score, source: koScore.source,
        feedsFrom: [pair[0].id, pair[1].id],
      });
    });
    return out;
  }

  function autoKnockoutScore(home, away) {
    const sh = strength(home.code, home.team);
    const sa = strength(away.code, away.team);
    if (sh > sa + 5) return { score: "2-1", source: "strength" };
    if (sa > sh + 5) return { score: "1-2", source: "strength" };
    return { score: "1-1", source: "strength" };
  }

  function buildFullKnockout(r32) {
    const r16 = buildKnockoutRound(r32, "R16", "R16", WC_DATA.knockoutBracket?.r32_to_r16);
    const qf = buildKnockoutRound(r16, "QF", "QF", WC_DATA.knockoutBracket?.r16_to_qf);
    const sf = buildKnockoutRound(qf, "SF", "SF", WC_DATA.knockoutBracket?.qf_to_sf);
    const final = buildKnockoutRound(sf, "F", "F", WC_DATA.knockoutBracket?.sf_to_f);
    return { R32: r32, R16: r16, QF: qf, SF: sf, F: final };
  }

  function buildTree() {
    const allStandings = computeAllStandings();
    const groupIds = Object.keys(allStandings).sort();
    const groupMatches = {};
    groupIds.forEach(g => {
      groupMatches[g] = WC_DATA.schedule.matches
        .filter(m => m.group === g)
        .sort((a, b) => (a.round || "").localeCompare(b.round || ""));
    });
    const r32 = buildR32Matches(allStandings);
    const knockout = buildFullKnockout(r32);
    const thirds = pickBestThirdPlaces(allStandings, 8);
    return { allStandings, groupMatches, groupIds, thirds, knockout, r32 };
  }

  window.BracketEngine = {
    init, getMatchScore, setScore, resetOverrides,
    parseScore, computeAllStandings, buildTree, pickWinner, strength,
    get overrides() { return overrides; },
  };
})();
