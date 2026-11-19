# First Reader: Apps Script setup

First Reader adds a **Stories (First Reader)** tab to the staff dashboard. Families submit
a story about someone buried at South-View through a Google Form. Gemini gives each story
a first read, the result is saved as a row in the **First Reader Review Sheet**, and staff
approve or hold back each story, either in the dashboard tab or by ticking a box in the
Sheet. An approved story is published to the Wix website's `CommunityStories` collection.

The backend is one file, [`FirstReader.gs`](FirstReader.gs). It goes into the **same Apps
Script project as the gallery's `Code.gs`**, next to it, so the dashboard keeps one web app
URL and one Google sign-in. Nothing in the gallery's code is removed or changed apart from
one added line (step 3).

## What staff can do

| In the dashboard tab | In the Review Sheet | What happens |
|---|---|---|
| **Approve & publish** | Tick **Approve for Website** | The story is published to Wix. The status column says "Published" with the date. |
| **Hold back** | Tick **Held Back** | The story stays off the website. Ticking one box unticks the other. |
| **Move back to waiting** | Untick the box | The story goes back to waiting for a decision. |
| **Edit this text** | Type in **Edited Text** | Changes what will be published. |
| **Run the AI review again** | Run `frRetryFailedReviews` in the editor | Reviews again a story whose AI review failed. |

Each story card shows the family's first uploaded photo. Photos stay private in Drive: the
script sends them only to signed-in staff, and only photos linked from the Review Sheet. A
story without a photo shows the default photo when `FR_DEFAULT_PHOTO_URL` is set, or a
placeholder when it isn't, so staff see what the website will show.

Both places read and write the same rows, so a decision made in one shows in the other on
the next refresh. The dashboard shows every column of the Sheet: the story as sent, the
edited text, score, decision, facts to verify, changes made, feedback, score breakdown,
photos, website status and the raw Gemini reply.

A published story isn't taken off the website by unticking a box. Delete it in the Wix CMS
(**CMS → CommunityStories**, right-click the row, **Delete item**).

## Setup (one time, with South-View's Google account)

1. Open the shared Apps Script project.
2. Click **+** next to **Files**, choose **Script**, name it `FirstReader`, and paste in
   everything from [`FirstReader.gs`](FirstReader.gs). Press **Ctrl+S** (Cmd+S on Mac).
3. Open `Code.gs`, find `function doPost(e)`, and add this line right after
   `const body = JSON.parse(e.postData.contents)`:

   ```js
   if (String(body.action || '').indexOf('firstReader') === 0) return firstReaderPost(body) // Stories tab (FirstReader.gs)
   ```

   Do not delete or change anything else in `Code.gs`.
4. Click **Project Settings** (the gear icon), scroll to **Script Properties**, and add:

   | Property | Value |
   |---|---|
   | `FR_SHEET_ID` | The First Reader Review Sheet's link or ID. Leave it out to have setup make a new Sheet. |
   | `FR_FORM_ID` | The story form's edit link. |
   | `WIX_API_KEY` | A Wix API key with **Wix Data** and **Manage Site Media** turned on. |
   | `WIX_SITE_ID` | The ID after `/dashboard/` in the Wix dashboard's address. |
   | `FR_STAFF_EMAILS` | Optional. Comma-separated emails allowed to review stories. Without it, the dashboard's `STAFF_EMAILS` list is used. |
   | `FR_DEFAULT_PHOTO_URL` | Optional. The image used for stories sent without a photo: a Google Drive link to the image (the script copies it to Wix the first time it's used), or an image link from the Wix Media Manager. The account running the script must be able to open it. Without it, those stories are published with no photo. |

   `GEMINI_API_KEY`, `GOOGLE_CLIENT_ID` and `STAFF_EMAILS` are shared with the gallery and
   are already there.
5. In the toolbar's function menu, choose **frSetup** and click **Run**. Click **Allow**
   when Google asks for permissions.

   **What you should see:** the log shows the Review Sheet's link. An existing Review Sheet
   gets two new columns at the end, **Held Back** and **ID**; its rows are not changed.
6. Click **Deploy → Manage deployments**, click the pencil next to the web app, set
   **Version** to **New version**, and click **Deploy**. The web app URL stays the same.
7. If the old First Reader script (the one attached to the Review Sheet) still has
   triggers, delete them: open it, click **Triggers** (the clock icon), and delete each
   one. Otherwise every story is reviewed twice.

**What you should see:** submit a test story through the form. Within a minute it appears
as a new row in the Review Sheet and in the dashboard's **Stories (First Reader)** tab
under **Waiting for review**.

## Editor tools

| Function | What it does |
|---|---|
| `frSetup` | Adds missing columns, checkboxes, IDs and triggers. Safe to run again. |
| `frRetryFailedReviews` | Reviews again every story whose AI review failed. Stops at the first failure. |
| `frTestReview` | Sends one built-in test story to Gemini and logs the result. Changes nothing. |
| `frDiagnoseWixMedia` | Three test calls to Wix that show whether the API key's permissions are right. |

## Changing the review

- **Writing rules:** search for `const styleGuideText` and edit the numbered rules between
  the backticks.
- **Example story:** search for `const sampleText`.
- **Form question titles:** `FR_QUESTIONS` near the top. A question matches if its title
  starts with these words.
- **AI model:** `FR_MODEL` near the top.

Everything in `FirstReader.gs` starts with `FR_` or `fr`, so it can't clash with the
gallery's code or another group's.
