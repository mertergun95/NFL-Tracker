import type { StatRow } from "./types";
import { fmt, label } from "./columns";
import { teamName, TEAMS } from "./teams";

/** Oyuncu sezon istatistiklerinden paylaşılabilir PNG stat kartı üretip indirir. */
export function downloadStatCard(
  name: string, pos: string, team: string, season: number,
  row: StatRow, stats: string[],
) {
  const W = 840, H = 440;
  const canvas = document.createElement("canvas");
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext("2d")!;
  const accent = TEAMS[team]?.color ?? "#d50a0a";

  // zemin
  ctx.fillStyle = "#0d1117";
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = accent;
  ctx.fillRect(0, 0, 10, H);
  ctx.strokeStyle = "#2d333b";
  ctx.strokeRect(0.5, 0.5, W - 1, H - 1);

  // başlık
  ctx.fillStyle = "#e6edf3";
  ctx.font = "700 40px system-ui, sans-serif";
  ctx.fillText(name, 44, 72);
  ctx.fillStyle = "#8b949e";
  ctx.font = "400 20px system-ui, sans-serif";
  ctx.fillText(`${pos} · ${teamName(team)} · ${season} sezonu (REG)`, 44, 106);

  // istatistik ızgarası (3 sütun x 2 satır)
  const shown = stats.filter((s) => row[s] !== null && row[s] !== undefined).slice(0, 6);
  const cols = 3, cw = (W - 88) / cols, ch = 110, top = 150;
  shown.forEach((s, i) => {
    const x = 44 + (i % cols) * cw;
    const y = top + Math.floor(i / cols) * (ch + 18);
    ctx.fillStyle = "#161b22";
    ctx.strokeStyle = "#2d333b";
    roundRect(ctx, x, y, cw - 16, ch, 10);
    ctx.fill(); ctx.stroke();
    ctx.fillStyle = "#8b949e";
    ctx.font = "400 15px system-ui, sans-serif";
    ctx.fillText(label(s), x + 16, y + 30);
    ctx.fillStyle = "#e6edf3";
    ctx.font = "700 34px system-ui, sans-serif";
    ctx.fillText(fmt(s, row[s]), x + 16, y + 76);
  });

  // alt bilgi
  ctx.fillStyle = "#8b949e";
  ctx.font = "400 15px system-ui, sans-serif";
  ctx.fillText("🏈 NFL Tracker · veri: nflverse", 44, H - 24);

  const a = document.createElement("a");
  a.download = `${name.replace(/\s+/g, "-")}-${season}.png`;
  a.href = canvas.toDataURL("image/png");
  a.click();
}

function roundRect(ctx: CanvasRenderingContext2D,
                   x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
