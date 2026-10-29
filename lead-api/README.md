# Infinity Iconic — Lead Engine (EasySocial · ManyChat optional)

Two jobs in one small server:

1. **Lead intake** — feed a lead (with consent) → the contact is found or created in **EasySocial** → lead data and tags saved → the right **first WhatsApp template** is sent through an EasySocial API campaign → the booking chatflow takes over.
2. **Chatbot brain** — EasySocial's chatbot calls `/api/es/brain` for every typed message (hi, emoji, "available?", "quick call?", "phone number?", location, "talk to a human", Hinglish…). It answers in the lead's language, remembers context in lead fields, and tells EasySocial when to hand over to a person or switch to the booking flow. No text goes unheard.

```
Intake page / Google Sheet / ads / Make         WhatsApp message from a lead
        │ POST /api/lead · /api/bulk                    │
        ▼                                               ▼
  Rules (consent · phone · quiet hours ·        EasySocial chatbot → Webhook node
  duplicates · members · season)                 GET /api/es/brain?leadId=…&message=…
        │                                               │  {message, lead_attributes}
        ▼  EasySocial client API                        ▼
  find → create → save lead_data + tags         If/Else on inf_handoff · inf_flow · inf_has_buttons
        │                                          ├─ Human Handover (team inbox)
        ▼  API campaign (approved template)        ├─ Chatflow switch → booking / plan match
  First WhatsApp message → booking chatflow        └─ Interactive buttons /api/es/buttons → loop
```

**Full click-by-click set-up:** `docs/easysocial-setup-guide.html`.

## Endpoints

| Endpoint | Used by | Does |
|---|---|---|
| `POST /api/lead` | intake page, sheet, Make/Zapier | one lead → first message |
| `POST /api/bulk` | intake page CSV | up to 200 rows |
| `GET  /api/health` | you | shows what is configured / missing (never the keys) |
| `GET|POST /api/es/brain` | EasySocial Webhook (n8n) node | reply text + lead attributes; `format=text|buttons|bool`, `numbered=1`, `debug=1` |
| `GET /api/es/buttons` | EasySocial API Interactive Button node | the ≤3 buttons for `ctx=[inf_ctx]` |
| `GET /api/es/list` | EasySocial API Interactive List node | 10-row main menu (+ language switch) |
| `GET|POST /api/es/webhook` | EasySocial Webhooks | verify token, HMAC signature check, logs WhatsApp messages to the sheet (`SHEET_LOG_URL`) |
| `GET|POST /api/es/concierge` | EasySocial API Basic Message node (after Error Fallback) | AI fallback: fast rules → Claude → approved reply; logs the conversation and alerts the desk |

Brain URLs carry `?key=ES_BRAIN_KEY`. Lead fields the brain writes: `inf_lang, inf_intent, inf_route, inf_ctx, inf_miss, inf_rep, inf_last_msg, inf_handoff, inf_flow, inf_has_buttons` (+ `inf_optout`, `inf_callback` when relevant).

## Concierge — AI fallback (free on Vercel)

For the live keyword chatflows (Instagram 6027, WhatsApp 6029): every message the keywords miss goes to `/api/es/concierge`.

1. **Fast rules** (no AI): visit plans ("kal subah aaunga", "I'll come in the evening"), CALL ME, a typed mobile number, price, "talk to a person".
2. **Claude** (`claude-haiku-5-5`) labels everything else: complaint, member request, timings, classes, general question, unclear…
3. **Approved templates** write the reply, in English or Hinglish. Never an exact price — if Claude writes a rupee amount, the approved ₹1,000–1,300 range message is sent instead. Offer lines vanish after `OFFER_ENDS` (top of `lib/concierge/compose.js`).
4. Reply goes back at once; then, in the background, `apps-script/Code.gs` (free, inside the lead Google Sheet) adds the conversation to **Conversations**, and for visits / call-backs / numbers / complaints / member requests adds a **Leads** row and emails the desk (same person + reason within 3 h → once).

Without `ANTHROPIC_API_KEY` it still works: rules + the helpful menu reply. Without `SHEET_LOG_URL` nothing is logged.

**Set-up**
1. Lead Google Sheet → Extensions → Apps Script → paste `apps-script/Code.gs`; set `SECRET` and `DESK_EMAIL`; run `setup` once (approve); Deploy → Web app → Execute as *Me*, access *Anyone* → copy the URL.
2. Vercel → Settings → Environment Variables: `CONCIERGE_KEY`, `ANTHROPIC_API_KEY`, `SHEET_LOG_URL`, `SHEET_LOG_SECRET` → redeploy.
3. EasySocial, each chatflow: **Utility → Error Fallback** → **Dynamic APIs → API Basic Message** with
   `https://<project>.vercel.app/api/es/concierge?key=CONCIERGE_KEY&message=[n8n_input_message]&phone=[phone]&name=[name]&leadId=[leadId]&platform=instagram` (`platform=whatsapp` on WhatsApp). Use whichever variable EasySocial offers for the customer's last message.
4. Test: `…/api/es/concierge?key=…&message=evening%20mein%20aata%20hu&debug=1`.

## What it does for every lead

| Situation | Result |
|---|---|
| New lead, consent given | Contact created, fields saved, first message sent → `sent` |
| Same number again within 24 h | Nothing sent → `duplicate` |
| Contact has opted out | Nothing sent, ever, unless they write first → `skipped_opted_out` |
| Active member | No sales message; tagged `intake_member_contact` for the desk → `skipped_member` |
| Session already booked | Reminders already running; tagged `intake_while_booked` → `skipped_booked` |
| Lapsed member fills a form | Gets the win-back flow instead of the new-lead flow |
| Broadcast row between 21:00 and 09:00 | Held → `deferred` (form / call / walk-in leads are always sent — they just asked) |
| Wrong phone, no consent, unknown goal | Rejected with the reason → `invalid` |
| Hindi / Hinglish note | `inf_lang = hi`, so every message uses the Mirror copy |
| Any date | `inf_season_at_intake` saved; messages read the live season from bot fields |

First source is never overwritten (`inf_source`); the latest is kept in `inf_last_source`.

## Entry types → first-touch flow

| `entry` | Flow (env var) | First message (Copy Library) |
|---|---|---|
| `walk_in_now`, `phone_call`, `website_form`, `google_form`, `meta_form`, `email` | `FLOW_FIRST_TOUCH_FORM` | `lead_form_welcome` → Morning / Evening / Weekend → slots |
| `missed_call` | `FLOW_FIRST_TOUCH_MISSED_CALL` | `lead_missed_call` |
| `ig_phone` | `FLOW_FIRST_TOUCH_IG_PHONE` | `lead_reengage` |
| `corporate` | `FLOW_FIRST_TOUCH_CORPORATE` | Corporate hand-off |
| `broadcast_walkin` | `FLOW_BROADCAST_WALKIN` | M1 walk-in broadcast |
| `broadcast_camp` | `FLOW_BROADCAST_CAMP` | M2 society camp |
| `broadcast_lapsed` | `FLOW_BROADCAST_LAPSED` | WF5 win-back |

## Set-up with EasySocial (recommended)
Follow `docs/easysocial-setup-guide.html`. In short: access token → lead fields + tags → one API campaign per first message (paste into `ES_CAMPAIGNS`) → deploy → chatbot with the brain node → webhooks → test with `DRY_RUN=1`, then `0`.

## Set-up with ManyChat (alternative, `PROVIDER=manychat`)

### 1 · ManyChat (Infinity's own account, Pro)
1. WhatsApp connected on +91 99530 04008; templates from the Copy Library approved.
2. **Settings → API → Generate API token.** Keep it secret.
3. **Ask ManyChat support to enable creating / importing WhatsApp contacts by phone through the API** for this account. ManyChat requires this permission before `createSubscriber` works with phone numbers. Until it is enabled, the API returns an error for *new* numbers (existing contacts still work) — see "Fallback" below.
4. Create custom fields (text unless noted): `inf_source`, `inf_last_source`, `inf_entry`, `inf_goal`, `inf_time`, `inf_area`, `inf_lang`, `inf_note`, `inf_expiry`, `inf_season_at_intake`, `inf_first_touch_at` (date-time).
5. Tags used: `intake_api`, `wa_optin`, `st_new`, `src_<entry>`, `intake_member_contact`, `intake_while_booked` (plus the stage tags you already have: `optout`, `st_member`, `st_won`, `st_trial_booked`, `st_lapsed`, `invalid_number`).
6. Create the 7 first-touch flows. **Each must start with a "Send WhatsApp template" step** (the contact has not messaged you, so a template is the only thing WhatsApp allows), then connect its buttons to the existing flows (WA-B booking, WA-M broadcast replies, WF5 win-back…). Copy each flow's ID (`content2026…`) from its URL.

### 2 · Deploy (Vercel, free tier is enough)
1. Import this folder as a new Vercel project (no build step).
2. Add the environment variables from `.env.example`. Start with `DRY_RUN=1`.
3. Open `https://<project>.vercel.app/api/health` — check `flows_missing` is empty and `season_today` is right.
4. Open `https://<project>.vercel.app/`, enter the intake key, send a test lead to your own number with `DRY_RUN=1`, then switch `DRY_RUN=0` and test again.
5. Set `ALLOWED_ORIGIN` to the project URL.

### 3 · Feed it
- **Intake page** (`/`): one lead, or a CSV of up to 200 rows (template downloadable from the page).
- **Any system** (website form handler, Make, Zapier, CRM):

```bash
curl -X POST https://<project>.vercel.app/api/lead \
  -H "Content-Type: application/json" -H "X-Intake-Key: $INTAKE_KEY" \
  -d '{"name":"Riya Sharma","phone":"98123 45610","entry":"website_form","consent":true,
       "goal":"Fat loss","time":"5–8 PM","area":"Omaxe Heights","source":"WEBSITE-FORM-GOOGLE"}'
```

- **Google Sheet** (desk register): Extensions → Apps Script, paste, set the two constants, add an "On form submit" or time-driven trigger:

```javascript
const API = 'https://<project>.vercel.app/api/lead';
const KEY = 'your-intake-key';
function sendNewRows() {
  const sh = SpreadsheetApp.getActiveSheet();
  const [head, ...rows] = sh.getDataRange().getValues();
  const col = n => head.indexOf(n);
  rows.forEach((r, i) => {
    if (r[col('status')]) return;                     // already sent
    const lead = {}; ['name','phone','entry','consent','goal','time','area','lang','source','note']
      .forEach(k => lead[k] = col(k) > -1 ? String(r[col(k)]) : '');
    const res = UrlFetchApp.fetch(API, { method: 'post', contentType: 'application/json',
      headers: { 'X-Intake-Key': KEY }, payload: JSON.stringify(lead), muteHttpExceptions: true });
    sh.getRange(i + 2, col('status') + 1).setValue(JSON.parse(res.getContentText()).status);
  });
}
```

## Fallback if ManyChat hasn't enabled phone creation yet
- Existing contacts (anyone who has ever messaged Infinity) still work.
- For brand-new numbers, the API answers `error` with ManyChat's message — nothing is lost: the row stays unsent and the desk sends the click-to-chat link `wa.me/919953004008` or the QR instead; once the person says "Hi", the normal flows run.

## Security
- Every request needs `X-Intake-Key`; without `INTAKE_KEY` set, only dry runs are accepted.
- The EasySocial / ManyChat tokens live only in Vercel env vars, never in the page.
- No lead data is stored by this API — EasySocial (or ManyChat) is the record. The brain keeps only a short warm cache of the last route per lead.
- Webhooks are checked with `x-hub-signature-256` when `ES_WEBHOOK_SECRET` is set.
- Only send to people who agreed to WhatsApp messages; the API refuses rows without consent.

## Test
```bash
npm test          # 19 intake + 202 brain + 15 EasySocial + 62 concierge checks — nothing is sent
npm run dev       # local server in DRY_RUN on http://localhost:3000
```

ManyChat endpoints used: `GET /fb/subscriber/findBySystemField`, `GET /fb/subscriber/getInfo`, `POST /fb/subscriber/createSubscriber`, `POST /fb/subscriber/setCustomFields`, `POST /fb/subscriber/addTagByName`, `POST /fb/sending/sendFlow`. Confirm field names in your account's API page (Settings → API) before going live; `MANYCHAT_PHONE_FIELD` can be changed without code edits.
