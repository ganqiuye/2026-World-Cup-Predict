/** 国旗 emoji */
window.FLAG = {
  GER: "🇩🇪", JPN: "🇯🇵", ESP: "🇪🇸", CRC: "🇨🇷", BRA: "🇧🇷", MAR: "🇲🇦",
  FRA: "🇫🇷", NGA: "🇳🇬", SCO: "🏴󠁧󠁢󠁳󠁣󠁴󠁿", HAI: "🇭🇹", MEX: "🇲🇽", USA: "🇺🇸",
  ARG: "🇦🇷", AUT: "🇦🇹", JOR: "🇯🇴", ALG: "🇩🇿", NOR: "🇳🇴", SEN: "🇸🇳", IRQ: "🇮🇶",
  ENG: "🏴󠁧󠁢󠁥󠁮󠁧󠁿", GHA: "🇬🇭", PAN: "🇵🇦", CRO: "🇭🇷", POR: "🇵🇹", UZB: "🇺🇿",
  COL: "🇨🇴", COD: "🇨🇩", SUI: "🇨🇭", CAN: "🇨🇦", BIH: "🇧🇦", QAT: "🇶🇦",
  CZE: "🇨🇿", KOR: "🇰🇷", RSA: "🇿🇦", NED: "🇳🇱", ECU: "🇪🇨", POL: "🇵🇱",
  SAU: "🇸🇦", PER: "🇵🇪", NZL: "🇳🇿", TUN: "🇹🇳", CUW: "🇨🇼", CIV: "🇨🇮",
  SWE: "🇸🇪", AUS: "🇦🇺", PRY: "🇵🇾", TUR: "🇹🇷", BEL: "🇧🇪", IRN: "🇮🇷",
  EGY: "🇪🇬", URU: "🇺🇾", CPV: "🇨🇻", TBD: "❓"
};

/** 球队中文名映射（按 ISO 代码） */
window.TEAM_ZH = {
  MEX: "墨西哥", RSA: "南非", KOR: "韩国", CZE: "捷克",
  CAN: "加拿大", SUI: "瑞士", BIH: "波黑", QAT: "卡塔尔",
  BRA: "巴西", MAR: "摩洛哥", SCO: "苏格兰", HAI: "海地",
  FRA: "法国", SEN: "塞内加尔", IRQ: "伊拉克", NOR: "挪威",
  ARG: "阿根廷", AUT: "奥地利", JOR: "约旦", ALG: "阿尔及利亚",
  COL: "哥伦比亚", COD: "刚果（金）", POR: "葡萄牙", UZB: "乌兹别克斯坦",
  ENG: "英格兰", GHA: "加纳", PAN: "巴拿马", CRO: "克罗地亚",
  GER: "德国", JPN: "日本", ESP: "西班牙", CRC: "哥斯达黎加",
  USA: "美国", NGA: "尼日利亚", PER: "秘鲁", NZL: "新西兰",
  IRN: "伊朗", POL: "波兰", ECU: "厄瓜多尔", SAU: "沙特阿拉伯",
  TUN: "突尼斯", CUW: "库拉索", NED: "荷兰", EGY: "埃及",
  CIV: "科特迪瓦", BEL: "比利时", URU: "乌拉圭", CPV: "佛得角",
  SWE: "瑞典", AUS: "澳大利亚", PRY: "巴拉圭", TUR: "土耳其",
  TBD: "待定",
};

/** 英文名 → 中文名 */
window.TEAM_ZH_BY_NAME = {
  "Mexico": "墨西哥", "South Africa": "南非", "South Korea": "韩国", "Czechia": "捷克",
  "Canada": "加拿大", "Switzerland": "瑞士", "Bosnia and Herzegovina": "波黑", "Qatar": "卡塔尔",
  "Brazil": "巴西", "Morocco": "摩洛哥", "Scotland": "苏格兰", "Haiti": "海地",
  "France": "法国", "Senegal": "塞内加尔", "Iraq": "伊拉克", "Norway": "挪威",
  "Argentina": "阿根廷", "Austria": "奥地利", "Jordan": "约旦", "Algeria": "阿尔及利亚",
  "Colombia": "哥伦比亚", "DR Congo": "刚果（金）", "Portugal": "葡萄牙", "Uzbekistan": "乌兹别克斯坦",
  "England": "英格兰", "Ghana": "加纳", "Panama": "巴拿马", "Croatia": "克罗地亚",
  "Germany": "德国", "Japan": "日本", "Spain": "西班牙", "Costa Rica": "哥斯达黎加",
  "United States": "美国", "USA": "美国", "Nigeria": "尼日利亚", "Peru": "秘鲁", "New Zealand": "新西兰",
  "Iran": "伊朗", "Poland": "波兰", "Ecuador": "厄瓜多尔", "Saudi Arabia": "沙特阿拉伯",
  "Tunisia": "突尼斯", "Curaçao": "库拉索", "Curacao": "库拉索", "Netherlands": "荷兰",
  "Egypt": "埃及", "Ivory Coast": "科特迪瓦", "Belgium": "比利时", "Uruguay": "乌拉圭",
  "Cape Verde": "佛得角", "Sweden": "瑞典", "Australia": "澳大利亚", "Paraguay": "巴拉圭",
  "Turkey": "土耳其", "Türkiye": "土耳其", "TBD": "待定",
};

window.teamName = function (codeOrName) {
  if (!codeOrName) return "待定";
  if (TEAM_ZH[codeOrName]) return TEAM_ZH[codeOrName];
  if (TEAM_ZH_BY_NAME[codeOrName]) return TEAM_ZH_BY_NAME[codeOrName];
  return codeOrName;
};

window.teamLabel = function (code, name) {
  const zh = teamName(code) || teamName(name);
  const f = (window.FLAG && FLAG[code]) ? FLAG[code] + " " : "";
  return f + zh;
};
