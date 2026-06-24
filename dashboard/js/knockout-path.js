/**
 * 淘汰赛路径胜率与战意权重
 * 根据小组可能名次 → R32对手 → 预估胜率 → 影响当前比赛战意
 */
(function () {
  "use strict";

  const tn = (c, n) => window.teamName(c || n);

  function strength(teamEn, code) {
    const s = WC_DATA.teamStrength;
    if (!s) return 60;
    if (code && s.ratings[code]) return s.ratings[code];
    if (s.by_name && s.by_name[teamEn]) return s.by_name[teamEn];
    return 55;
  }

  function winProb(teamEn, teamCode, oppEn, oppCode) {
    const a = strength(teamEn, teamCode);
    const b = strength(oppEn, oppCode);
    const diff = a - b;
    return Math.round(100 / (1 + Math.pow(10, -diff / 35)) * 10) / 10;
  }

  function projectedGroupRank(groupId) {
    const teams = WC_DATA.standings.groups[groupId];
    if (!teams) return {};
    const out = {};
    teams.forEach(t => {
      out[t.rank] = { team: t.team, code: t.team_code, points: t.points };
    });
    return out;
  }

  function resolveSlot(slot) {
    if (!slot || slot.length < 2) return null;
    const rank = parseInt(slot.charAt(0), 10);
    const g = slot.charAt(1);
    const proj = projectedGroupRank(g);
    if (rank <= 2 && proj[rank]) return proj[rank];
    if (rank === 3) {
      return { team: "Best Third Place", code: "TBD", points: 3, isThird: true };
    }
    return null;
  }

  function r32Opponent(groupId, finishRank) {
    const bracket = WC_DATA.knockoutBracket?.r32_pairing;
    if (!bracket) return null;
    const key = finishRank === 3 ? null : `${groupId}${finishRank}`;
    if (finishRank === 3) {
      return {
        slot: "3rd",
        opponent: { team: "Best Third Place", code: "TBD", isThird: true },
        opponentZh: "待定第三名",
        note: "最佳第三名对阵某组第一（对手通常弱于小组第二路径）",
      };
    }
    const slot = bracket[key];
    if (!slot) return null;
    const opp = resolveSlot(slot);
    return {
      slot,
      opponent: opp,
      opponentZh: opp ? (opp.isThird ? "待定第三名" : tn(opp.code, opp.team)) : "待定",
    };
  }

  function analyzePaths(teamEn, teamCode, groupId) {
    const paths = [];
    [1, 2, 3].forEach(rank => {
      const r32 = r32Opponent(groupId, rank);
      if (!r32) return;
      let prob;
      if (r32.opponent?.isThird) {
        prob = winProb(teamEn, teamCode, "Third", "TBD");
        const myStr = strength(teamEn, teamCode);
        const thirdStr = WC_DATA.knockoutBracket?.third_place_strength || 55;
        prob = Math.round(100 / (1 + Math.pow(10, -(myStr - thirdStr) / 35)) * 10) / 10;
      } else if (r32.opponent) {
        prob = winProb(teamEn, teamCode, r32.opponent.team, r32.opponent.code);
      } else {
        prob = 50;
      }
      paths.push({
        rank,
        label: WC_DATA.knockoutBracket?.rank_labels?.[String(rank)] || `第${rank}`,
        r32Opponent: r32.opponentZh,
        r32Slot: r32.slot,
        winProb: prob,
      });
    });
    return paths;
  }

  function effortWeight(teamEn, teamCode, groupId, scenarioCode) {
    const paths = analyzePaths(teamEn, teamCode, groupId);
    if (paths.length < 2) return { modifier: 0, note: "数据不足", paths };

    const p1 = paths.find(p => p.rank === 1)?.winProb || 50;
    const p2 = paths.find(p => p.rank === 2)?.winProb || 50;
    const delta = p2 - p1;
    let modifier = 0;
    let note = "";
    let preferRank = null;

    if (["B", "C", "D", "E", "I"].includes(scenarioCode) && delta > 8) {
      modifier = -Math.min(15, Math.round(delta / 2));
      preferRank = 2;
      note = `小组第二的32强胜率(${p2}%)高于第一(${p1}%)，已出线时可能留力，战意下调`;
    } else if (["B", "C", "D", "E", "I"].includes(scenarioCode) && delta < -8) {
      modifier = Math.min(10, Math.round(-delta / 3));
      preferRank = 1;
      note = `小组第一路径32强胜率(${p1}%)更优，但仍可能轮换`;
    } else if (scenarioCode === "A") {
      modifier = Math.min(8, Math.round(Math.max(p1, p2) / 15));
      note = `生死战优先出线，路径权重次要（32强胜率 ${Math.max(p1,p2)}% 可作参考）`;
    } else {
      note = `两路径32强胜率接近（第一${p1}% vs 第二${p2}%），路径因素权重低`;
    }

    return { modifier, note, paths, preferRank, delta, p1, p2 };
  }

  function bestPathSummary(paths) {
    if (!paths?.length) return "";
    const best = paths.reduce((a, b) => a.winProb > b.winProb ? a : b);
    return `最优路径：${best.label} → 32强 vs ${best.r32Opponent}（胜率 ${best.winProb}%）`;
  }

  window.KnockoutPath = {
    analyzePaths,
    effortWeight,
    winProb,
    r32Opponent,
    bestPathSummary,
  };
})();
