# Infinity Iconic — Infinity Gym by EQ Iconic

Single-page website for Infinity Gym, Sector 86, Greater Faridabad. Static HTML on Vercel — every push to `main` goes live on eqiconic.com.

## Current offer: Infinity Detox Offer (11–30 Nov 2026)

Edit the `OFFER` block in `index.html` (search for `OFFER — edit here`). The band, offer section, chat buttons and pop-up switch on at `start` and off after `end` (IST) by themselves. Preview with `?offer=on` / `?offer=off`.

- Yearly plan: **₹20,000 for 14 months** (12 + 2 extra) = ₹47 a day · ₹1,429 a month, + 1 month FREE for a friend or family member. Set in `OFFER.yearly`; every ₹ figure on the page is calculated from it
- 6-month plan: 2 months extra + 15 days FREE for a friend or family member
- Free friend/family memberships limited to the first 30. The 6-month plan shows no price.
- WhatsApp messages carry `Offer: Infinity Detox Offer (till 30 Nov)`. Use `utm_campaign=detox_2026` on ad links.

(The Diwali offer, 20 Oct–15 Nov, is in git history.)

## UTM links — use these as ad / bio destinations

The site reads the tag, remembers it for 30 days, and prints it at the bottom of every WhatsApp enquiry (`— via meta / paid_social / diwali_2026 / reel_rooftop · offer`), so each lead can be traced to its ad. Add `#offer` to land straight on the offer.

| Where | Link |
|---|---|
| Meta ads (set once in Ads Manager → URL parameters) | `https://www.eqiconic.com/#offer` + URL parameters: `utm_source=meta&utm_medium=paid_social&utm_campaign=diwali_2026&utm_content={{ad.name}}` |
| Meta ads — gift-card creative | `https://www.eqiconic.com/?utm_source=meta&utm_medium=paid_social&utm_campaign=diwali_2026_gift&utm_content={{ad.name}}#offer` |
| Instagram bio | `https://www.eqiconic.com/?utm_source=instagram&utm_medium=bio&utm_campaign=diwali_2026#offer` |
| Instagram story link sticker | `https://www.eqiconic.com/?utm_source=instagram&utm_medium=story&utm_campaign=diwali_2026#offer` |
| WhatsApp broadcast / status | `https://www.eqiconic.com/?utm_source=whatsapp&utm_medium=broadcast&utm_campaign=diwali_2026#offer` |
| Google Business Profile — website / offer post | `https://www.eqiconic.com/?utm_source=google&utm_medium=gbp&utm_campaign=diwali_2026#offer` |
| Flyer / standee QR code | `https://www.eqiconic.com/?utm_source=offline&utm_medium=qr&utm_campaign=diwali_2026&utm_content=flyer#offer` |

Rule of thumb: `utm_source` = platform, `utm_medium` = placement type, `utm_campaign` = the offer, `utm_content` = the specific creative.

## Performance setup

- Photos live in `img/` as WebP in 640 / 960 / full widths; the browser picks the right size per screen (`srcset`). Filenames carry a content hash, so they're cached for a year (`vercel.json`) and a changed photo gets a new name automatically.
- Hero image is preloaded with high priority; every other photo lazy-loads as you scroll.
- Google Fonts load without blocking first paint (`display=swap`).
- `og-cover.jpg` (1200×630) is the WhatsApp / Facebook link-preview image. `robots.txt` + `sitemap.xml` for Google.
- Lighthouse (mobile): Performance 95 · Accessibility 100 · Best Practices 100 · SEO 100. First paint ~2 s on 4G (was ~10 s).

## lead-api/

The Instagram + WhatsApp chatbot back end (EasySocial lead engine, AI concierge, desk alerts) lives in `lead-api/` and deploys as its own Vercel project (root directory `lead-api`). The website blocks `/lead-api/*`, so none of it is served on eqiconic.com. See `lead-api/README.md`.
