/**
 * Terminal kartlarının içerikleri: activity (grafik) ve quote.
 */

import { C, W, PAD, CHAR_W, fmt, cmd, kv } from "./terminal";
import type { Line } from "./terminal";
import type { DayCount, Stats } from "./github";
import { pickQuote } from "./quotes";

function chartRaw(days: DayCount[]): Line {
  const chH = 110;
  const topGap = 12;
  const labelGap = 28;
  return {
    kind: "raw",
    height: topGap + chH + labelGap,
    holdSeconds: 1.8,
    render: (yTop, begin) => {
      const x0 = PAD + 2;
      const cw = W - 2 * PAD - 4;
      const yBase = yTop + topGap + chH;
      const max = Math.max(...days.map((d) => d.count), 1);
      const stepX = cw / (days.length - 1);
      const pts = days.map((d, i) => ({
        x: x0 + i * stepX,
        y: yBase - (d.count / max) * (chH - 10),
      }));

      const lineP = pts.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(" ");
      const areaP = `${lineP} L${(x0 + cw).toFixed(1)} ${yBase.toFixed(1)} L${x0.toFixed(1)} ${yBase.toFixed(1)} Z`;

      let len = 0;
      for (let i = 1; i < pts.length; i++) {
        len += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
      }

      const peakIdx = days.reduce((best, d, i) => (d.count > days[best].count ? i : best), 0);
      const peak = pts[peakIdx];

      // Her günün katkı sayısı — çakışmasın diye zikzak yükseklikte küçük etiketler
      const dayLabels = pts
        .map((p, i) => {
          const yLab = Math.max(p.y - (i % 2 === 0 ? 8 : 19), yTop + 9);
          return `<text x="${p.x.toFixed(1)}" y="${yLab.toFixed(1)}" fill="${C.key}" font-size="8.5" text-anchor="middle">${days[i].count}</text>`;
        })
        .join("\n          ");

      const grid = [0.25, 0.5, 0.75]
        .map((f) => {
          const gy = (yBase - f * (chH - 10)).toFixed(1);
          return `<line x1="${x0}" y1="${gy}" x2="${x0 + cw}" y2="${gy}" stroke="${C.border}" stroke-width="1" stroke-dasharray="3 5" opacity="0.6"/>`;
        })
        .join("\n        ");

      const dateLabel = (iso: string): string =>
        new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          timeZone: "UTC",
        });
      const mid = Math.floor(days.length / 2);
      const labels = [0, mid, days.length - 1]
        .map((i) => {
          const anchor = i === 0 ? "start" : i === days.length - 1 ? "end" : "middle";
          return `<text x="${pts[i].x.toFixed(1)}" y="${(yBase + 19).toFixed(1)}" fill="${C.dim}" font-size="11" text-anchor="${anchor}">${dateLabel(days[i].date)}</text>`;
        })
        .join("\n        ");

      return `<g>
        ${grid}
        <line x1="${x0}" y1="${yBase.toFixed(1)}" x2="${x0 + cw}" y2="${yBase.toFixed(1)}" stroke="${C.border}" stroke-width="1"/>
        <path d="${areaP}" fill="${C.accent}" opacity="0">
          <animate attributeName="opacity" from="0" to="0.16" begin="${(begin + 0.9).toFixed(2)}s" dur="0.5s" fill="freeze"/>
        </path>
        <path d="${lineP}" fill="none" stroke="${C.cmd}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round" stroke-dasharray="${len.toFixed(0)}" stroke-dashoffset="${len.toFixed(0)}">
          <animate attributeName="stroke-dashoffset" from="${len.toFixed(0)}" to="0" begin="${begin.toFixed(2)}s" dur="1.4s" fill="freeze"/>
        </path>
        <circle cx="${peak.x.toFixed(1)}" cy="${peak.y.toFixed(1)}" r="3.5" fill="${C.cmd}" opacity="0">
          <animate attributeName="opacity" from="0" to="1" begin="${(begin + 1.4).toFixed(2)}s" dur="0.3s" fill="freeze"/>
        </circle>
        <g opacity="0">
          ${dayLabels}
          <animate attributeName="opacity" from="0" to="1" begin="${(begin + 1.4).toFixed(2)}s" dur="0.4s" fill="freeze"/>
        </g>
        ${labels}
      </g>`;
    },
  };
}

export function buildActivityLines(s: Stats): Line[] {
  const total = s.last30.reduce((a, d) => a + d.count, 0);
  const max = Math.max(...s.last30.map((d) => d.count), 0);
  const active = s.last30.filter((d) => d.count > 0).length;
  const avg = total / s.last30.length;

  return [
    cmd("git activity --last 30d"),
    chartRaw(s.last30),
    kv([
      ["max", `${fmt(max)}/day`],
      ["avg", `${avg.toFixed(1)}/day`],
      ["active", `${active}/${s.last30.length} days`],
    ]),
    { kind: "blank" },
    { kind: "cursor" },
  ];
}

function wrap(text: string, maxChars: number): string[] {
  const words = text.split(" ");
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    if (current.length + word.length + 1 > maxChars && current.length > 0) {
      lines.push(current);
      current = word;
    } else {
      current = current.length > 0 ? `${current} ${word}` : word;
    }
  }
  if (current.length > 0) lines.push(current);
  return lines;
}

export function buildQuoteLines(now: Date): Line[] {
  const quote = pickQuote(now);
  const maxChars = Math.floor((W - 2 * PAD) / CHAR_W) - 2;
  const lines: Line[] = [cmd("fortune --dev")];
  const wrapped = wrap(`"${quote.text}"`, maxChars);
  for (const l of wrapped) {
    lines.push({ kind: "out", segs: [{ t: l, color: C.val }] });
  }
  lines.push({ kind: "out", segs: [{ t: `  — ${quote.author}`, color: C.dim }] });
  lines.push({ kind: "blank" });
  lines.push({ kind: "cursor" });
  return lines;
}
