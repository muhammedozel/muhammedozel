/**
 * Son 30 günün katkı grafiği — stats/streak kartlarıyla aynı github_dark görünümü.
 */

import { FONT, ROW_WIDTH, THEME, esc, fmt } from "./card-kit";
import type { Stats } from "./github";

const W = ROW_WIDTH;
const H = 280;
const PAD = 25;
const CHART_BASE = 172;
const CHART_H = 100;

function dateLabel(iso: string): string {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

export function renderActivityCard(s: Stats): string {
  const days = s.last30;
  const counts = days.map((d) => d.count);
  const total = counts.reduce((a, b) => a + b, 0);
  const max = Math.max(...counts, 0);
  const active = counts.filter((c) => c > 0).length;
  const avg = total / days.length;

  const scale = Math.max(max, 1);
  const x0 = PAD;
  const cw = W - 2 * PAD;
  const stepX = cw / (days.length - 1);
  const pts = days.map((d, i) => ({
    x: x0 + i * stepX,
    y: CHART_BASE - (d.count / scale) * CHART_H,
  }));

  const lineP = pts.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(" ");
  const areaP = `${lineP} L${(x0 + cw).toFixed(1)} ${CHART_BASE} L${x0} ${CHART_BASE} Z`;

  let len = 0;
  for (let i = 1; i < pts.length; i++) {
    len += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
  }

  const peakIdx = counts.reduce((best, c, i) => (c > counts[best] ? i : best), 0);
  const peak = pts[peakIdx];

  const grid = [0.25, 0.5, 0.75]
    .map((f) => {
      const gy = (CHART_BASE - f * CHART_H).toFixed(1);
      return `<line x1="${x0}" y1="${gy}" x2="${x0 + cw}" y2="${gy}" stroke="${THEME.border}" stroke-opacity="0.25" stroke-dasharray="3 5"/>`;
    })
    .join("\n    ");

  const dayLabels = pts
    .map((p, i) => `<text class="day" x="${p.x.toFixed(1)}" y="${(p.y - 9).toFixed(1)}" text-anchor="middle">${counts[i]}</text>`)
    .join("\n      ");

  const mid = Math.floor(days.length / 2);
  const dateLabels = [0, mid, days.length - 1]
    .map((i) => {
      let anchor = "middle";
      if (i === 0) anchor = "start";
      else if (i === days.length - 1) anchor = "end";
      return `<text class="date" x="${pts[i].x.toFixed(1)}" y="${CHART_BASE + 19}" text-anchor="${anchor}">${dateLabel(days[i].date)}</text>`;
    })
    .join("\n    ");

  const summary = [
    { value: fmt(max), label: "Max / day" },
    { value: avg.toFixed(1), label: "Avg / day" },
    { value: `${active}/${days.length}`, label: "Active days" },
  ];
  const colW = W / summary.length;
  const summaryEls = summary
    .map(
      (item, i) => `<g class="stagger" style="animation-delay: ${450 + i * 150}ms">
      <text class="num" x="${(colW * i + colW / 2).toFixed(1)}" y="242" text-anchor="middle">${esc(item.value)}</text>
      <text class="lbl" x="${(colW * i + colW / 2).toFixed(1)}" y="262" text-anchor="middle">${item.label}</text>
    </g>`,
    )
    .join("\n    ");
  const dividers = [1, 2]
    .map((i) => `<line x1="${colW * i}" y1="218" x2="${colW * i}" y2="266" stroke="${THEME.border}" stroke-opacity="0.35"/>`)
    .join("\n    ");

  const title = `${s.name}'s Contribution Activity`;
  const desc = `Last ${days.length} days: max ${max}/day, avg ${avg.toFixed(1)}/day, active ${active}/${days.length} days`;

  return `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" fill="none" xmlns="http://www.w3.org/2000/svg" role="img" aria-labelledby="titleId descId">
  <title id="titleId">${esc(title)}</title>
  <desc id="descId">${esc(desc)}</desc>
  <style>
    .header { font: 600 18px ${FONT}; fill: ${THEME.title}; animation: fadeInAnimation 0.8s ease-in-out forwards; }
    .sub { font: 400 13px ${FONT}; fill: ${THEME.dim}; }
    .num { font: 700 24px ${FONT}; fill: ${THEME.white}; }
    .lbl { font: 400 13px ${FONT}; fill: ${THEME.text}; }
    .day { font: 400 9px ${FONT}; fill: ${THEME.dim}; paint-order: stroke; stroke: ${THEME.bg}; stroke-width: 3px; stroke-linejoin: round; }
    .date { font: 400 11px ${FONT}; fill: ${THEME.dim}; }
    .stagger { opacity: 0; animation: fadeInAnimation 0.3s ease-in-out forwards; }
    .line { stroke-dasharray: ${len.toFixed(0)}; stroke-dashoffset: ${len.toFixed(0)}; animation: drawAnimation 1.4s ease-in-out 0.4s forwards; }
    .area { opacity: 0; animation: areaAnimation 0.5s ease-in-out 1.3s forwards; }
    .late { opacity: 0; animation: fadeInAnimation 0.4s ease-in-out 1.7s forwards; }
    @keyframes drawAnimation { to { stroke-dashoffset: 0; } }
    @keyframes areaAnimation { to { opacity: 0.16; } }
    @keyframes fadeInAnimation { from { opacity: 0; } to { opacity: 1; } }
  </style>
  <rect x="0.5" y="0.5" rx="4.5" width="${W - 1}" height="${H - 1}" stroke="${THEME.border}" fill="${THEME.bg}"/>
  <text x="${PAD}" y="35" class="header">${esc(title)}</text>
  <text x="${W - PAD}" y="35" class="sub" text-anchor="end">Last ${days.length} days</text>
  <g>
    ${grid}
    <line x1="${x0}" y1="${CHART_BASE}" x2="${x0 + cw}" y2="${CHART_BASE}" stroke="${THEME.border}" stroke-opacity="0.5"/>
    <path class="area" d="${areaP}" fill="${THEME.title}"/>
    <path class="line" d="${lineP}" stroke="${THEME.title}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>
    <circle class="late" cx="${peak.x.toFixed(1)}" cy="${peak.y.toFixed(1)}" r="4" fill="${THEME.accent}"/>
    <g class="late">
      ${dayLabels}
    </g>
    ${dateLabels}
  </g>
  <line x1="${PAD}" y1="206" x2="${W - PAD}" y2="206" stroke="${THEME.border}" stroke-opacity="0.35"/>
  ${dividers}
  ${summaryEls}
</svg>
`;
}
