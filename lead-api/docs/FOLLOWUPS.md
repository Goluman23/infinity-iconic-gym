# Follow-ups & retargeting

The follow-up engine messages every lead at the right moment until they book, visit and join, or ask to stop.
Open `followup-simulator.html` (in this folder) to see every message and its timing.

## The cadence

| Stage | Messages |
|---|---|
| **New lead** (not booked) | 30 min after their last message · Instagram/Messenger: last chance at 21 h, asking for their WhatsApp number · day 1 · day 3 · day 7 · day 14 · day 30, then closed |
| **Visit booked** | 7:30 PM the evening before (morning sessions) · 3 h before (if booked ≥ 4 h ahead) · 1 h before (if booked ≥ 90 min ahead) · 3 h after the session time · no-show recovery on days 2, 5, 12 and 30 |
| **Visited** (not joined) | Thank-you after the visit · day 1 · day 3 · day 6 · day 14, then closed |
| **Joined** | Welcome after 1 h · day 7 check-in · day 30 referral + Google review |
| **Opted out** | One acknowledgement, then nothing |

- **Any reply** stops the sequence and restarts the clock from the reply.
- **"Stop", "not interested", "mat bhejo"** and similar opt the lead out.
- **CLOSE** ends everything.
- **Quiet hours:**
  - Nurture: 10 AM–8:30 PM.
  - Quick follow-ups: 8 AM–10:30 PM.
  - Visit reminders: 5 AM–9:30 PM.
- **Spacing:** at least 3 h between messages (reminders excepted), and at most one nurture message per 20 h.
- **Prices:** no exact price is ever quoted. The Diwali line disappears after 31 Oct.
- **Learning:** key steps have versions A and B.
  - Each version gets 20 sends first.
  - After that the better one (score: replies + 3 × bookings, per send) goes to most leads.
  - 15% of sends stay a random test.
  - Results are in the *Follow-up stats* tab.

## Channels and cost (Meta rules, India, from 1 Oct 2026)

| Channel | Inside 24 h of their last message | After 24 h |
|---|---|---|
| WhatsApp | Free reply, ₹0 | Approved template only. Utility (reminders, visit follow-ups): ₹0.145. Marketing (nurture): ₹1.09 |
| Instagram / Messenger | Free reply | Not allowed. The engine drops these steps, and EasySocial has no send API for them |

A lead who never replies costs about ₹5.50 over 30 days. A booked lead costs about ₹2–5.

## Install (Google Sheet "Infinity Leads" → Extensions → Apps Script)

1. Replace `Code.gs` with the new `apps-script/Code.gs`.
2. Add a file `FollowupEngine.gs` with the contents of `apps-script/FollowupEngine.gs`. This file is generated, so don't edit it.
3. Add a file `FollowupRunner.gs` with the contents of `apps-script/FollowupRunner.gs`.
4. Choose `installFollowupTrigger` in the function menu, click **Run**, and approve.
   - This creates the *Follow-ups*, *Follow-up log* and *Follow-up stats* tabs.
   - It also sets up a 10-minute timer.
5. Click **Deploy → Manage deployments → ✏️ → Version: New version → Deploy**. The web app URL stays the same.

Until you go live, every message is written to *Follow-up log* as **DRY RUN** and nothing reaches customers.

## Desk: how to use the *Follow-ups* tab

- **Stage**: set it to *Visited*, *Joined* or *Lost* after a visit or a call. The engine switches sequence within 10 minutes.
- **Session (IST)**: type the time a lead booked by phone or button, e.g. `03/11/2026 19:00`. The engine schedules the reminders.
- **Next step / Next due**: shows what goes out next and when.

## Going live (only after you approve)

1. In EasySocial, submit the templates in `followup-templates.csv` for Meta approval.
   - Do priority 1 first.
   - Use the template names exactly as given.
2. For each approved template, create an API campaign in EasySocial.
   - Add it to the Vercel env var `ES_CAMPAIGNS` under its campaign key, e.g. `fu_new_d1_A_en`.
   - The engine falls back from `fu_<step>_<A|B>_<en|hi>` to `fu_<step>_<en|hi>` to `fu_<step>`.
3. Add `ES_AUTH_KEY` (EasySocial API key) in Vercel. This is used for free replies inside 24 h.
4. Set `FOLLOWUP_LIVE=1` in Vercel and redeploy.
5. Ask EasySocial support to turn on the WhatsApp message webhook to `https://api.eqiconic.com/api/es/webhook`. Without it, replies that don't go through the concierge (for example button taps) are not seen.

## Changing the messages

- **Edit the text:** change `lib/followup/copy.js`.
- **Edit the timing:** change `lib/followup/engine.js`.
- **Then rebuild:**

```
npm test
node apps-script/build-followup-gs.mjs
node -e "import('./lib/followup/templates.js').then(m=>require('fs').writeFileSync('docs/followup-templates.csv',m.toCSV(m.templatePack())))"
```

Paste the new `FollowupEngine.gs` into Apps Script. If you changed the wording of a message that is sent as a template, resubmit that template.
