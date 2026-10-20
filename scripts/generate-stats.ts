/**
 * GitHub GraphQL API'den profil istatistiklerini çekip animasyonlu SVG kartları üretir:
 *   assets/github-stats.svg       — sayılar + rank halkası (github-readme-stats görünümü)
 *   assets/github-streak.svg      — toplam katkı / güncel seri / en uzun seri
 *   assets/terminal-activity.svg  — son 30 günün katkı grafiği
 *   assets/terminal-quote.svg     — günlük dönen geliştirici sözü ($ fortune --dev)
 *
 * Çalıştırma: GITHUB_TOKEN=<token> npx tsx scripts/generate-stats.ts
 */

import { mkdir, writeFile } from "node:fs/promises";
import { renderTerminal } from "./terminal";
import { collectStats } from "./github";
import { buildActivityLines, buildQuoteLines } from "./cards";
import { renderStatsCard, renderStreakCard } from "./profile-cards";

const LOGIN = process.env.GH_LOGIN ?? "muhammedozel";
const TOKEN = process.env.GITHUB_TOKEN;

// ---------- main ----------

async function main(): Promise<void> {
  if (!TOKEN) {
    console.error("GITHUB_TOKEN ortam değişkeni gerekli");
    process.exit(1);
  }
  const now = new Date();
  const stats = await collectStats({ login: LOGIN, token: TOKEN, now });
  console.log(JSON.stringify(stats, null, 2));

  const cards: { path: string; svg: string }[] = [
    { path: "assets/github-stats.svg", svg: renderStatsCard(stats, now) },
    { path: "assets/github-streak.svg", svg: renderStreakCard(stats, now) },
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
