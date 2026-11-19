// The request board reads in the viewer's language. A request is translated ONCE, when it is
// filed (or backfilled), and the translations are stored on the item; a page view never calls a
// model. The original text and its language code are always kept.
//
// To add a language: add its code to TR_LANGS and its names to LANG_WORDS, then run
// `node scripts/translate_board.mjs` once to backfill. Nothing else changes.
export const TR_LANGS = ["en", "de", "fr"];
export const MODEL = "claude-haiku-5-5";
// A ceiling on model calls a day from the public board, on top of the 3-requests-a-day limit per
// connection: a spam burst cannot run up a bill. (~700 tokens a call; 200 calls is cents.)
export const TR_DAILY_CAP = 200;

// "Translated from German", in the viewer's language. Unknown codes fall back to the code.
export const LANG_WORDS = {
  en: { en: "English", de: "German", fr: "French", es: "Spanish", pt: "Portuguese", hi: "Hindi", it: "Italian", tr: "Turkish", pl: "Polish", ru: "Russian", ar: "Arabic", nl: "Dutch", from: (n) => `Translated from ${n}`, show: "show original", hide: "show translation" },
  de: { en: "aus dem Englischen", de: "aus dem Deutschen", fr: "aus dem Französischen", es: "aus dem Spanischen", pt: "aus dem Portugiesischen", hi: "aus dem Hindi", it: "aus dem Italienischen", tr: "aus dem Türkischen", pl: "aus dem Polnischen", ru: "aus dem Russischen", ar: "aus dem Arabischen", nl: "aus dem Niederländischen", from: (n) => `Übersetzt ${n}`, show: "Original anzeigen", hide: "Übersetzung anzeigen" },
  fr: { en: "de l’anglais", de: "de l’allemand", fr: "du français", es: "de l’espagnol", pt: "du portugais", hi: "du hindi", it: "de l’italien", tr: "du turc", pl: "du polonais", ru: "du russe", ar: "de l’arabe", nl: "du néerlandais", from: (n) => `Traduit ${n}`, show: "voir l’original", hide: "voir la traduction" },
};
export function fromLabel(viewer, code) {
  const W = LANG_WORDS[viewer] || LANG_WORDS.en;
  return { from: W[code] ? W.from(W[code]) : LANG_WORDS.en.from(code.toUpperCase()), show: W.show, hide: W.hide };
}

// "de-AT,de;q=0.9,en;q=0.8" -> "de"; anything we do not serve -> "en".
export function pickViewerLang(...candidates) {
  for (const c of candidates) {
    for (const part of String(c || "").split(",")) {
      const code = part.trim().split(";")[0].slice(0, 2).toLowerCase();
      if (TR_LANGS.includes(code)) return code;
      if (code) break; // the first listed language decides; do not skip down to a weaker one
    }
  }
  return "en";
}

const SYSTEM = `You translate short posts on the public feature-request board of heistclips, a tool clippers use to cut Twitch and Kick streams into TikTok, YouTube Shorts and Instagram Reels clips.

You get a JSON object of named text fields. Detect the language the fields are written in, then translate every field into each target language.

Rules:
- Write the way a clipper would say it in that language: natural, casual, short. Keep slang and gaming words natural (clip, facecam, VOD, stream, hook, render, layout stay as they are where that language's clippers use the English word).
- Never translate or alter: channel and streamer names, stream or VOD ids and links, request ids (like rmwmh8d74), product names (heistclips, Twitch, Kick, TikTok, YouTube, Shorts, Reels, Claude, ChatGPT), file formats (MP4, MP3, 9:16), numbers and timestamps.
- Keep the meaning and the tone exactly. Add nothing, explain nothing, do not soften or fix the request. Keep punctuation habits ("????" stays).
- If a field holds the same message twice in two languages (for example "English text / German text"), treat it as ONE message: return it once per language, and report the language of its first half as "lang".
- A field that is only a number, an id or a name is returned unchanged in every language.
- "lang" is the ISO 639-1 code of the original text (en, de, fr, es, pt, hi, ...). If the fields are too short to tell, use "en".

Answer with one JSON object and nothing else:
{"lang":"<code>","tr":{"<target>":{"<field>":"<text>", ...}, ...}}`;

// fields: {title, detail} or {response}. Returns {lang, tr} or null (no key, over the cap, bad answer).
export async function translateFields(fields, opts = {}) {
  // One retry: a long bug report now and then comes back as JSON cut short.
  return (await translateOnce(fields, opts)) || (await translateOnce(fields, opts));
}
async function translateOnce(fields, { targets = TR_LANGS, timeoutMs = 25000 } = {}) {
  const key = process.env.ANTHROPIC_API_KEY;
  const clean = Object.fromEntries(Object.entries(fields).filter(([, v]) => v && String(v).trim()).map(([k, v]) => [k, String(v).slice(0, 600)]));
  if (!key || !Object.keys(clean).length) return null;
  try {
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST", signal: AbortSignal.timeout(timeoutMs),
      headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json" },
      body: JSON.stringify({ model: MODEL, max_tokens: 3000, system: SYSTEM, messages: [{ role: "user", content: `Target languages: ${targets.join(", ")}\n\n${JSON.stringify(clean)}` }] }),
    });
    if (!r.ok) return null;
    const d = await r.json();
    const txt = (d.content || []).filter((c) => c.type === "text").map((c) => c.text).join("");
    const m = txt.match(/\{[\s\S]*\}/);
    const out = JSON.parse(m ? m[0] : txt);
    const lang = String(out.lang || "en").slice(0, 2).toLowerCase();
    if (!/^[a-z]{2}$/.test(lang) || !out.tr) return null;
    const tr = {};
    for (const t of targets) {
      if (!out.tr[t]) continue;
      tr[t] = {};
      for (const k of Object.keys(clean)) if (typeof out.tr[t][k] === "string" && out.tr[t][k].trim()) tr[t][k] = out.tr[t][k].replace(/\s+/g, " ").trim().slice(0, 700);
    }
    return { lang, tr };
  } catch (e) { return null; }
}

// Store translations on a board item. Title/detail and the response are separate calls because
// they are written by different people at different times, often in different languages.
export async function translateItem(item, { force = false } = {}) {
  let calls = 0;
  if (force || !item.tr || TR_LANGS.some((l) => !item.tr[l])) {
    const t = await translateFields({ title: item.title, detail: item.detail }); calls++;
    if (t) { item.lang = t.lang; item.tr = t.tr; }
  }
  if (item.response && (force || !item.response_tr || TR_LANGS.some((l) => !item.response_tr[l]))) {
    const t = await translateFields({ response: item.response }); calls++;
    if (t) {
      item.response_lang = t.lang;
      item.response_tr = Object.fromEntries(Object.entries(t.tr).map(([l, v]) => [l, v.response]).filter(([, v]) => v));
      // A bilingual "English / German" line becomes one line in its own language.
      if (item.response_tr[t.lang] && / \/ /.test(item.response)) item.response = item.response_tr[t.lang];
    }
  }
  if (!item.response) { delete item.response_tr; delete item.response_lang; }
  return calls;
}

// What one viewer sees for one item.
export function localize(item, viewer = "en") {
  const src = item.lang || "en";
  const t = item.tr && item.tr[viewer];
  const translated = !!(t && src !== viewer && t.title);
  const rsrc = item.response_lang || "en";
  const rt = item.response_tr && item.response_tr[viewer];
  return {
    title: translated ? t.title : item.title,
    detail: translated ? t.detail || "" : item.detail,
    lang: src, translated,
    original: translated ? { lang: src, title: item.title, detail: item.detail || "" } : null,
    response: item.response ? (rt && rsrc !== viewer ? rt : item.response) : null,
  };
}
