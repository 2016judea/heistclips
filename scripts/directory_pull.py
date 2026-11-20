#!/usr/bin/env python3
"""Pull Anthropic's usage numbers for the heistclips Claude directory listing.

claude.ai/directory/manage/heistclips has no API, and a copied Chrome profile gets signed out of
claude.ai on its first request (/api/auth/logout, reauth=1; 2026-11-20). What works is Aidan's own
running Chrome: a background tab (his active tab stays in front) loads the manage page, reads the
Overview text (health, rank), then clicks the Usage tab's "Export CSV", which Chrome saves to
~/Downloads; the tab is closed after.

Writes, under ~/.config/heistclips/directory/ (private; the heistclips repo is public):
  exports/heistclips-usage-<UTC stamp>.csv   the raw export (30 days of daily history + live metrics)
  snapshots.json                             one row per read: the 30-day tiles, as before
Needs: Chrome running and signed in to claude.ai (Brick Mortar AI org), and
"Allow JavaScript from Apple Events" on (Chrome > View > Developer). No window is opened or focused.

  python3 scripts/directory_pull.py            # prints the new snapshot row
"""
import csv, glob, json, os, re, shutil, subprocess, sys, tempfile, time
from datetime import datetime, timezone

HOME = os.path.expanduser("~")
DIR = os.path.join(HOME, ".config/heistclips/directory")
EXPORTS = os.path.join(DIR, "exports")
SNAP = os.path.join(DIR, "snapshots.json")
DL = os.path.join(HOME, "Downloads")
PAGE = "/directory/manage/heistclips"

RUNNER = r'''
function run(argv) {
  const c = Application(Number(argv[0]));
  let tab = null;
  c.windows().forEach((w) => w.tabs().forEach((t) => { if (!tab && String(t.id()) === argv[1]) tab = t; }));
  if (!tab) return "no tab";
  const js = $.NSString.stringWithContentsOfFileEncodingError(argv[2], $.NSUTF8StringEncoding, null).js;
  return String(c.execute(tab, { javascript: js }));
}
'''
OPEN = r'''
function run(argv) {
  // A fresh background tab per run: Chrome allows one automatic download per tab, so the Export CSV
  // in a tab that already downloaded once is silently blocked (2026-11-20). The active tab is restored.
  const c = Application(Number(argv[0]));
  const w = c.windows[0];
  const keep = w.activeTabIndex();
  const t = c.Tab({ url: argv[1] });
  w.tabs.push(t);
  w.activeTabIndex = keep;
  const tabs = w.tabs();
  return String(tabs[tabs.length - 1].id());
}
'''
CLOSE = r'''
function run(argv) {
  const c = Application(Number(argv[0]));
  c.windows().forEach((w) => w.tabs().forEach((t) => { if (String(t.id()) === argv[1]) t.close(); }));
  return "closed";
}
'''


def chrome_pid():
    out = subprocess.run(["ps", "-axo", "pid,command"], capture_output=True, text=True).stdout
    for line in out.splitlines():
        if "Google Chrome.app/Contents/MacOS/Google Chrome" in line and "--user-data-dir" not in line and "--type=" not in line:
            return line.split()[0]
    sys.exit("Aidan's Chrome is not running")


def jxa(src, *args):
    with tempfile.NamedTemporaryFile("w", suffix=".js", delete=False) as f:
        f.write(src)
    try:
        return subprocess.run(["osascript", "-l", "JavaScript", f.name, *args], capture_output=True, text=True, timeout=60).stdout.strip()
    finally:
        os.unlink(f.name)


def in_tab(pid, tab, js):
    with tempfile.NamedTemporaryFile("w", suffix=".js", delete=False) as f:
        f.write(js)
    try:
        return jxa(RUNNER, pid, tab, f.name)
    finally:
        os.unlink(f.name)


def main():
    os.makedirs(EXPORTS, exist_ok=True)
    pid = chrome_pid()
    started = time.time()
    tab = jxa(OPEN, pid, "https://claude.ai" + PAGE)
    if not tab.isdigit():
        sys.exit("could not open a tab in Chrome: " + tab)
    try:
        overview = ""
        for _ in range(30):  # Overview text (health lives only there)
            time.sleep(1)
            overview = in_tab(pid, tab, "document.body ? document.body.innerText : ''")
            if "DIRECTORY RANK" in overview and "Accounts" in overview:
                break
        if "DIRECTORY RANK" not in overview:
            sys.exit("manage page did not load signed in: " + overview[:200])
        in_tab(pid, tab, "location.href = '%s?tab=usage'; 'ok'" % PAGE)
        state = None
        for _ in range(30):
            time.sleep(1)
            state = in_tab(pid, tab, """(function(){ const b = [...document.querySelectorAll('button')].find(b => /Export CSV/.test(b.innerText));
              if (!b || b.disabled || !/Accounts using it/.test(document.body.innerText)) return 'wait'; b.click(); return 'clicked'; })()""")
            if state == "clicked":
                break
        got = None
        for _ in range(20):
            new = [p for p in glob.glob(os.path.join(DL, "heistclips-usage*.csv")) if os.path.getmtime(p) >= started - 1]
            if new:
                got = max(new, key=os.path.getmtime); break
            time.sleep(1)
    finally:
        jxa(CLOSE, pid, tab)
    if not got:
        sys.exit(f"no CSV arrived in ~/Downloads (export: {state})")
    stamp = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H%MZ")
    dest = os.path.join(EXPORTS, f"heistclips-usage-{stamp}.csv")
    shutil.move(got, dest)

    # 3. Snapshot row from the export's live metrics + the Overview's health line.
    live = {}
    with open(dest, encoding="utf-8-sig") as f:
        for r in csv.DictReader(f):
            if r["section"] == "live_metrics" and r["key"] in ("", "30d") and r["value"]:
                live.setdefault(r["metric"], r["value"])
    health = re.search(r"HEALTH\s*\n(?:[^\n]*\n)*?\s*([A-Za-z][^\n]*)", overview)  # skip icon-glyph lines
    row = {
        "read_on": datetime.now(timezone.utc).strftime("%Y-%m-%d"),
        "read_at": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "connected": int(live["connected_users"]),
        "used_a_tool": int(live["tool_call_users"]),
        "tool_calls_30d": int(live["calls"]),
        "request_error_pct": round(float(live["request_error_rate"]) * 100, 1),
        "error_rate_pct": round(float(live["error_rate"]) * 100, 1),
        "disconnect_pct": round(float(live["disconnect_rate"]) * 100, 1),
        "rank": int(live["rank"]),
        "health": health.group(1).strip() if health else None,
        "listed_tools": len(re.findall(r"^(campaign_details|find_moments|list_feature_requests|live_gta_streams|rank_campaigns|request_a_feature|upvote_feature_request)$",
                                       overview.split("Tools ·")[-1], re.M)) or None,
        "source": "scripts/directory_pull.py: Export CSV + Overview text, " + os.path.basename(dest),
    }
    snaps = json.load(open(SNAP)) if os.path.exists(SNAP) else []
    snaps = [s for s in snaps if s.get("read_at") != row["read_at"]] + [row]
    json.dump(snaps, open(SNAP, "w"), indent=1)
    print(json.dumps(row))


if __name__ == "__main__":
    main()
