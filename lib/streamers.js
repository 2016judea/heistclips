// Which streamers get a page: whoever is live in GTA right now (accumulated across refreshes),
// plus any Twitch/Kick handle a paying campaign names in its brief.
import { gql } from "../public/js/twitch.js";
import { liveKickGta } from "../public/js/kick.js";

export const GTA_GAMES = ["Grand Theft Auto VI", "Grand Theft Auto V"];

export async function liveGtaStreams(first = 40) {
  const out = [];
  for (const name of GTA_GAMES) {
    try {
      const d = await gql(`query{ game(name:"${name}"){ name viewersCount streams(first:${first}){ edges{ node{ viewersCount title language
        broadcaster{ login displayName profileImageURL(width:70) } } } } } }`);
      const g = d.game;
      if (!g) continue;
      for (const e of g.streams.edges) {
        const n = e.node;
        if (!n.broadcaster) continue;
        out.push({ login: n.broadcaster.login, name: n.broadcaster.displayName, avatar: n.broadcaster.profileImageURL, viewers: n.viewersCount, title: n.title, language: n.language, game: g.name });
      }
    } catch (e) { /* a missing game (GTA VI before launch) is not an error */ }
  }
  return out;
}

export async function liveKick() {
  try { return await liveKickGta(20); } catch (e) { return []; }
}

export function handlesFromCampaigns(campaigns) {
  const map = new Map();
  for (const c of campaigns) {
    const text = c.description || "";
    for (const m of text.matchAll(/twitch\.tv\/([A-Za-z0-9_]{3,25})/g)) {
      const login = m[1].toLowerCase();
      if (["videos", "directory", "settings", "p"].includes(login)) continue;
      if (!map.has(login)) map.set(login, { login, platform: "twitch", campaign_ids: [] });
      map.get(login).campaign_ids.push(c.id);
    }
    for (const m of text.matchAll(/kick\.com\/([A-Za-z0-9_-]{3,25})/g)) {
      const login = m[1].toLowerCase();
      const key = "kick:" + login;
      if (!map.has(key)) map.set(key, { login, platform: "kick", campaign_ids: [] });
      map.get(key).campaign_ids.push(c.id);
    }
  }
  return [...map.values()];
}

export function mergeStreamers(prev, live, linked, now = new Date().toISOString()) {
  prev = prev || []; live = live || []; linked = linked || [];
  const by = new Map(prev.map((s) => [s.platform === "kick" ? "kick:" + s.login : s.login, { ...s, live_now: false, viewers_now: 0 }]));
  for (const s of live) {
    const key = s.platform === "kick" ? "kick:" + s.login : s.login;
    const cur = by.get(key) || { login: s.login, platform: s.platform || "twitch", first_seen: now, peak_viewers: 0, campaign_ids: [] };
    by.set(key, { ...cur, name: s.name, avatar: s.avatar, language: s.language, game: s.game, last_title: s.title, last_seen: now,
      live_now: true, viewers_now: s.viewers, peak_viewers: Math.max(cur.peak_viewers || 0, s.viewers) });
  }
  for (const l of linked) {
    const key = l.platform === "kick" ? "kick:" + l.login : l.login;
    const cur = by.get(key) || { login: l.login, platform: l.platform, first_seen: now, peak_viewers: 0 };
    by.set(key, { ...cur, campaign_ids: l.campaign_ids });
  }
  return [...by.values()]
    .sort((a, b) => (b.campaign_ids || []).length - (a.campaign_ids || []).length || (b.peak_viewers || 0) - (a.peak_viewers || 0))
    .slice(0, 400);
}
