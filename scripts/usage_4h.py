#!/usr/bin/env python3
"""Usage in 4-hour blocks (Central time) for the heistclips usage dashboard.

Writes two JSON files ({rows, meta}) to the directory given as argv[1]:
  heistclips_usage_4h.json  visitors, clips by where they were made, checkouts, payments
  heistclips_entry.json     people by how they first arrived, and how many made a clip
  heistclips_mcp.json       connector tool calls per 4-hour block, by caller (from 2026-11-19 11:00 CT)
  heistclips_directory.json Anthropic's own numbers for the Claude listing, copied from
                            scripts/directory_snapshots.json (hand-entered from claude.ai/directory/manage/heistclips;
                            no API — add a row each time someone reads the page)

Sources: PostHog (HogQL, creds in ~/Desktop/workspace/bricks/.env) and Stripe Checkout
(live key read from the heistclips Vercel project). Counting rules are in meta and in
ANALYTICS.md; the traps behind them are in the heistclips memory
reference_connector_usage_reads (2026-11-19).
"""
import json, os, sys, subprocess, urllib.request, urllib.parse, base64
from datetime import datetime, timedelta, timezone

OUT = sys.argv[1] if len(sys.argv) > 1 else "."
CT = timezone(timedelta(hours=-6))
START = datetime(2026, 11, 16, 12, tzinfo=CT)
TEAM = "team_XnhPzBEcaSfEmZFo9M2isLFY"

def env(path):
    out = {}
    for line in open(os.path.expanduser(path)):
        if "=" in line and not line.lstrip().startswith("#"):
            k, v = line.strip().split("=", 1)
            out[k] = v.strip().strip('"')
    return out

E = env("~/Desktop/workspace/bricks/.env")

def hog(sql):
    req = urllib.request.Request(f"{E['POSTHOG_HOST']}/api/projects/{E['POSTHOG_PROJECT_ID']}/query/",
        data=json.dumps({"query": {"kind": "HogQLQuery", "query": sql}}).encode(),
        headers={"Authorization": "Bearer " + E["POSTHOG_PERSONAL_API_KEY"], "Content-Type": "application/json"})
    d = json.load(urllib.request.urlopen(req, timeout=120))
    if "results" not in d: raise SystemExit(str(d)[:500])
    return d["results"]

# Bucket = 4-hour block in Central wall time, as a UTC timestamp string HogQL can group on.
B = "toStartOfInterval(timestamp - toIntervalHour(6), toIntervalHour(4))"
SINCE = START.astimezone(timezone.utc).strftime("%Y-%m-%d %H:%M:%S")

def by_bucket(sql):
    return {r[0][:16]: r[1:] for r in hog(sql)}

visitors = by_bucket(f"select {B} b, count(distinct person_id) from events where event='$pageview' and properties.$host='heistclips.com' and timestamp >= '{SINCE}' group by b")

# Browser clips: clip_render_done until clip_made took over (2026-11-19 20:19 UTC), then clip_made.
SWITCH = "2026-11-19 20:19:00"
browser = by_bucket(f"""select {B} b, count() from events where timestamp >= '{SINCE}' and (
  (event='clip_render_done' and properties.path is null and timestamp < '{SWITCH}') or
  (event='clip_made' and properties.path in ('browser','browser_server','queue') and timestamp >= '{SWITCH}')) group by b""")

# Connector cuts by caller, from mcp_tool_call (clip_made carries no caller). Counted: cut_clip that
# came back ok with a file. Adding cut_clip_status ran 25% over clip_made (89 vs 71, 11/19 20:20Z on);
# cut_clip alone was 77 for every caller, so it tracks the charged count within ~8%.
DELIVERED = "properties.ok = true and properties.tool='cut_clip' and properties.status is null"
claude = by_bucket(f"select {B} b, count() from events where event='mcp_tool_call' and {DELIVERED} and properties.client='claude' and coalesce(properties.client_ua,'') != 'claude-test-bench' group by b")
bot = by_bucket(f"select {B} b, count() from events where event='mcp_tool_call' and {DELIVERED} and properties.client_ua='Clipbot' group by b")

# Stripe Checkout, live. Our own test and probe sessions are dropped (device qa-test/probe*,
# product heistclips-probe, and the three lang-tagged sessions the translation agent opened 11/19).
vid = {"production": "fG8DSofZmlrV1q56"}  # STRIPE_SECRET_KEY, production
req = urllib.request.Request(f"https://api.vercel.com/v1/projects/heistclips/env/{vid['production']}?teamId={TEAM}",
    headers={"Authorization": "Bearer " + E["VERCEL_TOKEN"]})
SK = json.load(urllib.request.urlopen(req))["value"]
req = urllib.request.Request("https://api.stripe.com/v1/checkout/sessions?" + urllib.parse.urlencode({"limit": 100, "created[gte]": int(START.timestamp())}),
    headers={"Authorization": "Basic " + base64.b64encode((SK + ":").encode()).decode()})
sessions = json.load(urllib.request.urlopen(req))["data"]
TEST_LANG_SESSIONS = {"6687a453-8dc5-4761-8089-9009f095dc63", "98f7dbb9-e675-4ac6-8355-f8ca65bfad89", "7b46103b-d9ab-4b01-adef-013d4fdf2809"}
def ours(s):
    m = s.get("metadata") or {}
    dev = m.get("device", "")
    return m.get("product") != "heistclips" or dev == "qa-test" or dev.startswith("probe") or dev in TEST_LANG_SESSIONS

pay = {}
for s in sessions:
    if ours(s): continue
    t = datetime.fromtimestamp(s["created"], CT)
    k = t.replace(hour=t.hour - t.hour % 4, minute=0, second=0, microsecond=0).strftime("%Y-%m-%dT%H:%M")
    o, p, r = pay.get(k, (0, 0, 0))
    paid = s["payment_status"] == "paid"
    pay[k] = (o + 1, p + paid, r + (s["amount_total"] / 100 if paid else 0))

rows, now = [], datetime.now(CT)
t = START
while t <= now:
    k = t.strftime("%Y-%m-%dT%H:%M")  # Central wall time, as the HogQL buckets are keyed
    v = visitors.get(k, [0])[0]; cb = browser.get(k, [0])[0]; cc = claude.get(k, [0])[0]; cx = bot.get(k, [0])[0]
    o, p, r = pay.get(k, (0, 0, 0))
    rows.append({"bucket_start": t.isoformat(), "visitors": v, "clips_browser": cb, "clips_claude": cc, "clips_bot": cx,
                 "clips_total": cb + cc + cx, "checkouts_opened": o, "payments": p, "checkouts_unpaid": o - p,
                 "revenue_usd": round(r, 2), "partial": t + timedelta(hours=4) > now,
                 "data_through": now.strftime("%b %-d, %-I:%M %p") + " Central"})
    t += timedelta(hours=4)

ENTRY = """with p as (select person_id, argMin(properties.$current_url, timestamp) first_url, argMin(properties.$referring_domain, timestamp) ref,
  max(if(event in ('clip_render_done','clip_made'),1,0)) did from events where properties.$host='heistclips.com' group by person_id)
select multiIf(first_url ilike '%src=mcp%' or (first_url ilike '%/clip?q=%&t=%' and first_url not ilike '%src=%'), 'A link from Claude',
  ref ilike '%chatgpt%' or first_url ilike '%utm_source=chatgpt%', 'ChatGPT',
  first_url ilike '%src=tiktok%' or ref ilike '%tiktok%', 'TikTok',
  first_url ilike '%src=youtube%' or ref ilike '%youtube%' or ref ilike '%youtu.be%', 'YouTube', ref ilike '%google%', 'Google',
  ref ilike '%bing%' or ref ilike '%perplexity%' or ref ilike '%claude.ai%', 'Other AI and search',
  ref in ('$direct','') or ref is null, 'Direct or shared link', 'Other sites') ch,
  count() people, sum(did) clipped from p group by ch order by people desc"""
entry = [{"channel": c, "people": n, "clipped": k, "clip_rate": round(100 * k / n) if n else 0} for c, n, k in hog(ENTRY)]

# Connector tool calls by caller. mcp_tool_call began 2026-11-19 17:16 UTC, so the series starts with the
# 8 AM-noon CT block that day. Our own scripts, test benches and the clip desk are left out.
MCP_START = datetime(2026, 11, 19, 8, tzinfo=CT)
OURS = "('heistclips-desk','heistclips-verify','claude-test-bench','eng-lead-qa','vscode-agent-host','BrickBlueBot')"
CALLER = """multiIf(properties.client_ua ilike 'Claude-User%' or (properties.client='claude' and properties.client_ua is null), 'claude',
  properties.client='chatgpt', 'chatgpt', properties.client_ua='Clipbot', 'clipbot', 'other')"""
mcp = {}
for b, who, n, bad in hog(f"""select {B} b, {CALLER} who, count(), countIf(properties.ok = false) from events where event='mcp_tool_call'
  and coalesce(properties.client,'') != 'script' and coalesce(properties.client_ua,'') not in {OURS}
  and coalesce(properties.client_ua,'') not like 'hc-%' group by b, who"""):
    mcp.setdefault(b[:16], {})[who] = (n, bad)
mcp_rows, t = [], MCP_START
while t <= now:
    k = t.strftime("%Y-%m-%dT%H:%M"); m = mcp.get(k, {}); g = lambda w, i=0: m.get(w, (0, 0))[i]
    mcp_rows.append({"bucket_start": t.isoformat(), "calls_claude": g("claude"), "calls_chatgpt": g("chatgpt"), "calls_clipbot": g("clipbot"),
                     "calls_other": g("other"), "calls_total": sum(v[0] for v in m.values()), "claude_no_result": g("claude", 1),
                     "partial": t + timedelta(hours=4) > now, "data_through": now.strftime("%b %-d, %-I:%M %p") + " Central"})
    t += timedelta(hours=4)
directory = json.load(open(os.path.join(os.path.dirname(os.path.abspath(__file__)), "directory_snapshots.json")))

stamp = datetime.now(timezone.utc).isoformat(timespec="seconds")
code = open(__file__).read()
meta = [{"label": "usage_4h.py", "value": code, "type": "code", "lang": "python"}, {"label": "Built", "value": stamp}]
json.dump({"rows": rows, "meta": meta}, open(os.path.join(OUT, "heistclips_usage_4h.json"), "w"))
json.dump({"rows": entry, "meta": meta}, open(os.path.join(OUT, "heistclips_entry.json"), "w"))
json.dump({"rows": mcp_rows, "meta": meta}, open(os.path.join(OUT, "heistclips_mcp.json"), "w"))
json.dump({"rows": directory, "meta": meta}, open(os.path.join(OUT, "heistclips_directory.json"), "w"))
print(json.dumps(rows[-3:], indent=0)); print(json.dumps(entry, indent=0)); print(json.dumps(mcp_rows, indent=0))
