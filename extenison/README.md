# VIGIL browser extension

The extension is a Manifest V3 client for the hosted VIGIL API. It does not contain an ML model, calculate a second score, or maintain separate phishing rules.

## Load locally

1. Open the Chromium extensions page and enable Developer mode.
2. Choose **Load unpacked** and select the `extenison/` directory.
3. Pin VIGIL, then open the toolbar popup on an `http://` or `https://` page.

The extension targets `https://vigilant-ai-api.onrender.com`. Its only host permission is this API origin. Health checks wait up to 65 seconds for the hosted service to wake, popup scans allow up to 90 seconds, and automatic navigation scans are bounded to 15 seconds. The `tabs` permission reads the active tab URL, `webNavigation` supports top-level phishing interception, and `storage` holds ephemeral block-page state across a service-worker restart.

## Runtime flow

```text
top-level navigation
        ↓
background service worker → POST /scan
        ↓
SAFE / SUSPICIOUS → navigation continues
PHISHING → trusted local blocked.html interstitial
        ↓
back, or deliberate one-time bypass confirmation
```

Popup scans and navigation scans share the same service-worker request path. Results are cached only in memory for 30 seconds per tab and normalized URL. A navigation's result is ignored if the tab has since started navigating elsewhere, so a late phishing response cannot redirect a newer page. A failed request produces an offline state and never becomes a phishing verdict.

For temporary development diagnostics, set `VIGIL_DEBUG = true` in the service worker DevTools console. Logs show only the URL origin, verdict, probability, risk score, and allow/block action; URL paths, queries, fragments, and userinfo are not logged.

## Security and UX notes

- Blocked URLs and evidence are inserted with `textContent`, never HTML interpolation.
- The blocked URL is not rendered as a link, iframe, or remote page.
- Internal extension pages are excluded from navigation scanning to prevent redirect loops.
- Suspicious URLs are reported but are not automatically blocked.
- Phishing bypass requires opening **More options** and confirming **Proceed anyway**; it is one-time and does not whitelist a domain.
- Popup and interstitial support keyboard focus, semantic headings, readable text at narrow widths, and `prefers-reduced-motion`.

## Local checks

From the repository root:

```powershell
node --check extenison/background.js
node --check extenison/popup.js
node --check extenison/blocked.js
node --test extenison/extension.test.mjs
node --test extenison/background.runtime.test.mjs
```

The browser-flow scenarios still require loading the unpacked extension in a Chromium profile: safe navigation, suspicious navigation, phishing interception, back, blocked-page reload, deliberate bypass, and backend-offline behavior.
