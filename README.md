# South-View Staff Dashboard

The staff side of the South-View Community Gallery, split out of the
[gallery repo](https://github.com/svc-handoff/south-view-events-gallery) so it can grow
into one dashboard for every LMC 3403 South-View project that has staff tools.

Live: https://svc-handoff.github.io/south-view-staff-dashboard/

## What's in it

Staff sign in with Google (only accounts on the `STAFF_EMAILS` list get in), then use
these tabs:

- **Pending review**, **Approved**, **Rejected**: approve or reject shared photos, with the
  Gemini AI check shown on each one. Approved photos can be removed from the gallery and
  brought back.
- **Events** and **Burials**: add or delete what visitors can choose on the photo form.
- **QR Codes**: print a welcome-table sign for an event, a sign for one burial, or a sheet
  of labels for every burial. Codes open the gallery's photo form.
- **Settings**: the kill switch. **Gallery online** hides every photo, and **Taking
  photos** closes the photo form. The same two switches are checkboxes in the Google
  Sheet's **Settings** tab.
- **Stories (First Reader)**: community stories families submit through First Reader's
  Google Form, each with Gemini's first read (score, edited text, facts to verify and
  more). Staff approve a story to publish it to the Wix website, hold it back, or edit its
  text. The same decisions are checkboxes in the First Reader Review Sheet, and both stay
  in step. Code in `src/first-reader/`; backend and setup in
  [`apps-script/FIRST_READER_SETUP.md`](apps-script/FIRST_READER_SETUP.md).

## Backend

The dashboard uses the same Google Apps Script, Google Sheet and Drive folder as the
gallery. The script lives in the gallery repo,
[`apps-script/Code.gs`](https://github.com/svc-handoff/south-view-events-gallery/blob/main/apps-script/Code.gs),
along with the setup steps. Keep one copy of it there.

## Run it

```bash
npm install
npm run dev
```

Then open http://localhost:5173/south-view-staff-dashboard/. With no setup it runs as an
in-browser demo (click **Continue as staff (demo)**), with sample photos stored only in
your browser.

To use the live data locally, create `.env.local` with:

```
VITE_APPS_SCRIPT_URL=<the web app URL ending in /exec>
VITE_GOOGLE_CLIENT_ID=<the OAuth client ID>
```

Optional: `VITE_GALLERY_URL` changes where QR codes and **Open the gallery** point
(default `https://svc-handoff.github.io/south-view-events-gallery/`).

## Deploying

Pushing to `main` builds the site and deploys it to GitHub Pages through
`.github/workflows/deploy.yml`. It reads two repository variables (Settings → Secrets and
variables → Actions → Variables):

- `APPS_SCRIPT_URL`: the same web app URL the gallery uses
- `GOOGLE_CLIENT_ID`: the same OAuth client ID the gallery uses

Google sign-in works on this site because the OAuth client allows the
`https://svc-handoff.github.io` origin, which the gallery and this dashboard share.

## Adding another group's dashboard

This repo is the starting point for combining the staff tools from the other South-View
projects (for example the archive's review desk and First Reader). The plan the groups
agreed on is one Google sign-in, with each project keeping its own data and review screen.
When adding one:

- Add it as its own tab or page next to the current tabs, in its own folder under `src/`.
- Reuse the Google sign-in, and check the signed-in email against that project's own
  staff list on its own backend.
- Keep each project's data and backend where it is. This dashboard only needs that
  project's API or links.

## Link to App Scripts (Test)
DO NOT DELETE EXISTING APPSCRIPTS CODE, just ADD ONTO IT

- [App Scripts Code](https://script.google.com/home/projects/1gBNBghQlEIAateXLMSzfpVEQllFgJgJSR-8w9D0ZRFcldxRVzGlimjzX/edit)

* Note: We will make Charlene set this up (one time set up) with SouthView's google account

History before the split is the gallery's, kept on purpose so past changes are still
traceable.
