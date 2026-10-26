# Telnyx Security Awareness Training Call App

A small Node/Express app for consent-based training calls. It speaks a clear training disclosure, accepts keypad `1` or `2`, and tracks call status and the keypad choice. It never asks for or stores authentication codes, passwords, banking details, or call audio.

## Important limits

- Calls are restricted to numbers in `ALLOWED_RECIPIENTS` and the UI requires an operator to confirm participant consent.
- Add only test phones you control or participants who explicitly agreed to receive the exercise.
- This is a starter project. Before production use, add Telnyx webhook signature verification, durable database storage, authentication for the dashboard, and proper access controls.
- Results are stored in memory and reset when the service restarts.
- Never present the call as a real bank, government agency, or law-enforcement call unless formally authorized and configured under approved procedures.

## Deploy from an iPhone with GitHub + Render

1. Sign in to GitHub in Safari and create a **private** repository named `telnyx-training-call-app`.
2. Upload `server.js`, `package.json`, `render.yaml`, and this README to the repository (use **Add file → Upload files**).
3. Sign in at https://render.com in Safari. Choose **New → Blueprint**, connect GitHub, and select the repository. Render reads `render.yaml`.
4. In the Render service's **Environment** page, add:
   - `TELNYX_API_KEY`: your Telnyx API key (keep secret; never put it in client-side code).
   - `TELNYX_CONNECTION_ID`: the Call Control Application / connection ID from Telnyx.
   - `TELNYX_FROM_NUMBER`: your purchased Telnyx number in E.164 format, e.g. `+1...`.
   - `PUBLIC_BASE_URL`: your Render service URL, e.g. `https://your-service.onrender.com` (no trailing slash).
   - `ALLOWED_RECIPIENTS`: comma-separated E.164 numbers of consenting participants/test phones, e.g. `+14155550123,+14155550124`.
5. Deploy. Open the Render URL in Safari and test `/health`; it should return `{"ok":true}`.
6. In Telnyx Mission Control, create a Call Control Application and configure its webhook URL as `https://your-service.onrender.com/webhooks/telnyx` using POST. Associate your purchased number with that application and set the matching connection ID in Render.
7. Test with a number you control first. Confirm the call identifies itself as a training exercise and keypad `1` / `2` appears in the results dashboard.

## Troubleshooting

- `Server setup is incomplete`: check all five environment variables.
- Number not approved: add the consenting test number in `ALLOWED_RECIPIENTS` and redeploy/restart.
- Provider rejects calls: check account verification, outbound calling permissions, number voice capability, Call Control Application assignment, and account balance.
- Before any production deployment, implement signature verification for Telnyx webhooks and restrict the results endpoint behind authentication.
