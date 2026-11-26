# Aptamil R20C welcome screen

This is a separate GitHub Pages site. Its R20C USB reader types a 10-digit code into the focused browser window. The page asks the Aptamil registration API for the matching attendee name. At rest, the combined Aptamil Innovation Pavilion logo is centered over the pavilion background. A scan moves the logo upward, then shows **WELCOME** and the attendee name prefixed with **Dr.** for 10 seconds before returning to idle. An existing **Dr.** prefix is not repeated. No guest title is displayed. The guest display opens without sign-in or visible controls.

The welcome artwork comes from the supplied layered 3840 × 1152 PSD: `pavilion-frame.jpg`, `pavilion-grade.png`, `pavilion-light-line.png`, and `pavilion-logo.png`. The background layers and logo remain separate so the logo can animate. The page bundles Poppins locally under `fonts/` with its Open Font License.

`CTA.gif` appears on the left of the welcome view. Press **W** to show every submitted attendee name in the animated rain view. That view refreshes from the registration database every 10 seconds and keeps repeated names as separate entries. Press **Q** to open the controls, then **Q** again to return to the welcome view. The rain view requires the registration server's `/api/welcome/names` endpoint, so publish the registration server update as well as this welcome page update.

## Background GIF

The provided `pavilion-background.gif` sits beside `index.html`. The page plays a smaller MP4 version of the same animation so the background appears sooner, and uses the GIF if video playback fails. The PSD frame remains visible until the animation starts. The background and artwork cover the full browser viewport without stretching; edges are cropped when the screen aspect ratio differs. Change `window.APTAMIL_BACKGROUND_VIDEO` and `window.APTAMIL_BACKGROUND_GIF` in `config.js` to use different files.

## Deployment

1. Set `window.APTAMIL_API_ORIGIN` in `config.js` to the actual HTTPS origin of the Render registration service. The provided value assumes Render assigned `https://aptamil-registration-platform.onrender.com`; check the service URL in Render before publishing. This file contains a public URL, never a password or staff token.
2. Publish this folder as its own GitHub Pages repository at `https://sirkil.github.io/Aptamil_Welcome_Screen/`.
3. In Render, set `WELCOME_ORIGIN` to that GitHub Pages URL. The registration server extracts `https://sirkil.github.io` for browser access checks. Deploy the updated registration server before testing the welcome page.
4. Open the welcome page on the computer with the R20C reader. Leave the browser window focused and tap a sticker. The reader should type its 10-digit code; the page requests the matching name.

Staff can also open **Monitor** in the registration platform, choose **Assign code** beside a guest, and scan or type the exact 10 digits from the R20C. This stores the code in the database even when the NFC written status has not been marked. An existing assignment can be corrected or removed there. Each code can belong to only one guest.

The welcome lookup is available to requests carrying the configured browser origin and is rate limited. A static GitHub Pages site cannot keep a staff password secret, so no staff credentials are embedded here. The registration and settings APIs still require staff sign-in.

## Hardware check

The registration app derives the R20C code from the NFC tag ID. Before event use, write one final sticker with the Android phone and compare the code shown in its registration dialog or XLSX export with the digits typed by the actual R20C. The reader was not available during development, so this physical comparison remains unverified.

## Kiosk controls and Arduino

1. Upload `Feature01BlueLed.ino` to the Nano, close Arduino IDE Serial Monitor, and plug both the R20C reader and Nano into the kiosk computer by USB.
2. Open the HTTPS welcome page in desktop Chrome or Edge. Press **Q** to open controls, click **Connect Arduino**, and select the Nano's COM port. The browser can reopen the selected port on a later visit if permission is retained and exactly one available port matches.
3. Click **Test LEDs** and check the strip. The control screen confirms when the sketch acknowledges the command. Tap an NFC tag to confirm that a scan is received. The reader acts as a keyboard, so its status shows the most recent complete scan rather than reporting USB presence. **Connected** under **Registration database** means the database-backed heartbeat succeeded.
4. Click **Show welcome screen** or press **Q** to return. Keep the browser focused. In the welcome view, each accepted 10-digit scan sends `BLUE\n` at 115200 baud immediately, including scans of unregistered tags. The sketch fills the strip with blue LEDs, holds for 10 seconds, then turns them off in reverse order. Test scans in the control view only verify scanner input.

## Free-plan availability

The page sends a database-backed heartbeat every 60 seconds while open. Free Render services can still spin down, restart, or take time to wake, and free PostgreSQL has a limited lifetime. Keep the kiosk open during the event and verify `/health` before guests arrive. Continuous availability cannot be guaranteed on the free plan.
