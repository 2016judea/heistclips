// Hook word guard: words that get a TikTok or YouTube post removed, age-restricted or
// demonetized when they are burned into the video or put in its caption. Hook lines are made
// from chat and the moment, so chat's slurs and crude lines must never come back as a
// suggestion (desk/judge.js caught a crude word a hook had picked up from the game screen,
// 2026-11-19). Used in the browser (public/js/twitch.js topPhrase, public/js/app.js) and on the
// server (lib/cut.js, the burned-in hook of a server cut).
//
// Every language we serve is checked on every line: chat on an English stream is often Spanish
// or Portuguese. Matching is on whole words, case-insensitive, with common letter swaps
// (sh1t, n1gga, a$$) and stretched letters (fuuuck) folded. Accents are NOT folded: "pédé" is
// a French slur, "pede" is Portuguese for "asks".
//
// Entry syntax: a word; "*" at the end = any word starting with it; a space = one or more
// spaces. Ambiguous words are left out on purpose (PD is a police department in GTA, "bite" is
// English, "con" is Spanish for "with", "negro" is a colour, "cu" is Romanian for "with").

const LIST = {
  slur: [
    "nigga", "niggas", "nigger*", "nigg*", "faggot*", "fag", "fags", "retard*", "tranny", "trannies", "kike", "kikes", "spic", "spics", "chink", "chinks",
    "wetback*", "beaner*", "coon", "coons", "dyke", "dykes", "heil hitler", "sieg heil",
    "neger", "schwuchtel*", "kanake*", "spast", "spasti", "spastis", "zigeuner*", // de
    "nègre*", "négro*", "pédé", "pédés", "bougnoul*", "tapette", "youpin*", // fr
    "viado", "viados", "bicha", "bichas", "sapatão", // pt
    "maricón", "maricon", "maricones", "marica", "maricas", "sudaca*", "negrata*", // es
  ],
  sexual: [
    "porn*", "nude", "nudes", "naked", "nsfw", "sex", "sexy", "sexual*", "horny", "onlyfans", "tits", "titty", "titties", "boobs", "boobies",
    "pussy", "pussies", "dick", "dicks", "dickhead*", "cock", "cocks", "cocksuck*", "cum", "cumming", "cumshot*", "jizz*", "dildo*", "blowjob*",
    "handjob*", "milf*", "hentai", "bussy", "thot", "thots", "whore*", "slut*", "hoe", "hoes", "strip club", "stripclub", "lap dance", "wank*",
    "titten", "muschi", "fotze*", "nutte*", "hure", "huren", "nackt", "porno*", "ficken", "fick", "fickt", "gefickt", // de
    "salope*", "chatte", "pute", "putes", "partouze", // fr
    "buceta*", "xoxota*", "piroca*", "punheta*", "pornô", "foder", "transar", // pt
    "puta", "putas", "puto", "putos", "putita", "polla", "follar", "verga", "tetas", "desnudo", "desnuda", "desnudos", "desnudas", // es
  ],
  violence: [
    "kys", "kill yourself", "killyourself", "suicide", "suicidal", "self harm", "selfharm", "behead*", "decapitat*", "dismember*", "gore",
    "massacre", "genocide", "school shooting", "mass shooting", "rape", "raped", "rapes", "raping", "rapist*", "molest*", "pedo", "pedos", "pedophile*", "paedo*",
    "selbstmord", "vergewaltig*", "bring dich um", // de
    "viol", "violer", "violé", "violée", "suicide-toi", // fr
    "estupro", "estuprar", "estuprada", "estuprado", "suicídio", "se mata", // pt
    "violar", "violación", "violador*", "violada", "suicidio", "mátate", "matate", // es
  ],
  profanity: [
    "fuck*", "fck", "fuk", "fucc*", "motherfuck*", "mf", "shit", "shits", "shitty", "shitting", "bullshit", "cunt*", "ass", "asses", "asshole*",
    "arse", "arsehole*", "twat*", "bitch*",
    "scheiß*", "scheiss*", "arschloch*", "wichser*", "hurensohn*", // de
    "putain*", "merde*", "enculé*", "encule*", "connard*", "connasse*", "nique", "niquer", "niqué", "ntm", "fdp", // fr
    "porra", "caralho*", "foda", "fodase", "foda-se", "fodeu", "fodido", "fodida", "merda", "cuzão", "arrombad*", "vagabunda*", // pt
    "mierda*", "joder", "jodido", "jodida", "coño", "pendejo*", "pendeja*", "cabrón", "cabron", "cabrones", "chinga*", "culero*", "culo", "culos", // es
  ],
};

// One character in, one character out, so a match points at the same span of the original text.
const SWAP = { "0": "o", "1": "i", "3": "e", "4": "a", "5": "s", "7": "t", "@": "a", "$": "s" };
function fold(text) {
  let out = "";
  for (const ch of String(text || "")) {
    const lo = ch.toLowerCase();
    const one = [...lo].length === 1 ? lo : ch;
    out += SWAP[one] || (one.length === ch.length ? one : ch);
  }
  return out;
}

const escRe = (c) => c.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
// "fuck*" -> f(?:ff+)?u(?:uu+)?c(?:cc+)?k(?:kk+)?\p{L}*  (a letter, or a run of three or more of it:
// "fuuuck" matches, "rapper" does not match "rape")
function compile(entry) {
  const prefix = entry.endsWith("*");
  const word = prefix ? entry.slice(0, -1) : entry;
  let src = "";
  for (const ch of word) src += ch === " " ? "[\\s_.-]+" : ch === "-" ? "-?" : `${escRe(ch)}(?:${escRe(ch)}${escRe(ch)}+)?`;
  return src + (prefix ? "[\\p{L}\\p{N}]*" : "");
}
const RULES = Object.entries(LIST).flatMap(([cat, words]) => words.map((w) => ({ cat, w, re: compile(w) })));
// One regex, longest alternatives first so "motherfucker" wins over "fuck*" at the same spot.
// The word boundary before is a captured group, not a lookbehind: Safari before 16.4 throws on a
// lookbehind when the module loads, and this module loads with the clip tool.
const ALL = new RegExp(`(^|[^\\p{L}\\p{N}])(${RULES.map((r) => r.re).sort((a, b) => b.length - a.length).join("|")})(?![\\p{L}\\p{N}])`, "gu");
const CAT = RULES.map((r) => ({ cat: r.cat, re: new RegExp(`^(?:${r.re})$`, "u") }));

// Every guarded word in a line: [{ start, end, word, cat }], positions in the original text.
// fold() keeps one UTF-16 unit per unit except for the rare letter whose lower case is longer,
// which is left as it was, so indices line up.
export function scan(text) {
  const s = String(text || "");
  const f = fold(s);
  if (f.length !== s.length) return scanSlow(s);
  const out = [];
  for (const m of f.matchAll(ALL)) {
    const start = m.index + m[1].length, end = start + m[2].length;
    const hit = CAT.find((c) => c.re.test(m[2]));
    out.push({ start, end, word: s.slice(start, end), cat: hit ? hit.cat : "profanity" });
  }
  return out;
}
function scanSlow(s) { // fall back to a word-by-word check when folding changed the length
  const out = [];
  for (const m of s.matchAll(/[\p{L}\p{N}@$]+/gu)) for (const h of scan(m[0])) out.push({ ...h, start: h.start + m.index, end: h.end + m.index });
  return out;
}

export const flagged = (text) => scan(text).length > 0;

// "what the fuck" -> "what the f***". Keeps the line readable; the word cannot be read.
export function mask(text) {
  const s = String(text || "");
  const hits = scan(s);
  if (!hits.length) return s;
  let out = "", at = 0;
  for (const h of hits) {
    const chars = [...s.slice(h.start, h.end)];
    out += s.slice(at, h.start) + chars[0] + chars.slice(1).map((c) => (/\s/.test(c) ? c : "*")).join("");
    at = h.end;
  }
  return out + s.slice(at);
}

// Generated suggestions: a guarded line is dropped, never shown.
export function keepClean(lines) {
  const kept = [], dropped = [];
  for (const l of lines || []) (flagged(l) ? dropped : kept).push(l);
  return { kept, dropped };
}

export const CATEGORIES = Object.keys(LIST);
