// Spoiler filter: flag moments that show story spoilers, for campaigns that ban them.
// Reads only what moment-finding already read: the chat around the spike and the stream title.
// Runs in the browser and in Node (the MCP server) unchanged. No model, no extra requests.
//
// Three kinds of evidence, strongest first:
//   warn  - chat itself says spoiler ("SPOILER", "no spoilers", "don't spoil")
//   end   - chat talks about the ending (ending, final mission, credits, epilogue)
//   story - chat reacts to a plot beat (cutscene, plot twist, a character dying, betrayal)
// Words are matched in English, German, Spanish, Portuguese and French, since chat is.

const WARN = /\b(spoil(?:er|ers|ed|ing|s)?|spoiler(?:n|t)?|spoilea\w*|espoiler\w*|spoilern)\b/i;
const END = /\b(ending|endings|the end\b|final mission|last mission|final boss|last boss|end ?credits|credits (?:roll|scene|are)|post[- ]credit\w*|epilogue|finale|beat the game|finished the (?:game|story)|story (?:is )?(?:over|done|complete)|100%|das ende|letzte mission|abspann|el final|final del juego|ultima mision|última misión|creditos|créditos|o final|ultima missao|última missão|la fin|derniere mission|dernière mission|generique|générique)\b/i;
const STORY = /\b(cut ?scene|cinematic|plot ?twist|twist|story mission|main mission|mission passed|mission complete|chapter \d+|act \d+|(?:he|she|they|\w+) (?:dies|died|is dead|gets? killed|got killed|was killed|betray(?:s|ed)?)|dies\b|death scene|killed off|betray(?:al|ed|s)?|traitor|reveal(?:ed)?|lore|zwischensequenz|stirbt|verrat|verr[aä]ter|cinem[aá]tica|muere|murio|murió|traici[oó]n|traidor|morre|morreu|trai[cç][aã]o|cin[eé]matique|meurt|trahison)\b/i;
// A title that says the stream is a story run, or asks chat not to spoil: story beats are likely.
const STORY_TITLE = /\b(no spoil\w*|spoiler[- ]?free|sin spoilers?|keine spoiler|sem spoilers?|pas de spoil\w*|story|storyline|story mode|campaign|playthrough|walkthrough|first (?:time|look|playthrough)|blind|ending|final mission|finale|part \d+|ep(?:isode)? ?\d+|day ?1|launch|100%|historia|história|histoire|geschichte)\b/i;

export const SPOILER_KINDS = { warn: "chat warns about spoilers", end: "chat is talking about the ending", story: "chat is reacting to a story scene" };

export function storyStream(vod) {
  return !!(vod && STORY_TITLE.test(String(vod.title || "")));
}

// -> { spoiler: bool, level: "none"|"possible"|"likely", kind, reason, lines }
export function spoilerCheck(vod, m) {
  const msgs = (m && m.chat) || [];
  const hit = { warn: [], end: [], story: [] };
  for (const x of msgs) {
    const t = String(x.text || "");
    if (t.length > 200) continue;
    if (WARN.test(t)) hit.warn.push(t); else if (END.test(t)) hit.end.push(t); else if (STORY.test(t)) hit.story.push(t);
  }
  const titled = storyStream(vod);
  const n = hit.warn.length + hit.end.length + hit.story.length;
  // A lone "twist" or "RIP" in a fast chat is noise. A story-run title halves what it takes.
  const need = titled ? 2 : 3;
  let kind = null;
  if (hit.warn.length >= (titled ? 1 : 2)) kind = "warn";
  else if (hit.end.length >= 2 || (hit.end.length && n >= need)) kind = "end";
  else if (hit.story.length >= need || n >= need + 1) kind = "story";
  if (!kind) return { spoiler: false, level: "none", kind: null, reason: null, lines: 0 };
  const sample = (hit[kind][0] || "").replace(/\s+/g, " ").trim();
  const quote = sample ? ` (“${[...sample].slice(0, 40).join("")}${[...sample].length > 40 ? "…" : ""}”)` : "";
  const reason = `${SPOILER_KINDS[kind]}: ${n} line${n === 1 ? "" : "s"}${quote}${titled ? "; the title marks this as a story stream" : ""}`;
  return { spoiler: true, level: kind === "story" && !titled ? "possible" : "likely", kind, reason, lines: n };
}

// Annotate in place; returns how many were flagged.
export function markSpoilers(vod, moments) {
  let n = 0;
  for (const m of moments) { m.spoiler = spoilerCheck(vod, m); if (m.spoiler.spoiler) n++; }
  return n;
}
