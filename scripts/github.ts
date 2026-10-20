/**
 * GitHub GraphQL API istemcisi ve profil istatistiklerinin toplanması.
 */

// ---------- GraphQL ----------

interface GraphQLError {
  message: string;
}

interface RepoNode {
  stargazerCount: number;
}

interface ProfileData {
  user: {
    name: string | null;
    createdAt: string;
    followers: { totalCount: number };
    pullRequests: { totalCount: number };
    issues: { totalCount: number };
    repositoriesContributedTo: { totalCount: number };
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
      totalPullRequestReviewContributions: number;
      contributionCalendar: {
        totalContributions: number;
        weeks: { contributionDays: CalendarDay[] }[];
      };
    };
  };
}

type Gql = <T>(query: string, variables: Record<string, string>) => Promise<T>;

function createGql(token: string, userAgent: string): Gql {
  return async function gql<T>(query: string, variables: Record<string, string>): Promise<T> {
    const res = await fetch("https://api.github.com/graphql", {
      method: "POST",
      headers: {
        Authorization: `bearer ${token}`,
        "Content-Type": "application/json",
        "User-Agent": userAgent,
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
  };
}

const PROFILE_QUERY = `
query($login: String!) {
  user(login: $login) {
    name
    createdAt
    followers { totalCount }
    pullRequests { totalCount }
    issues { totalCount }
    repositoriesContributedTo(
      first: 1
      contributionTypes: [COMMIT, ISSUE, PULL_REQUEST, REPOSITORY]
    ) { totalCount }
    repositories(
      first: 100
      ownerAffiliations: OWNER
      isFork: false
      privacy: PUBLIC
    ) {
      totalCount
      nodes { stargazerCount }
    }
  }
}`;

const YEAR_QUERY = `
query($login: String!, $from: DateTime!, $to: DateTime!) {
  user(login: $login) {
    contributionsCollection(from: $from, to: $to) {
      totalCommitContributions
      restrictedContributionsCount
      totalPullRequestReviewContributions
      contributionCalendar {
        totalContributions
        weeks { contributionDays { date contributionCount } }
      }
    }
  }
}`;

// ---------- Veri toplama ----------

export interface DayCount {
  date: string;
  count: number;
}

/** ISO tarih (YYYY-MM-DD) aralığı; seri yoksa days = 0 ve uçlar null */
export interface Streak {
  days: number;
  start: string | null;
  end: string | null;
}

export interface Stats {
  name: string;
  /** Hesabın açıldığı gün (ISO) — toplam katkı aralığının başlangıcı */
  since: string;
  commitsThisYear: number;
  reviewsThisYear: number;
  stars: number;
  prs: number;
  issues: number;
  followers: number;
  contributedTo: number;
  currentStreak: Streak;
  longestStreak: Streak;
  totalContributions: number;
  last30: DayCount[];
}

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export async function collectStats(opts: { login: string; token: string; now: Date }): Promise<Stats> {
  const { login, token, now } = opts;
  const gql = createGql(token, login);
  const profile = await gql<ProfileData>(PROFILE_QUERY, { login });
  const user = profile.user;
  if (user.repositories.totalCount > 100) {
    console.warn(`Uyarı: ${user.repositories.totalCount} repo var, ilk 100'ü kullanılıyor`);
  }

  const createdYear = new Date(user.createdAt).getUTCFullYear();
  const currentYear = now.getUTCFullYear();

  // Yıl yıl katkı takvimlerini çek (contributionsCollection en fazla 1 yıllık aralık kabul eder)
  const dayCounts = new Map<string, number>();
  let commitsThisYear = 0;
  let reviewsThisYear = 0;
  for (let year = createdYear; year <= currentYear; year++) {
    const from = new Date(Date.UTC(year, 0, 1)).toISOString();
    const to =
      year === currentYear ? now.toISOString() : new Date(Date.UTC(year, 11, 31, 23, 59, 59)).toISOString();
    const data = await gql<YearData>(YEAR_QUERY, { login, from, to });
    const coll = data.user.contributionsCollection;
    for (const week of coll.contributionCalendar.weeks) {
      for (const day of week.contributionDays) {
        dayCounts.set(day.date, day.contributionCount);
      }
    }
    if (year === currentYear) {
      commitsThisYear = coll.totalCommitContributions + coll.restrictedContributionsCount;
      reviewsThisYear = coll.totalPullRequestReviewContributions;
    }
  }

  // Streak hesabı — bugünün katkısı henüz yoksa seriyi bozmaz
  const today = isoDate(now);
  let totalContributions = 0;
  const dates = [...dayCounts.keys()].filter((d) => d <= today).sort();
  for (const d of dates) totalContributions += dayCounts.get(d) ?? 0;

  let longestStreak: Streak = { days: 0, start: null, end: null };
  let run = 0;
  let runStart: string | null = null;
  for (const d of dates) {
    if ((dayCounts.get(d) ?? 0) > 0) {
      if (run === 0) runStart = d;
      run++;
      if (run > longestStreak.days) longestStreak = { days: run, start: runStart, end: d };
    } else {
      run = 0;
    }
  }

  let currentStreak: Streak = { days: 0, start: null, end: null };
  const cursor = new Date(now);
  if ((dayCounts.get(today) ?? 0) === 0) cursor.setUTCDate(cursor.getUTCDate() - 1);
  const currentEnd = isoDate(cursor);
  while ((dayCounts.get(isoDate(cursor)) ?? 0) > 0) {
    currentStreak = { days: currentStreak.days + 1, start: isoDate(cursor), end: currentEnd };
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

  // Yıldızlar (fork'suz, public, sahip olunan repolar)
  const stars = user.repositories.nodes.reduce((sum, repo) => sum + repo.stargazerCount, 0);

  return {
    name: user.name ?? login,
    since: user.createdAt.slice(0, 10),
    commitsThisYear,
    reviewsThisYear,
    stars,
    prs: user.pullRequests.totalCount,
    issues: user.issues.totalCount,
    followers: user.followers.totalCount,
    contributedTo: user.repositoriesContributedTo.totalCount,
    currentStreak,
    longestStreak,
    totalContributions,
    last30,
  };
}
