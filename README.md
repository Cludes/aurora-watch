# Aurora Watch - Australia

"Can I see the aurora australis tonight?" - a live space-weather dashboard that turns
NOAA's data into a plain-English verdict for every Australian state.

- **Tonight's outlook** - how far north aurora could currently reach.
- **Chances by state** - Tasmania, Victoria, SA, NSW, ACT, WA, QLD, NT ranked for the current Kp
  (each state has an approximate minimum Kp for the aurora to clear its southern horizon).
- **Live drivers** - planetary Kp, IMF Bz (south is good), solar-wind speed and density.
- **3-day Kp forecast** from NOAA.

No API key required - all data is from [NOAA SWPC](https://www.swpc.noaa.gov/) (DSCOVR/ACE),
which serves CORS-open JSON, so the browser fetches it directly (no proxy needed).

## Deploy
Static site on Cloudflare Pages. The GitHub Action (`.github/workflows/deploy-cf-pages.yml`)
ships it to the `aurora-watch` Pages project on every push to `master`
(secrets `CLOUDFLARE_API_TOKEN` + `CLOUDFLARE_ACCOUNT_ID`).

Live: https://aurora-watch.pages.dev
