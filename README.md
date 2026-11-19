# Aptamil R20C welcome screen

This is a separate GitHub Pages site. Its R20C USB reader types a 10-digit code into the focused browser window. The page asks the Aptamil registration API for the matching attendee name, fades out **Welcome to Aptamil Lunch Event**, fades in the saved name for 10 seconds, then fades back to idle. The Aptamil logo stays visible throughout. No sign-in or setup form appears on the screen.

## Deployment

1. Set `window.APTAMIL_API_ORIGIN` in `config.js` to the actual HTTPS origin of the Render registration service. The provided value assumes Render assigned `https://aptamil-registration-platform.onrender.com`; check the service URL in Render before publishing. This file contains a public URL, never a password or staff token.
2. Publish this folder as its own GitHub Pages repository at `https://sirkil.github.io/Aptamil_Welcome_Screen/`.
3. In Render, set `WELCOME_ORIGIN` to that GitHub Pages URL. The registration server extracts `https://sirkil.github.io` for browser access checks. Deploy the updated registration server before testing the welcome page.
4. Open the welcome page on the computer with the R20C reader. Leave the browser window focused and tap a sticker. The reader should type its 10-digit code; the page requests the matching name.

Staff can also open **Monitor** in the registration platform, choose **Assign code** beside a guest, and scan or type the exact 10 digits from the R20C. This stores the code in the database even when the NFC written status has not been marked. An existing assignment can be corrected or removed there. Each code can belong to only one guest.

The welcome lookup is available to requests carrying the configured browser origin and is rate limited. A static GitHub Pages site cannot keep a staff password secret, so no staff credentials are embedded here. The registration and settings APIs still require staff sign-in.

## Hardware check

The registration app derives the R20C code from the NFC tag ID. Before event use, write one final sticker with the Android phone and compare the code shown in its registration dialog or XLSX export with the digits typed by the actual R20C. The reader was not available during development, so this physical comparison remains unverified.

## Free-plan availability

The page sends a database-backed heartbeat every 60 seconds while open. Free Render services can still spin down, restart, or take time to wake, and free PostgreSQL has a limited lifetime. Keep the kiosk open during the event and verify `/health` before guests arrive. Continuous availability cannot be guaranteed on the free plan.
