import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// TheSportsDB API – key "3" is the free public demo key
const SPORTSDB_KEY = "3";
const BASE = `https://www.thesportsdb.com/api/v1/json/${SPORTSDB_KEY}`;

// Teams we care about (TheSportsDB IDs for Mexican clubs)
// We'll search by team name to stay flexible
const TARGET_TEAMS = [
  "Chivas",
  "Cruz Azul",
  "America",
  "Guadalajara",
  "Club America",
];

function todayMexico(): string {
  // UTC-6 (CST, no DST offset for reliability)
  const now = new Date();
  const offset = -6 * 60; // minutes
  const local = new Date(now.getTime() + offset * 60 * 1000);
  return local.toISOString().slice(0, 10); // YYYY-MM-DD
}

interface SportsDBEvent {
  idEvent: string;
  strEvent: string;
  strHomeTeam: string;
  strAwayTeam: string;
  strLeague: string;
  dateEvent: string;
  strTime: string;       // UTC time  "01:00:00"
  strTimestamp: string;  // ISO timestamp UTC
  intHomeScore: string | null;
  intAwayScore: string | null;
  strStatus: string;
  strVenue: string;
  strThumb: string;
  strDescriptionEN?: string;
}

interface MatchInfo {
  id: string;
  name: string;
  homeTeam: string;
  awayTeam: string;
  league: string;
  date: string;       // YYYY-MM-DD
  timeUTC: string;    // "01:00:00"
  timeMexico: string; // "7:00 PM"
  hourMexico: number; // 19
  minuteMexico: number; // 0
  status: string;
  venue: string;
  thumb: string;
  involvesFavorite: boolean;
}

function utcToMexicoTime(dateStr: string, timeStr: string): { display: string; hour: number; minute: number } {
  if (!timeStr || timeStr === "00:00:00") {
    return { display: "Hora por confirmar", hour: 19, minute: 0 };
  }
  try {
    const dt = new Date(`${dateStr}T${timeStr}Z`);
    // Mexico City = UTC-6 (CST) for simplicity (no DST handling needed here)
    const mexMs = dt.getTime() - 6 * 60 * 60 * 1000;
    const mex = new Date(mexMs);
    const h = mex.getUTCHours();
    const m = mex.getUTCMinutes();
    const ampm = h >= 12 ? "PM" : "AM";
    const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
    return {
      display: `${h12}:${String(m).padStart(2, "0")} ${ampm}`,
      hour: h,
      minute: m,
    };
  } catch {
    return { display: "Hora por confirmar", hour: 19, minute: 0 };
  }
}

function isTargetTeam(name: string): boolean {
  const n = name.toLowerCase();
  return TARGET_TEAMS.some((t) => n.includes(t.toLowerCase()));
}

async function fetchLeagueEventsToday(leagueId: string, date: string): Promise<SportsDBEvent[]> {
  try {
    const url = `${BASE}/eventsday.php?d=${date}&l=${leagueId}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) return [];
    const json = await res.json();
    return (json?.events ?? []) as SportsDBEvent[];
  } catch {
    return [];
  }
}

async function fetchTeamNextEvent(teamId: string): Promise<SportsDBEvent[]> {
  try {
    const url = `${BASE}/eventsnext.php?id=${teamId}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) return [];
    const json = await res.json();
    return (json?.events ?? []) as SportsDBEvent[];
  } catch {
    return [];
  }
}

async function searchTeamId(teamName: string): Promise<string | null> {
  try {
    const url = `${BASE}/searchteams.php?t=${encodeURIComponent(teamName)}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) return null;
    const json = await res.json();
    const teams = json?.teams ?? [];
    if (teams.length === 0) return null;
    // Pick best match
    const exact = teams.find((t: { strTeam: string }) =>
      t.strTeam.toLowerCase().includes(teamName.toLowerCase())
    );
    return (exact ?? teams[0])?.idTeam ?? null;
  } catch {
    return null;
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS });
  }

  try {
    const today = todayMexico();

    // ── 1. Fetch Liga MX events today (league ID 4350 = Mexican Primera Division)
    const ligaMxEvents = await fetchLeagueEventsToday("4350", today);

    // ── 2. Also search for Chivas & Cruz Azul next events (in case liga scraper misses)
    const [chivasId, cruzAzulId] = await Promise.all([
      searchTeamId("Guadalajara"),
      searchTeamId("Cruz Azul"),
    ]);

    let extraEvents: SportsDBEvent[] = [];
    if (chivasId || cruzAzulId) {
      const fetches = await Promise.all([
        chivasId ? fetchTeamNextEvent(chivasId) : Promise.resolve([]),
        cruzAzulId ? fetchTeamNextEvent(cruzAzulId) : Promise.resolve([]),
      ]);
      extraEvents = fetches.flat();
    }

    // ── 3. Merge & deduplicate
    const allEvents = [...ligaMxEvents, ...extraEvents];
    const seen = new Set<string>();
    const unique = allEvents.filter((e) => {
      if (seen.has(e.idEvent)) return false;
      seen.add(e.idEvent);
      return true;
    });

    // ── 4. Filter to TODAY only
    const todayEvents = unique.filter((e) => e.dateEvent === today);

    // ── 5. Map to MatchInfo
    const matches: MatchInfo[] = todayEvents.map((e) => {
      const { display, hour, minute } = utcToMexicoTime(e.dateEvent, e.strTime);
      const involvesFavorite =
        isTargetTeam(e.strHomeTeam) || isTargetTeam(e.strAwayTeam);
      return {
        id: e.idEvent,
        name: e.strEvent,
        homeTeam: e.strHomeTeam,
        awayTeam: e.strAwayTeam,
        league: e.strLeague,
        date: e.dateEvent,
        timeUTC: e.strTime,
        timeMexico: display,
        hourMexico: hour,
        minuteMexico: minute,
        status: e.strStatus ?? "NS",
        venue: e.strVenue ?? "",
        thumb: e.strThumb ?? "",
        involvesFavorite,
      };
    });

    // Sort: favorites first, then by time
    matches.sort((a, b) => {
      if (a.involvesFavorite && !b.involvesFavorite) return -1;
      if (!a.involvesFavorite && b.involvesFavorite) return 1;
      return a.hourMexico * 60 + a.minuteMexico - (b.hourMexico * 60 + b.minuteMexico);
    });

    return new Response(
      JSON.stringify({ date: today, matches, total: matches.length }),
      { headers: { ...CORS, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: String(err), matches: [], total: 0 }),
      { status: 500, headers: { ...CORS, "Content-Type": "application/json" } }
    );
  }
});
