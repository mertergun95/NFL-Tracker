export interface TeamInfo {
  name: string;
  division: string;
  color: string;
}

export const TEAMS: Record<string, TeamInfo> = {
  ARI: { name: "Arizona Cardinals", division: "NFC West", color: "#97233F" },
  ATL: { name: "Atlanta Falcons", division: "NFC South", color: "#A71930" },
  BAL: { name: "Baltimore Ravens", division: "AFC North", color: "#241773" },
  BUF: { name: "Buffalo Bills", division: "AFC East", color: "#00338D" },
  CAR: { name: "Carolina Panthers", division: "NFC South", color: "#0085CA" },
  CHI: { name: "Chicago Bears", division: "NFC North", color: "#0B162A" },
  CIN: { name: "Cincinnati Bengals", division: "AFC North", color: "#FB4F14" },
  CLE: { name: "Cleveland Browns", division: "AFC North", color: "#311D00" },
  DAL: { name: "Dallas Cowboys", division: "NFC East", color: "#003594" },
  DEN: { name: "Denver Broncos", division: "AFC West", color: "#FB4F14" },
  DET: { name: "Detroit Lions", division: "NFC North", color: "#0076B6" },
  GB: { name: "Green Bay Packers", division: "NFC North", color: "#203731" },
  HOU: { name: "Houston Texans", division: "AFC South", color: "#03202F" },
  IND: { name: "Indianapolis Colts", division: "AFC South", color: "#002C5F" },
  JAX: { name: "Jacksonville Jaguars", division: "AFC South", color: "#006778" },
  KC: { name: "Kansas City Chiefs", division: "AFC West", color: "#E31837" },
  LA: { name: "Los Angeles Rams", division: "NFC West", color: "#003594" },
  LAC: { name: "Los Angeles Chargers", division: "AFC West", color: "#0080C6" },
  LV: { name: "Las Vegas Raiders", division: "AFC West", color: "#A5ACAF" },
  MIA: { name: "Miami Dolphins", division: "AFC East", color: "#008E97" },
  MIN: { name: "Minnesota Vikings", division: "NFC North", color: "#4F2683" },
  NE: { name: "New England Patriots", division: "AFC East", color: "#002244" },
  NO: { name: "New Orleans Saints", division: "NFC South", color: "#D3BC8D" },
  NYG: { name: "New York Giants", division: "NFC East", color: "#0B2265" },
  NYJ: { name: "New York Jets", division: "AFC East", color: "#125740" },
  PHI: { name: "Philadelphia Eagles", division: "NFC East", color: "#004C54" },
  PIT: { name: "Pittsburgh Steelers", division: "AFC North", color: "#FFB612" },
  SEA: { name: "Seattle Seahawks", division: "NFC West", color: "#002244" },
  SF: { name: "San Francisco 49ers", division: "NFC West", color: "#AA0000" },
  TB: { name: "Tampa Bay Buccaneers", division: "NFC South", color: "#D50A0A" },
  TEN: { name: "Tennessee Titans", division: "AFC South", color: "#0C2340" },
  WAS: { name: "Washington Commanders", division: "NFC East", color: "#5A1414" },
};

export const teamName = (abbr: string | null) =>
  (abbr && TEAMS[abbr]?.name) || abbr || "—";
