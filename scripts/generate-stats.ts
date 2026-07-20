/**
 * GitHub GraphQL API'den profil istatistiklerini çekip terminal görünümlü
 * animasyonlu bir SVG kartı üretir: assets/terminal-stats.svg
 *
 * Çalıştırma: GITHUB_TOKEN=<token> npx tsx scripts/generate-stats.ts
 */

// Harici bağımlılık (@types/node) kullanmamak için minimal ambient tanımlar
declare const process: {
  env: Record<string, string | undefined>;
  exit(code?: number): never;
};
declare module "node:fs/promises" {
  export function writeFile(path: string, data: string, encoding: "utf8"): Promise<void>;
  export function mkdir(path: string, options: { recursive: boolean }): Promise<string | undefined>;
}

const LOGIN = process.env.GH_LOGIN ?? "muhammedozel";
const TOKEN = process.env.GITHUB_TOKEN;
const OUT_PATH = "assets/terminal-stats.svg";

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
  };
}

// ---------- SVG üretimi ----------

const C = {
  bg: "#0d1117",
  border: "#1c2530",
  headerBg: "#111823",
  headerText: "#4d5a6a",
  cmd: "#22d3ee",
  key: "#8b949e",
  val: "#e6edf3",
  accent: "#0891B2",
  dim: "#6e7681",
};

const W = 620;
const PAD = 20;
const HEADER_H = 34;
const LINE_H = 21;
const FONT_SIZE = 13;
const CHAR_W = 7.9; // 13px monospace yaklaşık karakter genişliği
const TOP_PAD = 14;
const BOTTOM_PAD = 14;

interface Seg {
  t: string;
  color: string;
  bold?: boolean;
}

interface Line {
  kind: "cmd" | "out" | "blank" | "cursor";
  segs: Seg[];
}

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function fmt(n: number): string {
  return n.toLocaleString("en-US");
}

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

function kv(pairs: [string, string][], valColor: string = C.val): Line {
  const segs: Seg[] = [];
  pairs.forEach(([k, v], i) => {
    if (i > 0) segs.push({ t: "   ", color: C.key });
    segs.push({ t: `${k}: `, color: C.key });
    segs.push({ t: v, color: valColor, bold: true });
  });
  return { kind: "out", segs };
}

function buildLines(s: Stats): Line[] {
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
  lines.push({ kind: "blank", segs: [] });

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
  lines.push({ kind: "blank", segs: [] });

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
  lines.push({ kind: "blank", segs: [] });

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
  lines.push({ kind: "blank", segs: [] });

  lines.push({ kind: "cursor", segs: [{ t: "$ ", color: C.cmd }] });
  return lines;
}

function lineText(line: Line): string {
  return line.segs.map((s) => s.t).join("");
}

function renderSvg(s: Stats): string {
  const lines = buildLines(s);
  const height = HEADER_H + TOP_PAD + lines.length * LINE_H + BOTTOM_PAD;

  const textEls: string[] = [];
  const defEls: string[] = [];
  let t = 0.4; // animasyon zaman imleci (saniye)
  let clipId = 0;

  lines.forEach((line, i) => {
    if (line.kind === "blank") return;
    const y = HEADER_H + TOP_PAD + i * LINE_H + 15;

    const tspans = line.segs
      .map(
        (seg) =>
          `<tspan fill="${seg.color}"${seg.bold ? ' font-weight="600"' : ""}>${esc(seg.t)}</tspan>`,
      )
      .join("");

    if (line.kind === "cmd") {
      // Daktilo efekti: clipPath içindeki rect'in genişliği karakter karakter büyür
      const chars = lineText(line).length;
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
        `<g clip-path="url(#type${clipId})"><text x="${PAD}" y="${y}" xml:space="preserve">${tspans}</text></g>`,
      );
      t += dur + 0.15;
    } else if (line.kind === "out") {
      textEls.push(
        `<g opacity="0"><text x="${PAD}" y="${y}" xml:space="preserve">${tspans}</text>` +
          `<animate attributeName="opacity" from="0" to="1" begin="${t.toFixed(2)}s" dur="0.25s" fill="freeze"/></g>`,
      );
      t += 0.12;
    } else if (line.kind === "cursor") {
      const cursorX = PAD + 2 * CHAR_W;
      textEls.push(
        `<g opacity="0"><text x="${PAD}" y="${y}" xml:space="preserve">${tspans}</text>` +
          `<animate attributeName="opacity" from="0" to="1" begin="${t.toFixed(2)}s" dur="0.1s" fill="freeze"/></g>`,
      );
      textEls.push(
        `<rect x="${cursorX}" y="${y - 12}" width="${CHAR_W}" height="15" fill="${C.cmd}" opacity="0">` +
          `<animate attributeName="opacity" values="1;0" keyTimes="0;0.5" calcMode="discrete" begin="${(t + 0.1).toFixed(2)}s" dur="1.06s" repeatCount="indefinite"/></rect>`,
      );
    }
  });

  const dots = [
    { cx: PAD + 5, fill: "#ff5f56" },
    { cx: PAD + 23, fill: "#ffbd2e" },
    { cx: PAD + 41, fill: "#27c93f" },
  ]
    .map((d) => `<circle cx="${d.cx}" cy="${HEADER_H / 2}" r="5.5" fill="${d.fill}"/>`)
    .join("");

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${height}" viewBox="0 0 ${W} ${height}" role="img" aria-label="${LOGIN} GitHub stats terminal">
  <defs>
    <clipPath id="card"><rect x="0.5" y="0.5" width="${W - 1}" height="${height - 1}" rx="10"/></clipPath>
    ${defEls.join("\n    ")}
  </defs>
  <g clip-path="url(#card)">
    <rect width="${W}" height="${height}" fill="${C.bg}"/>
    <rect width="${W}" height="${HEADER_H}" fill="${C.headerBg}"/>
    <line x1="0" y1="${HEADER_H}" x2="${W}" y2="${HEADER_H}" stroke="${C.border}" stroke-width="1"/>
    ${dots}
    <text x="${PAD + 58}" y="${HEADER_H / 2 + 4}" fill="${C.headerText}" font-size="11">${LOGIN}@github ~ stats</text>
  </g>
  <rect x="0.5" y="0.5" width="${W - 1}" height="${height - 1}" rx="10" fill="none" stroke="${C.border}" stroke-width="1"/>
  <g font-family="Menlo, Consolas, 'DejaVu Sans Mono', 'Liberation Mono', monospace" font-size="${FONT_SIZE}">
    ${textEls.join("\n    ")}
  </g>
</svg>
`;
}

// ---------- main ----------

async function main(): Promise<void> {
  if (!TOKEN) {
    console.error("GITHUB_TOKEN ortam değişkeni gerekli");
    process.exit(1);
  }
  const stats = await collectStats();
  console.log(JSON.stringify(stats, null, 2));
  const svg = renderSvg(stats);
  const { writeFile, mkdir } = await import("node:fs/promises");
  await mkdir("assets", { recursive: true });
  await writeFile(OUT_PATH, svg, "utf8");
  console.log(`Yazıldı: ${OUT_PATH} (${svg.length} bayt)`);
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
