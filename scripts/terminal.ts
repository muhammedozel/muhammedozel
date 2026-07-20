/**
 * Terminal görünümlü SVG kartların ortak çizim katmanı.
 * Mac terminal penceresi + daktilo animasyonlu satırlar (saf SMIL, harici kaynak yok).
 */

export const C = {
  bg: "#0d1117",
  border: "#1c2530",
  headerBg: "#111823",
  headerText: "#4d5a6a",
  cmd: "#22d3ee",
  key: "#8b949e",
  val: "#e6edf3",
  accent: "#0891B2",
  dim: "#6e7681",
} as const;

export const W = 620;
export const PAD = 20;
export const HEADER_H = 34;
export const LINE_H = 21;
export const FONT_SIZE = 13;
export const CHAR_W = 7.9; // 13px monospace yaklaşık karakter genişliği
export const TOP_PAD = 14;
export const BOTTOM_PAD = 14;

export interface Seg {
  t: string;
  color: string;
  bold?: boolean;
}

export type Line =
  | { kind: "cmd" | "out"; segs: Seg[] }
  | { kind: "blank" }
  | { kind: "cursor" }
  | {
      kind: "raw";
      height: number;
      /** Bu bloğun animasyonu için sonraki satırların bekleyeceği süre (sn) */
      holdSeconds?: number;
      /** yTop: bloğun üst px konumu, begin: animasyon başlangıç zamanı (sn) */
      render: (yTop: number, begin: number) => string;
    };

export function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export function fmt(n: number): string {
  return n.toLocaleString("en-US");
}

function tspans(segs: Seg[]): string {
  return segs
    .map((seg) => `<tspan fill="${seg.color}"${seg.bold ? ' font-weight="600"' : ""}>${esc(seg.t)}</tspan>`)
    .join("");
}

export function renderTerminal(opts: { title: string; ariaLabel: string; lines: Line[] }): string {
  const { title, ariaLabel, lines } = opts;
  const textEls: string[] = [];
  const defEls: string[] = [];
  let t = 0.4; // animasyon zaman imleci (saniye)
  let clipId = 0;
  let yOff = HEADER_H + TOP_PAD;

  for (const line of lines) {
    if (line.kind === "blank") {
      yOff += LINE_H;
      continue;
    }

    if (line.kind === "raw") {
      textEls.push(line.render(yOff, t));
      yOff += line.height;
      t += line.holdSeconds ?? 0.3;
      continue;
    }

    const y = yOff + 15;

    if (line.kind === "cmd") {
      // Daktilo efekti: clipPath içindeki rect'in genişliği karakter karakter büyür
      const chars = line.segs.map((s) => s.t).join("").length;
      const dur = Math.min(Math.max(chars * 0.045, 0.4), 1.3);
      const widths: string[] = [];
      for (let cIdx = 0; cIdx <= chars; cIdx++) widths.push((cIdx * CHAR_W + 4).toFixed(1));
      clipId++;
      defEls.push(
        `<clipPath id="type${clipId}"><rect x="${PAD}" y="${y - 16}" width="0" height="${LINE_H}">` +
          `<animate attributeName="width" values="${widths.join(";")}" calcMode="discrete" begin="${t.toFixed(2)}s" dur="${dur.toFixed(2)}s" fill="freeze"/>` +
          `</rect></clipPath>`,
      );
      textEls.push(
        `<g clip-path="url(#type${clipId})"><text x="${PAD}" y="${y}" xml:space="preserve">${tspans(line.segs)}</text></g>`,
      );
      t += dur + 0.15;
    } else if (line.kind === "out") {
      textEls.push(
        `<g opacity="0"><text x="${PAD}" y="${y}" xml:space="preserve">${tspans(line.segs)}</text>` +
          `<animate attributeName="opacity" from="0" to="1" begin="${t.toFixed(2)}s" dur="0.25s" fill="freeze"/></g>`,
      );
      t += 0.12;
    } else {
      // cursor: "$ " istemi + yanıp sönen blok imleç
      const cursorX = PAD + 2 * CHAR_W;
      textEls.push(
        `<g opacity="0"><text x="${PAD}" y="${y}" xml:space="preserve"><tspan fill="${C.cmd}">$ </tspan></text>` +
          `<animate attributeName="opacity" from="0" to="1" begin="${t.toFixed(2)}s" dur="0.1s" fill="freeze"/></g>`,
      );
      textEls.push(
        `<rect x="${cursorX}" y="${y - 12}" width="${CHAR_W}" height="15" fill="${C.cmd}" opacity="0">` +
          `<animate attributeName="opacity" values="1;0" keyTimes="0;0.5" calcMode="discrete" begin="${(t + 0.1).toFixed(2)}s" dur="1.06s" repeatCount="indefinite"/></rect>`,
      );
    }

    yOff += LINE_H;
  }

  const height = yOff + BOTTOM_PAD;

  const dots = [
    { cx: PAD + 5, fill: "#ff5f56" },
    { cx: PAD + 23, fill: "#ffbd2e" },
    { cx: PAD + 41, fill: "#27c93f" },
  ]
    .map((d) => `<circle cx="${d.cx}" cy="${HEADER_H / 2}" r="5.5" fill="${d.fill}"/>`)
    .join("");

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${height}" viewBox="0 0 ${W} ${height}" role="img" aria-label="${esc(ariaLabel)}">
  <defs>
    <clipPath id="card"><rect x="0.5" y="0.5" width="${W - 1}" height="${height - 1}" rx="10"/></clipPath>
    ${defEls.join("\n    ")}
  </defs>
  <g clip-path="url(#card)">
    <rect width="${W}" height="${height}" fill="${C.bg}"/>
    <rect width="${W}" height="${HEADER_H}" fill="${C.headerBg}"/>
    <line x1="0" y1="${HEADER_H}" x2="${W}" y2="${HEADER_H}" stroke="${C.border}" stroke-width="1"/>
    ${dots}
    <text x="${PAD + 58}" y="${HEADER_H / 2 + 4}" fill="${C.headerText}" font-size="11" font-family="Menlo, Consolas, 'DejaVu Sans Mono', 'Liberation Mono', monospace">${esc(title)}</text>
  </g>
  <rect x="0.5" y="0.5" width="${W - 1}" height="${height - 1}" rx="10" fill="none" stroke="${C.border}" stroke-width="1"/>
  <g font-family="Menlo, Consolas, 'DejaVu Sans Mono', 'Liberation Mono', monospace" font-size="${FONT_SIZE}">
    ${textEls.join("\n    ")}
  </g>
</svg>
`;
}
