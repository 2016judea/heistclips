// The editor's campaign checklist, beside Render. The clipper picks the campaign they are clipping
// for (the ones that pay for this streamer first; the queue passes one as ?c=); its rules come
// from /api/rules (lib/rules.js reads the brief and the rules pages it links to). Then:
//   length   checked live against the clip window
//   game     checked against the moment's game (public/js/games.js)
//   caption  required tags, mentions, exact text and #ad are added to the caption; each removable
//   submit   the submit window, used again after a post (public/js/post.js)
//   the rest is listed in the brief's own words under "Check yourself", with a link to the brief.
// A rule the parser could not read is never shown as passed.
import { gameFits, shortGame } from "./games.js";

const h = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const store = { get: (k) => { try { return localStorage.getItem(k); } catch (e) { return null; } }, set: (k, v) => { try { localStorage.setItem(k, v); } catch (e) {} } };
const money = (x) => "$" + (x >= 100 ? Math.round(x).toLocaleString("en-US") : Number(x).toFixed(2));
const lists = new Map(), rulesMemo = new Map();
const getJSON = async (url) => { const r = await fetch(url); const d = await r.json().catch(() => ({})); if (!r.ok || !d.ok) throw new Error(d.error || "HTTP " + r.status); return d; };

export function campaignsFor(vod) {
  const key = `${vod.platform === "kick" ? "kick" : "twitch"}:${vod.channel}`;
  if (!lists.has(key)) lists.set(key, getJSON(`/api/rules?ch=${encodeURIComponent(key)}&name=${encodeURIComponent(vod.channel_name || vod.channel)}`).then((d) => d.campaigns).catch(() => []));
  return lists.get(key);
}
export function rulesFor(slug) {
  if (!rulesMemo.has(slug)) rulesMemo.set(slug, getJSON(`/api/rules?c=${encodeURIComponent(slug)}`).catch((e) => { rulesMemo.delete(slug); throw e; }));
  return rulesMemo.get(slug);
}

const HIDE = new Set(["pointer", "pool_terms", "read_all", "discord_optional", "locations", "min_views", "platforms", "submit_deadline", "length", "game_only"]);
const PLATFORM = { tiktok: "TikTok", youtube: "YouTube Shorts", instagram: "Instagram Reels", x: "X", facebook: "Facebook", snapchat: "Snapchat" };

// Caption text from the hook and the campaign's caption rules, minus what the clipper removed.
export function buildCaption(hook, f, off, chan) {
  if (!f) return String(hook || "");
  const parts = [String(hook || "").trim()].filter(Boolean);
  for (const t of f.captionText || []) if (!off.has(t)) parts.push(t);
  const body = parts.join("\n");
  if (f.nameInCaption && !off.has("name") && !body.toLowerCase().includes(f.nameInCaption.toLowerCase())) parts.push(f.nameInCaption);
  if (f.cta && !off.has("cta") && chan) parts.push(`Watch live: ${chan}`);
  const tags = [...(f.disclosure && !off.has("#ad") ? ["#ad"] : []), ...(f.hashtags || []).filter((t) => !off.has(t)), ...(f.mentions || []).filter((t) => !off.has(t))];
  if (tags.length) parts.push(tags.join(" "));
  return parts.join("\n");
}

// One checklist. ctx: { root, vod, moment, win, ph, hook(), game() -> {game, source} }
export function campaignPanel(ctx) {
  const { root, vod, ph } = ctx;
  const params = new URLSearchParams(location.search);
  const saveKey = `hc_camp:${vod.platform === "kick" ? "kick" : "twitch"}:${vod.channel}`;
  const chanUrl = vod.platform === "kick" ? `kick.com/${vod.channel}` : `twitch.tv/${vod.channel}`;
  const off = new Set();
  let list = [], pick = null, rules = null, loading = false, failed = null;
  const st = { campaign: null };

  async function start() {
    list = await campaignsFor(vod);
    const want = params.get("c") || store.get(saveKey) || "";
    const found = list.find((c) => c.slug === want || c.id === want);
    if (want && !found && params.get("c")) list.unshift({ slug: want, title: want, pays_for: "queue" }); // the queue's pick, even if the match list missed it
    render();
    if (want && (found || params.get("c"))) choose(want, false);
  }

  async function choose(slug, byHand) {
    pick = list.find((c) => c.slug === slug || c.id === slug) || null;
    rules = null; failed = null; off.clear();
    store.set(saveKey, pick ? pick.slug : "");
    if (byHand) ph("campaign_pick", { slug: pick ? pick.slug : null, pays_for: pick ? pick.pays_for : null, options: list.length });
    if (!pick) { st.campaign = null; render(); ctx.onChange && ctx.onChange(); return; }
    loading = true; render();
    try {
      const d = await rulesFor(pick.slug); rules = d.rules;
      const li = list.find((c) => c.slug === pick.slug); if (li) Object.assign(li, d.campaign, { pays_for: li.pays_for });
      pick = { ...pick, ...d.campaign };
    }
    catch (e) { failed = e.message; }
    loading = false;
    const f = rules && rules.fields;
    st.campaign = { slug: pick.slug, title: pick.title, url: pick.source_url, page: pick.page, submit_min: (f && f.submitWithinMin) || 30 };
    render();
    if (rules) ph("checklist_shown", { slug: pick.slug, lines: rules.lines.length, caption_rules: captionChips().length, check: checkLines().length, length_rule: !!f.length, game_rule: f.game || null, docs_unread: (rules.docs || []).filter((d) => !d.read).length });
    ctx.onChange && ctx.onChange();
  }

  const fields = () => (rules && rules.fields) || null;
  function captionChips() {
    const f = fields(); if (!f) return [];
    const out = [];
    if (f.disclosure) out.push({ key: "#ad", label: "#ad" });
    for (const t of f.hashtags || []) out.push({ key: t, label: t });
    for (const t of f.mentions || []) out.push({ key: t, label: t });
    if (f.nameInCaption) out.push({ key: "name", label: f.nameInCaption });
    for (const t of f.captionText || []) out.push({ key: t, label: `“${t}”` });
    if (f.cta) out.push({ key: "cta", label: `Watch live: ${chanUrl}` });
    return out;
  }
  function checkLines() {
    if (!rules) return [];
    const seen = new Set();
    return rules.lines.filter((l) => l.group === "check" && !HIDE.has(l.kind) && !seen.has(l.kind + l.text) && seen.add(l.kind + l.text));
  }

  function lengthLine() {
    const f = fields(); const secs = Math.round(ctx.win.e - ctx.win.s);
    const L = f && f.length;
    if (!L) return { cls: "todo", label: "Length", text: `${secs} s · no length rule found: check the brief` };
    const max = L.max >= 600 ? null : L.max;
    const ok = secs >= (L.min || 0) && (max == null || secs <= max);
    const need = max == null ? `at least ${L.min} s` : L.min ? `${L.min}–${max} s` : `up to ${max} s`;
    return { cls: ok ? "ok" : "bad", label: "Length", text: ok ? `${secs} s · fits ${need}` : `${secs} s · needs ${need}` };
  }
  function gameLine() {
    const f = fields(); const want = f && f.game;
    const g = ctx.game() || {};
    const fit = gameFits(want, g.game);
    const src = g.source === "chapter" ? "Twitch chapter" : g.source === "kick" ? "Kick category" : g.source === "category" ? "stream category" : "";
    if (!want) return g.game ? { cls: "todo", label: "Game", text: `${shortGame(g.game)}${src ? " · " + src : ""} · no game rule found` } : null;
    if (fit.ok === null) return { cls: "todo", label: "Game", text: `unknown: check it is ${want}` };
    return { cls: fit.ok ? "ok" : "bad", label: "Game", text: fit.ok ? `${shortGame(g.game)}${src ? " · " + src : ""}` : `${shortGame(g.game)}: this campaign pays for ${want} clips only` };
  }
  st.gameProblem = () => { const f = fields(); if (!f || !f.game) return null; const g = ctx.game() || {}; const fit = gameFits(f.game, g.game); return fit.ok === false ? { game: shortGame(g.game), want: f.game, title: pick.title } : null; };

  function option(c) {
    const pay = c.expected_per_clip != null ? ` · ${money(c.expected_per_clip)} typical per clip` : c.cap_per_clip != null ? ` · up to ${money(c.cap_per_clip)} a clip` : "";
    return `<option value="${h(c.slug)}"${pick && pick.slug === c.slug ? " selected" : ""}>${h(c.title)}${c.pays_for === "general" ? " · any GTA clip" : pay}</option>`;
  }

  // The picker is drawn when the list or the pick changes; the checklist under it on every change
  // of the clip window, so a drag never resets the select.
  function render() {
    if (!root.isConnected) return;
    const name = vod.channel_name || vod.channel;
    const mine = list.filter((c) => c.pays_for !== "general");
    root.innerHTML = `<div class="camp-pick"><label for="campsel">Clipping for</label><select id="campsel"><option value="">No campaign</option>${list.map(option).join("")}</select></div>`
      + (mine.length ? "" : `<p class="small">No campaign pays for ${h(name)} clips right now. <a href="/gta-6-clipping-campaigns" target="_blank" rel="noopener">See what pays</a></p>`)
      + `<div class="ckbody"></div>`;
    root.hidden = false;
    renderBody();
  }
  function renderBody() {
    const body = root.querySelector(".ckbody");
    if (!body) return;
    const open = !!body.querySelector(".ckmore[open]");
    let html = "";
    if (pick && loading) html += `<p class="small">Reading the rules…</p>`;
    if (pick && failed) html += `<p class="small">Couldn’t read this campaign’s rules (${h(failed)}). <a href="${h(pick.source_url || pick.page || "/gta-6-clipping-campaigns")}" target="_blank" rel="noopener">Read the brief</a></p>`;
    if (pick && rules) {
      const gp = st.gameProblem();
      if (gp) html += `<div class="note gamewarn">This moment is ${h(gp.game)}, not ${h(gp.want)}. ${h(gp.title)} pays for ${h(gp.want)} clips only.</div>`;
      const rows = [lengthLine(), gameLine()].filter(Boolean);
      const chips = captionChips();
      const f = fields();
      let li = rows.map((r) => `<li class="${r.cls}" data-ck="${r.label.toLowerCase()}"><b>${r.label}</b> <span>${h(r.text)}</span></li>`).join("");
      if (chips.length) li += `<li class="${chips.some((c) => off.has(c.key)) ? "bad" : "ok"}" data-ck="caption"><b>Caption</b> <span>Added to your caption:</span> <span class="tags">${chips.map((c) => `<button type="button" class="tag${off.has(c.key) ? " off" : ""}" data-tag="${h(c.key)}" title="${off.has(c.key) ? "Add it back" : "Remove it"}">${h(c.label)} ${off.has(c.key) ? "+" : "✕"}</button>`).join("")}</span>${f.disclosure ? ` <span class="small">Also turn on the paid-promotion label when you post.</span>` : ""}</li>`;
      else li += `<li class="todo" data-ck="caption"><b>Caption</b> <span>no required tags found: check the brief</span></li>`;
      li += `<li class="todo" data-ck="submit"><b>Submit</b> <span>within ${st.campaign.submit_min} min of posting, from a linked account</span></li>`;
      const more = checkLines();
      const unread = (rules.docs || []).filter((d) => !d.read);
      html += `<ul class="ck">${li}</ul><div class="capline"><button type="button" class="btn sm ghost" data-copycap>Copy caption</button></div>`;
      html += `<details class="ckmore"${open ? " open" : ""}><summary>Check yourself (${more.length + unread.length})</summary><ul>${more.map((l) => `<li>${h(l.text.replace(/\s*\[game\]$/, ""))}</li>`).join("")}${unread.map((d) => `<li>Couldn’t read this rules page: <a href="${h(d.url)}" target="_blank" rel="noopener">${h(d.url.replace(/^https?:\/\//, "").slice(0, 48))}</a></li>`).join("")}</ul><p class="small"><a href="${h(pick.source_url)}" target="_blank" rel="noopener" data-brief>Read the brief</a></p></details>`;
    }
    body.innerHTML = html;
  }

  root.addEventListener("change", (e) => { if (e.target.id === "campsel") choose(e.target.value, true); });
  root.addEventListener("click", async (e) => {
    const t = e.target.closest("[data-tag]");
    if (t) { const k = t.dataset.tag; if (off.has(k)) off.delete(k); else off.add(k); ph("caption_tag_toggle", { on: !off.has(k), kind: k === "#ad" ? "disclosure" : k === "name" ? "name" : k === "cta" ? "cta" : k.startsWith("@") ? "mention" : k.startsWith("#") ? "hashtag" : "text" }); renderBody(); ctx.onChange && ctx.onChange(); return; }
    const c = e.target.closest("[data-copycap]");
    if (c) {
      let ok = false; try { await navigator.clipboard.writeText(st.caption()); ok = true; } catch (x) {}
      c.textContent = ok ? "Copied" : "Copy failed: select it in the post box"; ph("caption_copy", { ok });
      setTimeout(() => { if (c.isConnected) c.textContent = "Copy caption"; }, 2000);
    }
    if (e.target.closest("[data-brief]")) ph("campaign_brief_open", { slug: pick && pick.slug });
  });

  st.caption = () => buildCaption(ctx.hook(), fields(), off, chanUrl);
  st.update = () => { if (pick && rules) renderBody(); };
  start();
  return st;
}
