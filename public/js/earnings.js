// /earnings: a clipper's views and earnings from campaigns hosted on heistclips, and where to
// send payouts. The account code arrives in the link's fragment (#a=hc_…, from my_earnings), so
// it never reaches a server log; it is kept in localStorage for the next visit.
const $ = (id) => document.getElementById(id);
const KEY = "hc_earn_acct";
const ev = (name, props = {}) => { try { window.posthog && window.posthog.capture(name, { ...props, page: "earnings" }); } catch (e) {} };
const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const money = (x) => "$" + Number(x || 0).toFixed(2);
const ACCT = /^hc_[A-Za-z0-9_-]{32}$/;
const post = async (op, body) => (await fetch("/api/hosted?op=" + op, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) })).json().catch(() => ({ ok: false, error: "No answer. Try again." }));

let acct = "";
try { acct = localStorage.getItem(KEY) || ""; } catch (e) {}
const h = new URLSearchParams(location.hash.slice(1));
if (ACCT.test(h.get("a") || "")) { acct = h.get("a"); try { localStorage.setItem(KEY, acct); } catch (e) {} history.replaceState(null, "", location.pathname); }

async function load() {
  $("e-acct").textContent = "";
  const d = await post("earnings", { a: acct });
  if (!d.ok) { $("f-acct").hidden = false; $("e-acct").textContent = acct ? d.error || "Not found." : ""; return; }
  $("f-acct").hidden = true;
  $("e-nums").innerHTML = `<li><b>${money(d.total_earned)}</b><span>earned</span></li><li><b>${money(d.paid)}</b><span>paid</span></li><li><b>${money(d.owed)}</b><span>owed</span></li>`;
  $("e-nums").hidden = false;
  const acc = (d.verified_accounts || []).map((a) => `${a.platform === "youtube" ? "YouTube" : "TikTok"} ${esc(a.profile)}`).join(", ");
  $("e-lede").textContent = acc ? `Verified: ${acc}.` : "No verified account yet: ask your assistant to verify_account.";
  $("e-subs").innerHTML = (d.submissions || []).length ? `<ul class="subs">${d.submissions.map((s) => `<li><a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.campaign)}</a><span>${s.views == null ? "views: first read soon" : Number(s.views).toLocaleString("en-US") + " views"}</span><span>${money(s.earned)}</span><span class="small">${esc(s.status)}</span></li>`).join("")}</ul>` : `<p class="small">${esc(d.note)}</p>`;
  $("s-pay").hidden = false;
  if (d.payout_set) { $("t-pay").textContent = "Payouts: set. Change where they go?"; }
  ev("earnings_view", { subs: (d.submissions || []).length, payout_set: d.payout_set });
}

$("f-acct").addEventListener("submit", (e) => { e.preventDefault(); acct = $("i-acct").value.trim(); try { localStorage.setItem(KEY, acct); } catch (x) {} load(); });
$("f-pay").addEventListener("submit", async (e) => {
  e.preventDefault(); $("e-pay").textContent = "";
  const d = await post("payout", { a: acct, to: $("i-pay").value });
  if (d.ok) { $("t-pay").textContent = "Saved. Payouts go there."; $("i-pay").value = ""; ev("payout_set_web"); } else $("e-pay").textContent = d.error || "That did not work.";
});

// A link pasted while the page is open only changes the fragment: no reload, so read it here.
addEventListener("hashchange", () => {
  const a = new URLSearchParams(location.hash.slice(1)).get("a") || "";
  if (!ACCT.test(a)) return;
  acct = a; try { localStorage.setItem(KEY, acct); } catch (e) {}
  history.replaceState(null, "", location.pathname); load();
});
if (acct) load(); else $("f-acct").hidden = false;
