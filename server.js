const express = require("express");
const app = express();
app.use(express.json({ limit: "100kb" }));
app.use(express.urlencoded({ extended: false, limit: "100kb" }));

const PORT = process.env.PORT || 3000;
const TELNYX_API_KEY = process.env.TELNYX_API_KEY;
const TELNYX_CONNECTION_ID = process.env.TELNYX_CONNECTION_ID;
const TELNYX_FROM_NUMBER = process.env.TELNYX_FROM_NUMBER;
const PUBLIC_BASE_URL = (process.env.PUBLIC_BASE_URL || "").replace(/\/+$/, "");
const ALLOWED_RECIPIENTS = new Set(
  (process.env.ALLOWED_RECIPIENTS || "")
    .split(",").map(s => normalizePhone(s)).filter(Boolean)
);
const recentRequests = new Map();
const results = [];
const MAX_RESULTS = 100;

function normalizePhone(value) {
  const s = String(value || "").trim();
  if (!/^\+[1-9]\d{7,14}$/.test(s)) return "";
  return s;
}
function addResult(entry) {
  results.unshift({ at: new Date().toISOString(), ...entry });
  if (results.length > MAX_RESULTS) results.length = MAX_RESULTS;
}
function configReady() {
  return TELNYX_API_KEY && TELNYX_CONNECTION_ID && TELNYX_FROM_NUMBER &&
    PUBLIC_BASE_URL && ALLOWED_RECIPIENTS.size > 0;
}
function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({
    "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;"
  }[c]));
}

app.get("/health", (_req, res) => res.json({ ok: true }));

app.get("/", (_req, res) => {
  res.type("html").send(`<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Security Awareness Call Console</title>
<style>
:root{color-scheme:dark;--bg:#0b1020;--panel:#151d31;--line:#2a3652;--text:#f4f7ff;--muted:#aebbd4;--accent:#7dd3fc}
*{box-sizing:border-box}body{margin:0;background:linear-gradient(145deg,#0b1020,#111a30);color:var(--text);font:16px/1.5 system-ui,-apple-system,sans-serif}
main{max-width:760px;margin:auto;padding:24px 16px 48px}.eyebrow{color:var(--accent);font-size:.78rem;font-weight:800;letter-spacing:.12em;text-transform:uppercase}
h1{font-size:clamp(1.8rem,7vw,2.5rem);line-height:1.1;margin:.5rem 0}p,.muted{color:var(--muted)}.panel{background:var(--panel);border:1px solid var(--line);border-radius:18px;padding:18px;margin-top:16px}
label{display:block;font-weight:650;margin:14px 0 7px}input{width:100%;font:inherit;color:var(--text);background:#0c1426;border:1px solid #3a4968;border-radius:11px;padding:13px}
button{font:inherit;font-weight:750;border:0;border-radius:11px;padding:13px 16px;cursor:pointer}.primary{background:var(--accent);color:#082033;width:100%;margin-top:14px}.notice{border-left:3px solid var(--accent);padding-left:12px}.status{white-space:pre-wrap;background:#0c1426;border:1px solid var(--line);border-radius:11px;padding:12px;margin-top:12px}
table{width:100%;border-collapse:collapse;font-size:.9rem}td,th{text-align:left;padding:9px 6px;border-bottom:1px solid var(--line);vertical-align:top}th{color:var(--muted)}.pill{display:inline-block;border:1px solid var(--line);border-radius:99px;padding:3px 8px;color:var(--muted);font-size:.8rem}.check{display:flex;gap:10px;align-items:flex-start;font-weight:500}.check input{width:auto;margin-top:6px}small{color:var(--muted)}a{color:var(--accent)}
</style></head><body><main>
<div class="eyebrow">Authorized training only</div><h1>Security Awareness Call Console</h1>
<p>Place one clearly disclosed training call to a recipient who has agreed to participate. This app never requests or records passwords, banking details, or authentication codes.</p>
<div class="panel"><span class="pill">Single-recipient calls</span>
<form id="callForm">
<label for="recipient">Authorized recipient number</label>
<input id="recipient" name="recipient" type="tel" inputmode="tel" autocomplete="tel" placeholder="+14155550123" pattern="\\+[1-9][0-9]{7,14}" required>
<small>Use E.164 format, including + and country code. Only numbers pre-approved by the operator are accepted.</small>
<label class="check"><input id="consent" type="checkbox" required><span>I confirm this person agreed to receive this security-awareness training call.</span></label>
<button class="primary" id="submitBtn" type="submit">Start training call</button>
</form><div id="status" class="status" role="status" aria-live="polite">Ready. No call has been placed.</div></div>
<div class="panel"><h2>Call script</h2><p class="notice">“Hello. This is a security-awareness training exercise, not a real bank alert. This is a fictional suspicious-transaction scenario. Press 1 if you recognize the fictional transaction, or press 2 if you do not. Never share passwords or one-time security codes during a phone call.”</p></div>
<div class="panel"><h2>Recent outcomes</h2><p class="muted">The table stores call status and keypad choice only. It does not store call audio or sensitive codes.</p><div id="results">Loading…</div><button class="primary" type="button" id="refresh">Refresh results</button></div>
<p><small>Keep this console private. The result list is in server memory and resets when the service restarts. Use only with consent and follow applicable calling laws and your organization’s approved procedures.</small></p>
</main>
<script>
const form=document.getElementById('callForm'), statusBox=document.getElementById('status'), submitBtn=document.getElementById('submitBtn');
form.addEventListener('submit',async e=>{
 e.preventDefault();
 if(!document.getElementById('consent').checked)return;
 submitBtn.disabled=true; statusBox.textContent='Submitting call request…';
 try{
  const r=await fetch('/api/calls',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({recipient:document.getElementById('recipient').value.trim(),consent:true})});
  const data=await r.json(); if(!r.ok)throw new Error(data.error||'Request failed');
  statusBox.textContent='Call request accepted. Reference: '+data.callId+'. The recipient must be on the operator-approved list. Refresh outcomes after the call.';
  await refreshResults();
 }catch(err){statusBox.textContent='Could not start call: '+err.message}
 finally{submitBtn.disabled=false}
});
async function refreshResults(){
 const box=document.getElementById('results');
 try{
  const r=await fetch('/api/results');const data=await r.json();
  if(!data.results.length){box.innerHTML='<p class="muted">No call results yet.</p>';return}
  const rows=data.results.map(x=>'<tr><td>'+esc(new Date(x.at).toLocaleString())+'</td><td>'+esc(x.recipient||'')+'</td><td>'+esc(x.status||'')+'</td><td>'+esc(x.choice||'—')+'</td></tr>').join('');
  box.innerHTML='<div style="overflow-x:auto"><table><thead><tr><th>Time</th><th>Recipient</th><th>Status</th><th>Keypad</th></tr></thead><tbody>'+rows+'</tbody></table></div>';
 }catch(e){box.textContent='Could not load results.'}
}
function esc(s){return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
document.getElementById('refresh').addEventListener('click',refreshResults);refreshResults();
</script></body></html>`);
});

app.post("/api/calls", async (req, res) => {
  if (!configReady()) return res.status(503).json({ error: "Server setup is incomplete. Configure all required environment variables first." });
  const recipient = normalizePhone(req.body && req.body.recipient);
  if (!recipient) return res.status(400).json({ error: "Enter a valid number in international format, such as +14155550123." });
  if (!req.body || req.body.consent !== true) return res.status(400).json({ error: "Participant consent confirmation is required." });
  if (!ALLOWED_RECIPIENTS.has(recipient)) return res.status(403).json({ error: "This number is not on the operator-approved recipient list. Add only a consenting test participant to ALLOWED_RECIPIENTS." });

  const now = Date.now();
  const last = recentRequests.get(recipient) || 0;
  if (now - last < 60000) return res.status(429).json({ error: "Please wait at least 60 seconds before another call to this number." });
  recentRequests.set(recipient, now);

  try {
    const response = await fetch("https://api.telnyx.com/v2/calls", {
      method: "POST",
      headers: { "Authorization": `Bearer ${TELNYX_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        connection_id: TELNYX_CONNECTION_ID,
        to: recipient,
        from: TELNYX_FROM_NUMBER,
        webhook_url: `${PUBLIC_BASE_URL}/webhooks/telnyx`,
        webhook_url_method: "POST"
      })
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      recentRequests.delete(recipient);
      return res.status(502).json({ error: "Telnyx rejected the call request. Check the Voice App, number assignment, account balance, and API credentials." });
    }
    const callId = data.data && (data.data.call_control_id || data.data.call_leg_id || data.data.call_session_id) || "accepted";
    addResult({ callId, recipient, status: "initiated", choice: "" });
    res.json({ ok: true, callId });
  } catch (_e) {
    recentRequests.delete(recipient);
    res.status(502).json({ error: "Could not reach the voice provider. Try again later." });
  }
});

app.post("/webhooks/telnyx", async (req, res) => {
  // Acknowledge quickly; for production, verify Telnyx webhook signatures before acting on events.
  const event = req.body && req.body.data;
  if (!event || !event.event_type) return res.sendStatus(200);
  const payload = event.payload || {};
  const callControlId = payload.call_control_id;
  const findResult = () => results.find(x => x.callId === callControlId || (payload.to && x.recipient === payload.to && x.status === "initiated"));

  try {
    if (event.event_type === "call.answered" && callControlId) {
      const r = findResult();
      if (r) r.status = "answered";
      await fetch(`https://api.telnyx.com/v2/calls/${encodeURIComponent(callControlId)}/actions/gather_using_speak`, {
        method: "POST",
        headers: { "Authorization": `Bearer ${TELNYX_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          payload: "Hello. This is a security-awareness training exercise, not a real bank alert. This is a fictional suspicious-transaction scenario. Press 1 if you recognize the fictional transaction, or press 2 if you do not. Never share passwords or one-time security codes during a phone call.",
          voice: "female",
          language: "en-US",
          valid_digits: "12",
          maximum_digits: 1,
          timeout_millis: 10000,
          inter_digit_timeout_millis: 3000
        })
      });
    } else if (event.event_type === "call.gather.ended") {
      const r = findResult();
      const digits = payload.digits || payload.digit;
      if (r) {
        if (digits === "1" || digits === "2") {
          r.choice = digits;
          r.status = "completed";
        } else {
          r.status = "completed-no-valid-choice";
        }
      }
    } else if (["call.hangup", "call.machine.detection.ended"].includes(event.event_type)) {
      const r = findResult();
      if (r && r.status !== "completed") r.status = event.event_type === "call.hangup" ? "ended" : r.status;
    }
  } catch (_e) {
    // Do not expose provider credentials or webhook internals in responses.
  }
  res.sendStatus(200);
});

app.get("/api/results", (_req, res) => {
  res.set("Cache-Control", "no-store");
  res.json({ results: results.map(({ at, recipient, status, choice }) => ({ at, recipient, status, choice })) });
});

app.listen(PORT, () => console.log(`Training call app listening on ${PORT}`));
