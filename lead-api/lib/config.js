// Central configuration. Every value comes from environment variables so the same
// code runs for any brand: copy the project, change the env, deploy.
const env = (k, d = '') => (process.env[k] ?? d).toString().trim();

export const CONFIG = {
  brand: env('BRAND_NAME', 'Infinity Iconic'),
  manychatBase: env('MANYCHAT_BASE', 'https://api.manychat.com'),
  manychatKey: env('MANYCHAT_API_KEY'),
  intakeKey: env('INTAKE_KEY'),              // shared secret the intake page / sheet must send
  dryRun: env('DRY_RUN', '0') === '1',       // 1 = log the ManyChat calls instead of sending
  phoneField: env('MANYCHAT_PHONE_FIELD', 'whatsapp_phone'), // createSubscriber field for WhatsApp
  timezone: env('TZ_NAME', 'Asia/Kolkata'),
  quietStart: Number(env('QUIET_START_HOUR', '21')), // broadcasts not sent from 21:00 …
  quietEnd: Number(env('QUIET_END_HOUR', '9')),      // … to 09:00 local time
  duplicateWindowHours: Number(env('DUPLICATE_WINDOW_HOURS', '24')),
  bulkMax: Number(env('BULK_MAX', '200')),
  bulkDelayMs: Number(env('BULK_DELAY_MS', '1200')),
  // ManyChat flow IDs ("flow_ns") — copy each from the flow's URL in ManyChat.
  flows: {
    form:        env('FLOW_FIRST_TOUCH_FORM'),        // WG4 lead_form_welcome → WA-B booking
    missed_call: env('FLOW_FIRST_TOUCH_MISSED_CALL'), // WG3 lead_missed_call
    ig_phone:    env('FLOW_FIRST_TOUCH_IG_PHONE'),    // S8 lead_reengage (gave phone on Instagram)
    walkin:      env('FLOW_BROADCAST_WALKIN'),        // M1 walk-in register
    camp:        env('FLOW_BROADCAST_CAMP'),          // M2 society camp
    lapsed:      env('FLOW_BROADCAST_LAPSED'),        // WF5 win-back
    corporate:   env('FLOW_FIRST_TOUCH_CORPORATE'),   // B2B hand-off
  },
};

// Which flow each entry type starts, and whether it is user-initiated
// (they just asked → send any hour) or a broadcast (respect quiet hours).
export const ENTRY = {
  website_form: { flow: 'form', initiated: true },
  meta_form:    { flow: 'form', initiated: true },
  google_form:  { flow: 'form', initiated: true },
  walk_in_now:  { flow: 'form', initiated: true },  // person at the desk right now
  phone_call:   { flow: 'form', initiated: true },  // desk took a call, caller agreed to WhatsApp
  missed_call:  { flow: 'missed_call', initiated: true },
  ig_phone:     { flow: 'ig_phone', initiated: true },
  email:        { flow: 'form', initiated: true },
  corporate:    { flow: 'corporate', initiated: true },
  broadcast_walkin: { flow: 'walkin', initiated: false },
  broadcast_camp:   { flow: 'camp', initiated: false },
  broadcast_lapsed: { flow: 'lapsed', initiated: false },
};
