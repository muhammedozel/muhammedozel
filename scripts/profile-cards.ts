/**
 * github-readme-stats / streak-stats görünümlü (github_dark teması) iki SVG kart:
 *   renderStatsCard  — ikonlu sayılar + rank halkası
 *   renderStreakCard — toplam katkı / güncel seri / en uzun seri
 * Harici servis yok; veri scripts/github.ts'ten gelir.
 */

import { THEME, esc, fmt } from "./card-kit";
import type { Stats, Streak } from "./github";

const CARD_H = 195;

const STATS_THEME = {
  bg: THEME.bg,
  border: THEME.border,
  title: THEME.title,
  text: THEME.text,
  icon: THEME.icon,
  ring: THEME.title,
} as const;

const STREAK_THEME = {
  bg: THEME.bg,
  border: THEME.accent,
  text: THEME.white,
  accent: THEME.accent,
  fire: THEME.icon,
} as const;

// ---------- Rank ----------

const RANK_LEVELS = ["S", "A+", "A", "A-", "B+", "B", "B-", "C+", "C"] as const;
const RANK_THRESHOLDS = [1, 12.5, 25, 37.5, 50, 62.5, 75, 87.5, 100] as const;

const expCdf = (x: number): number => 1 - 2 ** -x;
const logNormCdf = (x: number): number => x / (1 + x);

export interface RankInput {
  commits: number;
  prs: number;
  issues: number;
  reviews: number;
  stars: number;
  followers: number;
}

/** github-readme-stats ile aynı yaklaşım: medyan değerlere göre ağırlıklı CDF toplamı */
export function calculateRank(m: RankInput): { level: string; percentile: number } {
  const totalWeight = 2 + 3 + 1 + 1 + 4 + 1;
  const score =
    (2 * expCdf(m.commits / 250) +
      3 * expCdf(m.prs / 50) +
      1 * expCdf(m.issues / 25) +
      1 * expCdf(m.reviews / 2) +
      4 * logNormCdf(m.stars / 50) +
      1 * logNormCdf(m.followers / 10)) /
    totalWeight;
  const percentile = (1 - score) * 100;
  const idx = RANK_THRESHOLDS.findIndex((t) => percentile <= t);
  return { level: RANK_LEVELS[idx === -1 ? RANK_LEVELS.length - 1 : idx], percentile };
}

// ---------- Stats kartı ----------

const W_STATS = 467;
const RING_R = 40;
const RING_CIRC = 2 * Math.PI * RING_R;

// Octicons (MIT): star, history, git-pull-request, issue-opened, repo
const ICONS = {
  star: "M8 .25a.75.75 0 01.673.418l1.882 3.815 4.21.612a.75.75 0 01.416 1.279l-3.046 2.97.719 4.192a.75.75 0 01-1.088.791L8 12.347l-3.766 1.98a.75.75 0 01-1.088-.79l.72-4.194L.818 6.374a.75.75 0 01.416-1.28l4.21-.611L7.327.668A.75.75 0 018 .25zm0 2.445L6.615 5.5a.75.75 0 01-.564.41l-3.097.45 2.24 2.184a.75.75 0 01.216.664l-.528 3.084 2.769-1.456a.75.75 0 01.698 0l2.77 1.456-.53-3.084a.75.75 0 01.216-.664l2.24-2.183-3.096-.45a.75.75 0 01-.564-.41L8 2.694v.001z",
  commits:
    "M1.643 3.143L.427 1.927A.25.25 0 000 2.104V5.75c0 .138.112.25.25.25h3.646a.25.25 0 00.177-.427L2.715 4.215a6.5 6.5 0 11-1.18 4.458.75.75 0 10-1.493.154 8.001 8.001 0 101.6-5.684zM7.75 4a.75.75 0 01.75.75v2.992l2.028.812a.75.75 0 01-.557 1.392l-2.5-1A.75.75 0 017 8.25v-3.5A.75.75 0 017.75 4z",
  prs: "M7.177 3.073L9.573.677A.25.25 0 0110 .854v4.792a.25.25 0 01-.427.177L7.177 3.427a.25.25 0 010-.354zM3.75 2.5a.75.75 0 100 1.5.75.75 0 000-1.5zm-2.25.75a2.25 2.25 0 113 2.122v5.256a2.251 2.251 0 11-1.5 0V5.372A2.25 2.25 0 011.5 3.25zM11 2.5h-1V4h1a1 1 0 011 1v5.628a2.251 2.251 0 101.5 0V5A2.5 2.5 0 0011 2.5zm1 10.25a.75.75 0 111.5 0 .75.75 0 01-1.5 0zM3.75 12a.75.75 0 100 1.5.75.75 0 000-1.5z",
  issues:
    "M8 1.5a6.5 6.5 0 100 13 6.5 6.5 0 000-13zM0 8a8 8 0 1116 0A8 8 0 010 8zm9 3a1 1 0 11-2 0 1 1 0 012 0zm-.25-6.25a.75.75 0 00-1.5 0v3.5a.75.75 0 001.5 0v-3.5z",
  contribs:
    "M2 2.5A2.5 2.5 0 014.5 0h8.75a.75.75 0 01.75.75v12.5a.75.75 0 01-.75.75h-2.5a.75.75 0 110-1.5h1.75v-2h-8a1 1 0 00-.714 1.7.75.75 0 01-1.072 1.05A2.495 2.495 0 012 11.5v-9zm10.5-1V9h-8c-.356 0-.694.074-1 .208V2.5a1 1 0 011-1h8zM5 12.25v3.25a.25.25 0 00.4.2l1.45-1.087a.25.25 0 01.3 0L8.6 15.7a.25.25 0 00.4-.2v-3.25a.25.25 0 00-.25-.25h-3.5a.25.25 0 00-.25.25z",
} as const;

export function renderStatsCard(s: Stats, now: Date): string {
  const year = now.getUTCFullYear();
  const rank = calculateRank({
    commits: s.commitsThisYear,
    prs: s.prs,
    issues: s.issues,
    reviews: s.reviewsThisYear,
    stars: s.stars,
    followers: s.followers,
  });
  const ringTo = (RING_CIRC * rank.percentile) / 100;

  const rows: { icon: string; label: string; value: number }[] = [
    { icon: ICONS.star, label: "Total Stars Earned:", value: s.stars },
    { icon: ICONS.commits, label: `Total Commits (${year}):`, value: s.commitsThisYear },
    { icon: ICONS.prs, label: "Total PRs:", value: s.prs },
    { icon: ICONS.issues, label: "Total Issues:", value: s.issues },
    { icon: ICONS.contribs, label: "Contributed to (last year):", value: s.contributedTo },
  ];

  const rowEls = rows
    .map(
      (row, i) => `<g transform="translate(0, ${i * 25})">
      <g class="stagger" style="animation-delay: ${450 + i * 150}ms" transform="translate(25, 0)">
        <svg class="icon" viewBox="0 0 16 16" version="1.1" width="16" height="16"><path fill-rule="evenodd" d="${row.icon}"/></svg>
        <text class="stat bold" x="25" y="12.5">${esc(row.label)}</text>
        <text class="stat bold" x="219.01" y="12.5">${fmt(row.value)}</text>
      </g>
    </g>`,
    )
    .join("\n    ");

  const title = `${s.name}'s GitHub Stats`;
  const desc =
    `Total Stars Earned: ${s.stars}, Total Commits (${year}): ${s.commitsThisYear}, ` +
    `Total PRs: ${s.prs}, Total Issues: ${s.issues}, Contributed to (last year): ${s.contributedTo}`;

  return `<svg width="${W_STATS}" height="${CARD_H}" viewBox="0 0 ${W_STATS} ${CARD_H}" fill="none" xmlns="http://www.w3.org/2000/svg" role="img" aria-labelledby="titleId descId">
  <title id="titleId">${esc(title)}, Rank: ${rank.level}</title>
  <desc id="descId">${esc(desc)}</desc>
  <style>
    .header { font: 600 18px 'Segoe UI', Ubuntu, Sans-Serif; fill: ${STATS_THEME.title}; animation: fadeInAnimation 0.8s ease-in-out forwards; }
    .stat { font: 600 14px 'Segoe UI', Ubuntu, "Helvetica Neue", Sans-Serif; fill: ${STATS_THEME.text}; }
    .stagger { opacity: 0; animation: fadeInAnimation 0.3s ease-in-out forwards; }
    .rank-text { font: 800 24px 'Segoe UI', Ubuntu, Sans-Serif; fill: ${STATS_THEME.text}; animation: scaleInAnimation 0.3s ease-in-out forwards; }
    .bold { font-weight: 700; }
    .icon { fill: ${STATS_THEME.icon}; display: block; }
    .rank-circle-rim { stroke: ${STATS_THEME.ring}; fill: none; stroke-width: 6; opacity: 0.2; }
    .rank-circle {
      stroke: ${STATS_THEME.ring}; stroke-dasharray: 250; fill: none; stroke-width: 6; stroke-linecap: round; opacity: 0.8;
      transform-origin: -10px 8px; transform: rotate(-90deg);
      animation: rankAnimation 1s forwards ease-in-out;
    }
    @keyframes rankAnimation {
      from { stroke-dashoffset: ${RING_CIRC.toFixed(3)}; }
      to { stroke-dashoffset: ${ringTo.toFixed(3)}; }
    }
    @keyframes scaleInAnimation {
      from { transform: translate(-5px, 5px) scale(0); }
      to { transform: translate(-5px, 5px) scale(1); }
    }
    @keyframes fadeInAnimation {
      from { opacity: 0; }
      to { opacity: 1; }
    }
  </style>
  <rect x="0.5" y="0.5" rx="4.5" width="${W_STATS - 1}" height="${CARD_H - 1}" stroke="${STATS_THEME.border}" fill="${STATS_THEME.bg}"/>
  <g transform="translate(25, 35)">
    <text x="0" y="0" class="header">${esc(title)}</text>
  </g>
  <g transform="translate(0, 55)">
    <g transform="translate(390.5, 47.5)">
      <circle class="rank-circle-rim" cx="-10" cy="8" r="${RING_R}"/>
      <circle class="rank-circle" cx="-10" cy="8" r="${RING_R}"/>
      <g class="rank-text">
        <text x="-5" y="3" alignment-baseline="central" dominant-baseline="central" text-anchor="middle">${esc(rank.level)}</text>
      </g>
    </g>
    ${rowEls}
  </g>
</svg>
`;
}

// ---------- Streak kartı ----------

const W_STREAK = 495;
const FIRE_PATH =
  "M 1.5 0.67 C 1.5 0.67 2.24 3.32 2.24 5.47 C 2.24 7.53 0.89 9.2 -1.17 9.2 C -3.23 9.2 -4.79 7.53 -4.79 5.47 L -4.76 5.11 C -6.78 7.51 -8 10.62 -8 13.99 C -8 18.41 -4.42 22 0 22 C 4.42 22 8 18.41 8 13.99 C 8 8.6 5.41 3.79 1.5 0.67 Z M -0.29 19 C -2.07 19 -3.51 17.6 -3.51 15.86 C -3.51 14.24 -2.46 13.1 -0.7 12.74 C 1.07 12.38 2.9 11.53 3.92 10.16 C 4.31 11.45 4.51 12.81 4.51 14.2 C 4.51 16.85 2.36 19 -0.29 19 Z";

/** "Oct 13" — yıl, içinde bulunulan yıldan farklıysa eklenir */
function shortDate(iso: string, now: Date): string {
  const d = new Date(`${iso}T00:00:00Z`);
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: d.getUTCFullYear() === now.getUTCFullYear() ? undefined : "numeric",
    timeZone: "UTC",
  });
}

function streakRange(streak: Streak, now: Date): string {
  if (streak.start === null || streak.end === null) return "-";
  if (streak.start === streak.end) return shortDate(streak.start, now);
  return `${shortDate(streak.start, now)} - ${shortDate(streak.end, now)}`;
}

export function renderStreakCard(s: Stats, now: Date): string {
  const t = STREAK_THEME;
  const font = `font-family='"Segoe UI", Ubuntu, sans-serif'`;

  // Sütun ortasına hizalı metin; animasyon gecikmesi referans kartla aynı
  const text = (
    cx: number,
    y: number,
    content: string,
    o: { size: number; weight: number; fill: string; delay: number },
  ): string =>
    `<g transform='translate(${cx}, ${y})'>
        <text x='0' y='32' stroke-width='0' text-anchor='middle' fill='${o.fill}' stroke='none' ${font} font-weight='${o.weight}' font-size='${o.size}px' style='opacity: 0; animation: fadein 0.5s linear forwards ${o.delay}s'>${esc(content)}</text>
      </g>`;

  const column = (cx: number, num: string, label: string, range: string, d: number): string =>
    [
      text(cx, 48, num, { size: 28, weight: 700, fill: t.text, delay: d }),
      text(cx, 84, label, { size: 14, weight: 400, fill: t.text, delay: d + 0.1 }),
      text(cx, 114, range, { size: 12, weight: 400, fill: t.accent, delay: d + 0.2 }),
    ].join("\n      ");

  const desc =
    `Total Contributions: ${s.totalContributions}, Current Streak: ${s.currentStreak.days} days, ` +
    `Longest Streak: ${s.longestStreak.days} days`;

  return `<svg xmlns='http://www.w3.org/2000/svg' style='isolation: isolate' viewBox='0 0 ${W_STREAK} ${CARD_H}' width='${W_STREAK}px' height='${CARD_H}px' direction='ltr' role='img' aria-labelledby='streakTitle streakDesc'>
  <title id='streakTitle'>${esc(s.name)}'s GitHub Streak</title>
  <desc id='streakDesc'>${esc(desc)}</desc>
  <style>
    @keyframes currstreak {
      0% { font-size: 3px; opacity: 0.2; }
      80% { font-size: 34px; opacity: 1; }
      100% { font-size: 28px; opacity: 1; }
    }
    @keyframes fadein {
      0% { opacity: 0; }
      100% { opacity: 1; }
    }
  </style>
  <defs>
    <clipPath id='outer_rectangle'><rect width='${W_STREAK}' height='${CARD_H}' rx='4.5'/></clipPath>
    <mask id='mask_out_ring_behind_fire'>
      <rect width='${W_STREAK}' height='${CARD_H}' fill='white'/>
      <ellipse cx='247.5' cy='32' rx='13' ry='18' fill='black'/>
    </mask>
  </defs>
  <g clip-path='url(#outer_rectangle)'>
    <rect stroke='${t.border}' fill='${t.bg}' rx='4.5' x='0.5' y='0.5' width='${W_STREAK - 1}' height='${CARD_H - 1}'/>
    <line x1='165' y1='28' x2='165' y2='170' stroke-width='1' stroke='${t.border}'/>
    <line x1='330' y1='28' x2='330' y2='170' stroke-width='1' stroke='${t.border}'/>
    <g>
      ${column(82.5, fmt(s.totalContributions), "Total Contributions", `${shortDate(s.since, now)} - Present`, 0.6)}
    </g>
    <g>
      ${text(247.5, 108, "Current Streak", { size: 14, weight: 700, fill: t.text, delay: 0.9 })}
      ${text(247.5, 134, streakRange(s.currentStreak, now), { size: 12, weight: 400, fill: t.accent, delay: 0.9 })}
      <g mask='url(#mask_out_ring_behind_fire)'>
        <circle cx='247.5' cy='71' r='40' fill='none' stroke='${t.accent}' stroke-width='5' style='opacity: 0; animation: fadein 0.5s linear forwards 0.4s'/>
      </g>
      <g transform='translate(247.5, 19.5)' stroke-opacity='0' style='opacity: 0; animation: fadein 0.5s linear forwards 0.6s'>
        <path d='${FIRE_PATH}' fill='${t.fire}' stroke-opacity='0'/>
      </g>
      <g transform='translate(247.5, 48)'>
        <text x='0' y='32' stroke-width='0' text-anchor='middle' fill='${t.text}' stroke='none' ${font} font-weight='700' font-size='28px' style='animation: currstreak 0.6s linear forwards'>${s.currentStreak.days}</text>
      </g>
    </g>
    <g>
      ${column(412.5, String(s.longestStreak.days), "Longest Streak", streakRange(s.longestStreak, now), 1.2)}
    </g>
  </g>
</svg>
`;
}
