# Aptamil R20C welcome screen

This branded webpage is hosted at a **separate GitHub Pages URL**. It looks up tag codes through the registration platform's Render API. It never connects directly to PostgreSQL and does not keep a browser-side guest list.

## End-to-end flow

1. At Station 2, the usher marks the attendee **Attending** in the installed Aptamil Android app.
2. The usher writes the attendee name to the NFC sticker with the phone. The app captures the tag's hardware ID and saves that ID, the calculated R20C 10-digit code, and the attendee name in the shared PostgreSQL database.
3. At the welcome screen, an R20C USB reader types its 10-digit code into the focused browser window. The welcome page requests the name from the Render API.
4. The page fades in **Welcome Dr. [name]**, holds it for 10 seconds, then fades back to idle. Unknown tags show a neutral message.

The current code calculation follows the documented R20C default: reverse the first four tag-ID bytes and print a zero-padded 10-digit decimal number. R20C variants can use other output formats. Before event use, write one final sticker with the Android phone and compare the code shown in its registration dialog or XLSX export with the number typed by the actual R20C. If they differ, adjust the conversion in `shared/r20.ts` before issuing guest tags. The reader hardware was unavailable during development, so this comparison remains unverified.

## GitHub Pages and Render setup

The repository includes `.github/workflows/welcome-pages.yml`, which publishes **only this `welcome/` folder** to GitHub Pages from the `main` branch. Enable **GitHub Actions** as the Pages source in the repository settings. The resulting URL is separate from the registration URL, typically `https://OWNER.github.io/REPOSITORY/`.

In the registration service's Render environment, set `WELCOME_ORIGIN` to the GitHub Pages **origin only**, such as `https://OWNER.github.io` (no repository path or trailing slash). This allows that page to call the API. The Render Blueprint prompts for this value; it can be added after the GitHub Pages URL is known. Keep `STAFF_ACCOUNTS_JSON` and `SESSION_SECRET` private on Render.

Open the GitHub Pages welcome URL on the computer with the R20C. A staff member enters the Render registration URL and signs in with one of the 15 existing staff accounts. The page stores only the Render URL in local storage; its session token remains in memory and expires after 14 hours or when the page is reloaded. Guests then tap their stickers without any setup or pairing.

## Free-plan availability

`render.yaml` keeps the Render web service and PostgreSQL database on **free** plans. While this welcome page remains open and signed in, it sends an authenticated heartbeat every 60 seconds to keep the API active. This is best effort: closing the page, browser timer throttling, a network interruption, Render restarts or suspensions, and free-plan limits can still make the API temporarily unavailable. The free PostgreSQL database expires after 30 days. Rehearse and confirm that the database will still exist on the event day. No software change can guarantee uninterrupted service on the free plan.

## Local check

Serve this folder as static files, for example `python -m http.server 8765 --directory welcome`, and open `http://localhost:8765`. For a local end-to-end test, set the registration API's `WELCOME_ORIGIN=http://localhost:8765`, run the API, and enter its local origin in the welcome sign-in form. The final GitHub Pages page must use HTTPS. Test with the actual R20C and stickers before the event.
