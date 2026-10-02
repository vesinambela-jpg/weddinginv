# Bastian & Vero - Wedding Invitation

A hand-coded recreation of the Bastian & Vero wedding invitation, originally built on Canva Sites. Plain HTML, CSS, and vanilla JavaScript. No framework, no build step.

## Running locally

Any static file server works. For example:

```bash
python3 -m http.server 8080
```

Then open `http://localhost:8080` in your browser.

## Project structure

```
index.html               The whole page (single document, mobile-first)
styles.css                All styling, including the desktop split layout
script.js                  RSVP form handling and the wishes list
public/assets/             Images, icons, favicon, and the Open Graph image
google-apps-script.gs      Backend for the RSVP form (see "RSVP and wishes" below)
vercel.json                Long-lived cache headers for /public/assets
```

## Deploying to Vercel

This is a static site with no build command. In the Vercel dashboard, import the repository and leave the framework preset as "Other" (or run `vercel` from this folder with the CLI). No environment variables are required.

## Swapping the desktop hero image

On screens 1024px and wider, the left half of the page shows a still image (`.hero-panel__img` in `styles.css`). It currently uses `public/assets/hero-couple.webp`.

To change it:

1. Add your new image to `public/assets/` (webp is recommended for file size).
2. In `index.html`, find the `<aside class="hero-panel">` element near the top of `<body>` and update the `src` on `.hero-panel__img`.
3. If you also want a matching tagline, edit the text inside `.hero-panel__tagline`, or remove that `<p>` entirely if you would rather show just the image.

The image uses `object-fit: cover` and fills the full height of the viewport, so a tall portrait or landscape photo both work. A photo with the main subject roughly centered will crop best at odd window sizes.

## RSVP and wishes

RSVP submissions can sync to a Google Sheet so every visitor sees every wish, not just their own. This needs one manual setup step, since a static site has no server of its own to talk to Google with:

1. Open the spreadsheet and go to **Extensions > Apps Script**.
2. Delete anything in the editor and paste in the contents of `google-apps-script.gs` (in this folder).
3. **Deploy > New deployment** — type **Web app**, execute as **Me**, who has access **Anyone**.
4. Deploy, authorize when prompted, and copy the Web app URL (it ends in `/exec`).
5. Open `script.js` and paste that URL into `GOOGLE_SHEET_SCRIPT_URL` near the top of the file.

Once that's set, submitting the form appends a row to the sheet (timestamp, name, attending, guests, wishes), and the "Wishes from loved ones" section loads every name + message back from the sheet on page load.

Until you do that setup, `GOOGLE_SHEET_SCRIPT_URL` is empty and the site falls back to local-only mode: submissions are saved in the visitor's own browser (`localStorage`) and only that visitor sees them. The site works fine either way — the Sheet integration is additive, not required.

The "Send a Gift" button reveals a short note asking guests to contact the couple directly, since no bank or gift-registry details were available to include. Swap the text in `#giftNote` in `index.html` for real details when ready.

The "Send a Gift" button reveals a short note asking guests to contact the couple directly, since no bank or gift-registry details were available to include. Swap the text in `#giftNote` in `index.html` for real details when ready.

## Notes on the recreation

- Colors, type pairing, section order, and copy were taken directly from the live Canva site.
- Photos, florals, frames, and decorative elements were downloaded from the live site; the toile background pattern and the dark green plaque texture were swapped for the higher-resolution versions supplied locally in `Asset/`.
- Fonts are Sloop Script (script headings) and Times New Roman (body and labels), matching the couple's chosen typefaces. Sloop Script is bundled locally at `public/assets/fonts/`.
- Images below the first screen are lazy-loaded (`loading="lazy"`).
