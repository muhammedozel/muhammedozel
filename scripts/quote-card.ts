/**
 * Günlük dönen geliştirici sözü — stats/streak kartlarıyla aynı github_dark görünümü.
 */

import { FONT, ROW_WIDTH, THEME, esc } from "./card-kit";
import { pickQuote } from "./quotes";

const W = ROW_WIDTH;
const PAD = 25;
const TEXT_X = PAD + 20;
const LINE_H = 26;
const FIRST_LINE_Y = 76;
// Segoe UI yerine daha geniş yedek fontlar (DejaVu vb.) devreye girse de taşmasın diye muhafazakâr
const MAX_CHARS = 90;

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

export function renderQuoteCard(now: Date): string {
  const quote = pickQuote(now);
  const lines = wrap(`"${quote.text}"`, MAX_CHARS);

  const authorY = FIRST_LINE_Y + (lines.length - 1) * LINE_H + 32;
  const height = authorY + 26;
  const barTop = FIRST_LINE_Y - 20;

  const lineEls = lines
    .map(
      (l, i) =>
        `<text class="quote stagger" style="animation-delay: ${450 + i * 150}ms" x="${TEXT_X}" y="${FIRST_LINE_Y + i * LINE_H}">${esc(l)}</text>`,
    )
    .join("\n  ");

  return `<svg width="${W}" height="${height}" viewBox="0 0 ${W} ${height}" fill="none" xmlns="http://www.w3.org/2000/svg" role="img" aria-labelledby="titleId descId">
  <title id="titleId">Dev Quote of the Day</title>
  <desc id="descId">${esc(`"${quote.text}" — ${quote.author}`)}</desc>
  <style>
    .header { font: 600 18px ${FONT}; fill: ${THEME.title}; animation: fadeInAnimation 0.8s ease-in-out forwards; }
    .quote { font: italic 400 16px ${FONT}; fill: ${THEME.text}; }
    .author { font: 600 14px ${FONT}; fill: ${THEME.accent}; }
    .stagger { opacity: 0; animation: fadeInAnimation 0.3s ease-in-out forwards; }
    @keyframes fadeInAnimation { from { opacity: 0; } to { opacity: 1; } }
  </style>
  <rect x="0.5" y="0.5" rx="4.5" width="${W - 1}" height="${height - 1}" stroke="${THEME.border}" fill="${THEME.bg}"/>
  <text x="${PAD}" y="35" class="header">Dev Quote of the Day</text>
  <rect x="${PAD}" y="${barTop}" width="3" height="${authorY - barTop + 6}" rx="1.5" fill="${THEME.accent}" opacity="0.8"/>
  ${lineEls}
  <text class="author stagger" style="animation-delay: ${450 + lines.length * 150}ms" x="${TEXT_X}" y="${authorY}">— ${esc(quote.author)}</text>
</svg>
`;
}
