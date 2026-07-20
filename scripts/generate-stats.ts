/**
 * GitHub GraphQL API'den profil istatistiklerini çekip terminal görünümlü
 * animasyonlu SVG kartları üretir:
 *   assets/terminal-stats.svg     — genel istatistikler + streak + diller + son repolar
 *   assets/terminal-activity.svg  — son 30 günün katkı grafiği
 *   assets/terminal-quote.svg     — günlük dönen geliştirici sözü ($ fortune --dev)
 *
 * Çalıştırma: GITHUB_TOKEN=<token> npx tsx scripts/generate-stats.ts
 */

import { C, W, PAD, CHAR_W, renderTerminal, fmt } from "./terminal";
import type { Line, Seg } from "./terminal";
import { pickQuote } from "./quotes";

const LOGIN = process.env.GH_LOGIN ?? "muhammedozel";
const TOKEN = process.env.GITHUB_TOKEN;

// ---------- GraphQL ----------

interface GraphQLError {
  message: string;
}

interface LanguageEdge {
  size: number;
  node: { name: string };
}

interface RepoNode {
  name: string;
  pushedAt: string | null;
  stargazerCount: number;
  languages: { edges: LanguageEdge[] };
}

interface ProfileData {
  user: {
    createdAt: string;
    pullRequests: { totalCount: number };
    issues: { totalCount: number };
    repositories: { totalCount: number; nodes: RepoNode[] };
  };
}

interface CalendarDay {
  date: string;
  contributionCount: number;
}

interface YearData {
  user: {
    contributionsCollection: {
      totalCommitContributions: number;
      restrictedContributionsCount: number;
      contributionCalendar: {
        totalContributions: number;
        weeks: { contributionDays: CalendarDay[] }[];
      };
    };
  };
}

async function gql<T>(query: string, variables: Record<string, string>): Promise<T> {
  const res = await fetch("https://api.github.com/graphql", {
    method: "POST",
    headers: {
      Authorization: `bearer ${TOKEN}`,
      "Content-Type": "application/json",
      "User-Agent": LOGIN,
    },
    body: JSON.stringify({ query, variables }),
  });
  if (!res.ok) {
    throw new Error(`GraphQL HTTP ${res.status}: ${await res.text()}`);
  }
  const body = (await res.json()) as { data?: T; errors?: GraphQLError[] };
  if (body.errors?.length) {
    throw new Error(`GraphQL: ${body.errors.map((e) => e.message).join("; ")}`);
  }
  if (!body.data) {
    throw new Error("GraphQL: boş yanıt");
  }
  return body.data;
}

const PROFILE_QUERY = `
query($login: String!) {
  user(login: $login) {
    createdAt
    pullRequests { totalCount }
    issues { totalCount }
    repositories(
      first: 100
      ownerAffiliations: OWNER
      isFork: false
      privacy: PUBLIC
      orderBy: { field: PUSHED_AT, direction: DESC }
    ) {
      totalCount
      nodes {
        name
        pushedAt
        stargazerCount
        languages(first: 8, orderBy: { field: SIZE, direction: DESC }) {
          edges { size node { name } }
        }
      }
    }
  }
}`;

const YEAR_QUERY = `
query($login: String!, $from: DateTime!, $to: DateTime!) {
  user(login: $login) {
    contributionsCollection(from: $from, to: $to) {
      totalCommitContributions
      restrictedContributionsCount
      contributionCalendar {
        totalContributions
        weeks { contributionDays { date contributionCount } }
      }
    }
  }
}`;

// ---------- Veri toplama ----------

interface DayCount {
  date: string;
  count: number;
}

interface Stats {
  commitsThisYear: number;
  stars: number;
  prs: number;
  issues: number;
  currentStreak: number;
  longestStreak: number;
  totalContributions: number;
  languages: { name: string; pct: number }[];
  recentRepos: { name: string; pushedAt: string }[];
  last30: DayCount[];
}

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

async function collectStats(): Promise<Stats> {
  const profile = await gql<ProfileData>(PROFILE_QUERY, { login: LOGIN });
  const user = profile.user;
  if (user.repositories.totalCount > 100) {
    console.warn(`Uyarı: ${user.repositories.totalCount} repo var, ilk 100'ü kullanılıyor`);
  }

  const now = new Date();
  const createdYear = new Date(user.createdAt).getUTCFullYear();
  const currentYear = now.getUTCFullYear();

  // Yıl yıl katkı takvimlerini çek (contributionsCollection en fazla 1 yıllık aralık kabul eder)
  const dayCounts = new Map<string, number>();
  let commitsThisYear = 0;
  for (let year = createdYear; year <= currentYear; year++) {
    const from = new Date(Date.UTC(year, 0, 1)).toISOString();
    const to =
      year === currentYear ? now.toISOString() : new Date(Date.UTC(year, 11, 31, 23, 59, 59)).toISOString();
    const data = await gql<YearData>(YEAR_QUERY, { login: LOGIN, from, to });
    const coll = data.user.contributionsCollection;
    for (const week of coll.contributionCalendar.weeks) {
      for (const day of week.contributionDays) {
        dayCounts.set(day.date, day.contributionCount);
      }
    }
    if (year === currentYear) {
      commitsThisYear = coll.totalCommitContributions + coll.restrictedContributionsCount;
    }
  }

  // Streak hesabı — bugünün katkısı henüz yoksa seriyi bozmaz
  const today = isoDate(now);
  let totalContributions = 0;
  const dates = [...dayCounts.keys()].filter((d) => d <= today).sort();
  for (const d of dates) totalContributions += dayCounts.get(d) ?? 0;

  let longestStreak = 0;
  let run = 0;
  for (const d of dates) {
    run = (dayCounts.get(d) ?? 0) > 0 ? run + 1 : 0;
    if (run > longestStreak) longestStreak = run;
  }

  let currentStreak = 0;
  const cursor = new Date(now);
  if ((dayCounts.get(today) ?? 0) === 0) cursor.setUTCDate(cursor.getUTCDate() - 1);
  while ((dayCounts.get(isoDate(cursor)) ?? 0) > 0) {
    currentStreak++;
    cursor.setUTCDate(cursor.getUTCDate() - 1);
  }

  // Son 30 gün (bugün dahil)
  const last30: DayCount[] = [];
  for (let i = 29; i >= 0; i--) {
    const d = new Date(now);
    d.setUTCDate(d.getUTCDate() - i);
    const date = isoDate(d);
    last30.push({ date, count: dayCounts.get(date) ?? 0 });
  }

  // Yıldızlar ve dil dağılımı (fork'suz, public, sahip olunan repolar)
  let stars = 0;
  const langBytes = new Map<string, number>();
  for (const repo of user.repositories.nodes) {
    stars += repo.stargazerCount;
    for (const edge of repo.languages.edges) {
      langBytes.set(edge.node.name, (langBytes.get(edge.node.name) ?? 0) + edge.size);
    }
  }
  const totalBytes = [...langBytes.values()].reduce((a, b) => a + b, 0);
  const languages = [...langBytes.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)
    .map(([name, size]) => ({ name, pct: totalBytes > 0 ? (size / totalBytes) * 100 : 0 }));

  const recentRepos = user.repositories.nodes
    .filter((r): r is RepoNode & { pushedAt: string } => r.pushedAt !== null)
    .slice(0, 3)
    .map((r) => ({ name: r.name, pushedAt: r.pushedAt }));

  return {
    commitsThisYear,
    stars,
    prs: user.pullRequests.totalCount,
    issues: user.issues.totalCount,
    currentStreak,
    longestStreak,
    totalContributions,
    languages,
    recentRepos,
    last30,
  };
}

// ---------- Kart içerikleri ----------

function relTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60_000);
  if (mins < 60) return `${Math.max(mins, 1)}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  return `${months}mo ago`;
}

function bar(pct: number): string {
  const blocks = 12;
  const filled = Math.round((pct / 100) * blocks);
  return "█".repeat(filled) + "░".repeat(blocks - filled);
}

function cmd(text: string): Line {
  return { kind: "cmd", segs: [{ t: "$ ", color: C.cmd }, { t: text, color: C.cmd }] };
}

function kv(pairs: [string, string][]): Line {
  const segs: Seg[] = [];
  pairs.forEach(([k, v], i) => {
    if (i > 0) segs.push({ t: "   ", color: C.key });
    segs.push({ t: `${k}: `, color: C.key });
    segs.push({ t: v, color: C.val, bold: true });
  });
  return { kind: "out", segs };
}

function buildStatsLines(s: Stats): Line[] {
  const lines: Line[] = [];

  lines.push(cmd("whoami --stats"));
  lines.push(
    kv([
      ["commits_this_year", fmt(s.commitsThisYear)],
      ["stars", fmt(s.stars)],
      ["prs", fmt(s.prs)],
      ["issues", fmt(s.issues)],
    ]),
  );
  lines.push({ kind: "blank" });

  lines.push(cmd("git streak"));
  lines.push({
    kind: "out",
    segs: [
      { t: "current: ", color: C.key },
      { t: `${s.currentStreak} days`, color: C.accent, bold: true },
      { t: " 🔥", color: C.val },
      { t: "   longest: ", color: C.key },
      { t: `${s.longestStreak} days`, color: C.val, bold: true },
      { t: "   total: ", color: C.key },
      { t: fmt(s.totalContributions), color: C.val, bold: true },
    ],
  });
  lines.push({ kind: "blank" });

  lines.push(cmd("lang --top"));
  const nameWidth = Math.max(...s.languages.map((l) => l.name.length), 1);
  for (const lang of s.languages) {
    lines.push({
      kind: "out",
      segs: [
        { t: lang.name.padEnd(nameWidth + 2), color: C.val },
        { t: bar(lang.pct), color: C.accent },
        { t: `  ${lang.pct.toFixed(1)}%`, color: C.key },
      ],
    });
  }
  lines.push({ kind: "blank" });

  lines.push(cmd("git log --recent"));
  const repoWidth = Math.max(...s.recentRepos.map((r) => r.name.length), 1);
  for (const repo of s.recentRepos) {
    lines.push({
      kind: "out",
      segs: [
        { t: repo.name.padEnd(repoWidth + 2), color: C.val },
        { t: relTime(repo.pushedAt), color: C.dim },
      ],
    });
  }
  lines.push({ kind: "blank" });

  lines.push({ kind: "cursor" });
  return lines;
}

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

function buildActivityLines(s: Stats): Line[] {
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

function buildQuoteLines(now: Date): Line[] {
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

// ---------- main ----------

async function main(): Promise<void> {
  if (!TOKEN) {
    console.error("GITHUB_TOKEN ortam değişkeni gerekli");
    process.exit(1);
  }
  const now = new Date();
  const stats = await collectStats();
  console.log(JSON.stringify(stats, null, 2));

  const cards: { path: string; svg: string }[] = [
    {
      path: "assets/terminal-stats.svg",
      svg: renderTerminal({
        title: `${LOGIN}@github ~ stats`,
        ariaLabel: `${LOGIN} GitHub stats terminal`,
        lines: buildStatsLines(stats),
      }),
    },
    {
      path: "assets/terminal-activity.svg",
      svg: renderTerminal({
        title: `${LOGIN}@github ~ activity`,
        ariaLabel: `${LOGIN} son 30 gün katkı grafiği`,
        lines: buildActivityLines(stats),
      }),
    },
    {
      path: "assets/terminal-quote.svg",
      svg: renderTerminal({
        title: `${LOGIN}@github ~ fortune`,
        ariaLabel: "Günün geliştirici sözü",
        lines: buildQuoteLines(now),
      }),
    },
  ];

  const { writeFile, mkdir } = await import("node:fs/promises");
  await mkdir("assets", { recursive: true });
  for (const card of cards) {
    await writeFile(card.path, card.svg, "utf8");
    console.log(`Yazıldı: ${card.path} (${card.svg.length} bayt)`);
  }
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
