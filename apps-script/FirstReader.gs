// =====================================================================================
// First Reader: community stories (LMC 3403, team C22)
//
// Families submit a story about someone buried at South-View through a Google Form.
// This file sends each story to Gemini for a first read, saves the result as one row of
// the First Reader Review Sheet, and publishes approved stories to the Wix website.
//
// Staff approve or hold back stories in two places, and both stay in step:
//   - the "First Reader" tab of the staff dashboard
//   - the Review Sheet, by ticking "Approve for Website" or "Held Back"
//
// Setup is in apps-script/FIRST_READER_SETUP.md in the staff dashboard repo. The only
// change this needs outside this file is one line at the top of doPost() in Code.gs:
//
//   if (String(body.action || '').indexOf('firstReader') === 0) return firstReaderPost(body)
//
// Everything here starts with FR_ or fr so it can't clash with the gallery's code.
// The two exceptions are styleGuideText and sampleText, which keep their names because
// the First Reader handoff guide tells staff to search for them.
// =====================================================================================

// ===== Form question titles =====
// A question matches if its title STARTS with these words (capital letters don't matter).
// Any File upload question counts as photos, whatever its title.
const FR_QUESTIONS = {
  name: 'Name',
  email: 'Personal Email',
  member: 'Identified Community Member Name',
  title: 'Identified Community Member Professional Title',
  story: 'Share their story',
}
const FR_MODEL = 'gemini-3.1-flash-lite'

// The Review Sheet. Columns are found by their header, so staff can add their own
// columns. "Held Back" and "ID" were added for the dashboard; frSetup() adds them to an
// existing Review Sheet without touching its rows.
const FR_TAB_NAME = 'First Reader' // used if the Sheet has a tab with this name; otherwise the first tab
const FR_HEADERS = [
  'Last Updated',        // A
  'Name',                // B  who submitted it
  'Email',               // C
  'Community Member(s)', // D  who the story is about
  'Professional Title',  // E  that person's title, e.g. Nurse
  'Submission',          // F  the story exactly as sent
  'Total Score',         // G
  'Decision',            // H  auto_edit, feedback, error, parse_error or no_submission
  'Needs Staff Review',  // I  YES or no
  'Edited Text',         // J  what gets published
  'Changes Made',        // K
  'Feedback for Writer', // L
  'Facts to Verify',     // M
  'Score Breakdown',     // N
  'Raw Gemini Reply',    // O
  'Update Count',        // P
  'Approve for Website', // Q  checkbox
  'Website Status',      // R
  'Photos',              // S  Drive links, one per line
  'Held Back',           // T  checkbox
  'ID',                  // U  used by the dashboard
]
const FR_REVIEW_HEADERS = FR_HEADERS.slice(6, 15) // Total Score .. Raw Gemini Reply
const FR_REQUIRED = ['Name', 'Community Member(s)', 'Submission', 'Edited Text', 'Approve for Website', 'Website Status', 'Held Back', 'ID']
const FR_UNPUBLISHABLE = ['error', 'parse_error', 'no_submission']
const FR_MAX_PHOTOS = 3
const FR_MAX_PREVIEW_BYTES = 3 * 1024 * 1024 // larger photos are previewed as a smaller thumbnail
const FR_MAX_EDIT_LENGTH = 20000
const FR_WAITING = 'Waiting for staff approval'

// ===== Wix publishing =====
// The Wix CMS collection and its field keys (keys, not display names).
const FR_WIX_COLLECTION_ID = 'CommunityStories'
const FR_WIX_FIELDS = {
  title: 'title',                    // "Jane Doe (1921–1998)"
  story: 'story',                    // the paragraphs
  submittedBy: 'submittedBy',        // "Submitted by ..."
  person: 'personName',              // column D
  personTitle: 'professionalTitle',  // column E
  approvedDate: 'approvedDate',
  photo: 'photo',                    // first photo ('' turns photos off)
  gallery: '',                       // 'gallery' sends every photo to a Media Gallery field
}
// A story published without a photo gets the image in the FR_DEFAULT_PHOTO_URL script
// property, if one is set: a Google Drive link to an image (copied to Wix the first time
// it's used), or an image link from the Wix Media Manager. Without it, the story is
// published with no photo.

// ===== The Gemini prompt =====
const FR_REVIEW_PROMPT = `You are the first reader for community-submitted stories on the South-View Cemetery website. South-View was founded in 1886 by formerly enslaved African Americans, and its stories honor people buried there. Many submissions are written by family members, not professional writers. Your job is to help each story meet the site's standards while preserving the writer's voice and facts.

You will receive:
<style_guide>{{STYLE_GUIDE}}</style_guide>
<sample_text>{{SAMPLE_TEXT}}</sample_text>
<submission>{{SUBMISSION}}</submission>
<submitter_info>
Submitted by: {{SUBMITTER_NAME}}
Professional title of the person the story is about: {{PERSON_TITLE}}
</submitter_info>

The submitter_info comes from separate form fields, not from the story itself. Treat the submitter's name as satisfying style guide rule 11, so do not lower the structure score if the story text leaves it out. In revised_text, end with one line that reads exactly "Submitted by " followed by the submitter's name as given (for example, "Submitted by Keisha Thompson"). The professional title is a fact the submitter provided about the person: you may use it in the opening paragraph (for example, "a nurse at Grady Hospital" only if the story says where). Never invent details around it. If a field is blank, leave it out rather than guessing.

The sample text shows the target structure, tone, and level of professionalism. When SCORING, judge organization and tone only, never vocabulary or dialect. When WRITING revised_text, the sample is the model for the voice: revised_text should read as if the same author wrote both.

STEP 1: MECHANICAL FIXES (always do these)
Correct only:
- Spelling mistakes and typos
- Missing or incorrect punctuation and capitalization
- Accidentally repeated or missing words

Do NOT change:
- Dialect features, including African American English (for example, habitual "be," zero copula, or double negatives). These are valid ways of writing, not errors.
- Word choice, sentence style, or the writer's voice
- Names, dates, places, titles, quotations, or any factual claim

STEP 2: SCORE ALIGNMENT (0–100)
Score the mechanically corrected submission against the sample text and style guide:

- Structure (0–40): Does it follow the sample's organization? (For example: opening that introduces the person, life and contributions, legacy or connection to South-View, appropriate length.)
- Tone (0–35): Is it respectful and fitting for a memorial and historical site? Does it match the sample's level of warmth and formality?
- Professionalism (0–25): Is it clear and appropriate for a public website? Does it avoid insults, unsupported accusations, private information about living people, and promotional content?

Professionalism is about clarity and appropriateness, NOT about standard English. A story written in a family's own dialect can earn full points.

Add the three scores for the total. Briefly justify each score.

STEP 3: WRITE THE REVISED STORY (always do this)
Write revised_text: the story retold by South-View's single house narrator. Every story on the site must sound like it was written by the same person, no matter who submitted it or how they wrote it. The submitter supplies the facts; the narrator supplies the voice. Do not carry over the submitter's phrasing, slang, dialect, sentence rhythm, or level of formality into the narration. Retell the content entirely in the house voice.

THE HOUSE NARRATOR
A careful, warm local historian writing short memorial profiles for a museum-style collection. Calm, respectful, and plain-spoken. Never casual, never gushing, never academic.

Point of view and tense
- Always third person. Never "I," "we," "my," or "our" in the narration.
- Convert first-person submissions into third person and attribute family memories without inventing quotes. "My granddaddy fed half the neighborhood" becomes "His family remembers that he fed half the neighborhood." "We miss him every day" becomes "His family continues to miss him."
- Past tense for the person's life. Present tense only for things still true (for example, a program that still exists, or a living person's current role).

Sentences and words
- Standard written English throughout the narration.
- Mostly medium-length sentences (about 12–25 words), with an occasional short one for emphasis. No run-ons, no strings of short choppy sentences.
- Plain, precise words. "Selected him first overall," not "chose him number one." "Introduced him to basketball," not "taught him basketball game."
- No contractions, no exclamation points, no rhetorical questions, no slang, no emojis.
- Never use these words or phrases: legend, legendary, iconic, amazing, incredible, journey, inspire, inspiring, true hero, larger than life, testament, significant figure, touched countless lives, generations to come, will never be forgotten, rest in peace.
- Prefer "died" to "passed away," and "was buried at South-View Cemetery" or "was laid to rest at South-View Cemetery" for burials.

Conventions
- Heading line: full name, then years in parentheses with an en dash, such as "Jane Doe (1921–1998)". For a living person: "(born 1984)". If years are unknown, the name alone.
- First mention in the body: full name. After that: first name, as in the sample.
- Dates as "December 1984" or "June 5, 1950." Spell out numbers one through nine; use numerals for 10 and above. Always use numerals for years and ages.
- Places: city and state on first mention ("Macon, Georgia").

Structure (always in this order, skipping any part the writer gave no facts for)
1. Heading line
2. Opening paragraph: one or two sentences summarizing who the person was and what they are remembered for, using only the writer's facts.
3. Early life
4. Work and contributions
5. Family, faith, and community, including any family memory
6. Connection to South-View Cemetery (and burial, if stated)
7. A blank line, then the "Submitted by" line

Accuracy (these rules override everything above)
- Do NOT add, remove, or change facts, names, dates, or numbers. Do not fill in details the writer did not give, such as first names, team names, or job titles.
- Do NOT add a concluding summary, lesson, or tribute the writer did not express. End with the last of the writer's own content.
- Tone down exaggeration rather than repeating it. "Everyone know he is true legend" becomes a plain statement of what the writer described, or is removed if it adds nothing factual.
- Direct quotations stay exactly as written, inside quotation marks, even if they use dialect. Do not create new quotations.
- If a sentence is unclear, keep its meaning as close as possible and note it in changes_made.

STEP 4: DECIDE

If the total is 70 or higher, set decision to "auto_edit":
- revised_text goes to staff for approval.
- List the main changes in changes_made (group similar edits together; do not list every word).

If the total is below 70, set decision to "feedback":
- revised_text is sent to the writer only as a suggested version to review, not for publishing.
- Give 2–5 specific, encouraging feedback points. Each should say what to change, where, and why.
- Start by naming something the story already does well.

ALWAYS:
- Flag every name, date, title, statistic, or historical claim that staff should verify. Never correct or confirm facts yourself.
- Set needs_staff_review to true if the story contains anything sensitive (death circumstances, crime, disputes, health details, or information about living people) or if you are unsure about anything.
- If the story does not say the person is buried at South-View, or the person appears to be living, set needs_staff_review to true and add this to facts_to_verify. Still complete every other step.

OUTPUT
Respond only with valid JSON (no markdown, no code fences) using exactly these keys:
{
  "scores": {
    "structure": 0,
    "tone": 0,
    "professionalism": 0,
    "total": 0
  },
  "score_reasons": {
    "structure": "",
    "tone": "",
    "professionalism": ""
  },
  "decision": "auto_edit",
  "mechanically_corrected_text": "<the FULL story after Step 1 fixes>",
  "revised_text": "<the FULL story rewritten in the house voice>",
  "changes_made": [],
  "feedback_for_writer": [],
  "facts_to_verify": [],
  "needs_staff_review": false
}

Rules for the JSON:
- "decision" must be either "auto_edit" (total is 70 or higher) or "feedback" (total is below 70).
- "mechanically_corrected_text" must ALWAYS contain the complete story, every time, whatever the decision. If you made no Step 1 fixes, copy the submission exactly. Never leave it empty.
- "revised_text" must ALWAYS contain the complete story rewritten in the house voice, whatever the decision. Never leave it empty.
- Separate paragraphs in text fields with a blank line (\\n\\n).
- "feedback_for_writer" is filled in only when decision is "feedback"; otherwise it is an empty list.
- "needs_staff_review" is true or false.`;

// ===== South-View's writing rules. Staff can edit the numbered rules between the backticks. =====
const styleGuideText = `South-View Cemetery Community Story Guidelines (DRAFT)

1. Each story should be about one person buried at South-View Cemetery.
2. Begin with the person's full name and, if known, their birth and death years.
3. Describe who the person was: their work, family, faith, community, and contributions.
4. Include at least one personal memory, quote, or detail that shows who they were.
5. End by connecting the person to South-View or to their legacy.
6. Stories should be between 150 and 600 words.
7. Write respectfully. Do not include insults, gossip, or accusations against anyone.
8. Do not include private information about living people, such as addresses, phone numbers, or health details.
9. Do not include advertisements or links to businesses.
10. Writers may use their own voice and the way their family speaks. Stories do not need to sound formal.
11. End with the name of the person who submitted the story.`;

// PLACEHOLDER sample story about an invented person. Swap in real examples later.
const sampleText = `[Full Name] (1921–1998)

[Full Name] was a schoolteacher, church leader, and lifelong resident of Atlanta's [neighborhood] community. For more than three decades, she taught at [School Name], where former students remember her as demanding, patient, and deeply devoted to their success.

Born in [city], Georgia, [First Name] moved to Atlanta as a young woman to attend [College]. After graduating, she began a teaching career that would shape generations of children in the neighborhood. Outside the classroom, she served as a deaconess at [Church Name] and organized a weekend reading program that met in the church basement for more than 20 years.

Her family remembers her as the person neighbors turned to for advice, a warm meal, or help filling out a form. "She never turned anyone away," her granddaughter recalls.

[First Name] died in 1998 and was laid to rest at South-View Cemetery, near her parents and grandparents.

Submitted by [Name], granddaughter`;


// TEST story about an invented person. Used only by frTestReview().
const FR_TEST_STORY = `My granddaddy James Earl Thompson was born in 1930 in Macon and he moved to Atlanta when he was 19. He worked for the railroad for 35 years and he aint never missed a day of work. Everybody on our street knew him cause he be out on the porch every evening waving at folks.

He was a deacon at Mount Zion Baptist Church and he started a program that gave free groceries to familes who needed help. He did that for over 20 years and never asked for nothing back. My grandmother say he fed half the neighborhood.

He passed away in 2009 and he is buried at South-View next to his mama. We miss him every day.

Submitted by Keisha Thompson, granddaughter`;


// =====================================================================================
// Setup. Run once from the editor: choose frSetup in the toolbar and click Run.
// Safe to run again; it only adds what's missing.
// =====================================================================================
function frSetup() {
  const props = frProps()
  let ss
  if (props.getProperty('FR_SHEET_ID')) {
    ss = frSpreadsheet()
  } else {
    ss = SpreadsheetApp.create('First Reader Review Sheet')
    ss.getSheets()[0].setName(FR_TAB_NAME)
    props.setProperty('FR_SHEET_ID', ss.getId())
  }
  const sheet = ss.getSheetByName(FR_TAB_NAME) || ss.getSheets()[0]

  // Headers: a new Sheet gets all of them; an existing Review Sheet gets the missing ones at the end.
  if (sheet.getLastRow() === 0) sheet.appendRow(FR_HEADERS)
  const header = frTable(sheet).header
  const missing = FR_HEADERS.filter((h) => header.indexOf(h) < 0)
  if (missing.length) sheet.getRange(1, header.length + 1, 1, missing.length).setValues([missing])
  sheet.setFrozenRows(1)
  sheet.getRange(1, 1, 1, sheet.getLastColumn()).setFontWeight('bold')

  // Checkboxes for every row, and an ID for rows from before the dashboard.
  const t = frTable(sheet)
  if (t.values.length) {
    ;['Approve for Website', 'Held Back'].forEach((name) => {
      const range = sheet.getRange(2, t.col(name) + 1, t.values.length, 1)
      const values = range.getValues().map((r) => [r[0] === true])
      range.insertCheckboxes().setValues(values)
    })
    const idRange = sheet.getRange(2, t.col('ID') + 1, t.values.length, 1)
    idRange.setValues(idRange.getValues().map((r) => [String(r[0]).trim() || frNewId()]))
  }

  // Triggers: one for form submissions, one for ticking boxes in the Sheet.
  const triggers = ScriptApp.getProjectTriggers().map((tr) => tr.getHandlerFunction())
  if (triggers.indexOf('frOnSheetEdit') < 0) {
    ScriptApp.newTrigger('frOnSheetEdit').forSpreadsheet(ss.getId()).onEdit().create()
  }
  const formId = frFormId()
  if (!formId) {
    console.log('Next: add the FR_FORM_ID script property (the form\'s edit link), then run frSetup again.')
  } else if (triggers.indexOf('frOnFormSubmit') < 0) {
    ScriptApp.newTrigger('frOnFormSubmit').forForm(formId).onFormSubmit().create()
  }

  console.log('First Reader stories are saved to: ' + ss.getUrl())
  if (!props.getProperty('GEMINI_API_KEY')) console.log('Missing: the GEMINI_API_KEY script property.')
  if (!props.getProperty('WIX_API_KEY') || !props.getProperty('WIX_SITE_ID')) {
    console.log('Missing: WIX_API_KEY and WIX_SITE_ID. Stories can be reviewed, but approving one will fail until these are added.')
  }
  console.log('If the old First Reader script is still attached to this form or Sheet, delete its triggers now, so stories are not reviewed or published twice.')
}

// =====================================================================================
// Form submissions
// =====================================================================================
function frOnFormSubmit(e) {
  // Never process the same response twice.
  const props = frProps()
  const responseId = e.response.getId()
  if (props.getProperty('fr_done_' + responseId)) return
  props.setProperty('fr_done_' + responseId, '1')

  const answers = {}
  let photoIds = []
  e.response.getItemResponses().forEach((item) => {
    const title = item.getItem().getTitle().trim()
    let answer = item.getResponse()
    if (item.getItem().getType() === FormApp.ItemType.FILE_UPLOAD) {
      photoIds = photoIds.concat(Array.isArray(answer) ? answer : [answer])
      return
    }
    if (Array.isArray(answer)) answer = answer.join(', ')
    answers[title] = answer
  })
  const photoLinks = photoIds.filter(Boolean).map((id) => 'https://drive.google.com/file/d/' + id + '/view')

  const name = frAnswer(answers, FR_QUESTIONS.name)
  const members = frAnswer(answers, FR_QUESTIONS.member)
  const personTitle = frAnswer(answers, FR_QUESTIONS.title)
  const submission = frAnswer(answers, FR_QUESTIONS.story).trim()
  const email = frAnswer(answers, FR_QUESTIONS.email) || e.response.getRespondentEmail() || ''
  if (!submission) console.log('No story found. Form titles received: ' + Object.keys(answers).join(' | '))

  // Gemini runs outside the lock, so a slow reply doesn't hold up staff.
  const sheet = frSheet()
  const before = frFindByPerson(frTable(sheet), name, members)
  let review
  if (!submission) review = frStatusColumns('no_submission', '')
  else if (before && before.submission === submission && frIsGoodRaw(before.raw)) review = frReviewColumns(before.raw, submission)
  else review = frRunReview(submission, name, personTitle)

  frWithLock(() => {
    const t = frTable(sheet)
    const found = frFindByPerson(t, name, members) // check again inside the lock
    const old = found ? t.values[found.index] : t.header.map(() => '')
    const record = {
      'Last Updated': e.response.getTimestamp(),
      'Name': frPlain(name),
      'Email': frPlain(email),
      'Community Member(s)': frPlain(members),
      'Professional Title': frPlain(personTitle),
      'Submission': frPlain(submission),
      'Update Count': found ? (Number(found.count) || 0) + 1 : 0,
      // A new or changed story needs a fresh decision.
      'Approve for Website': false,
      'Held Back': false,
      'ID': found ? String(t.values[found.index][t.col('ID')]).trim() || frNewId() : frNewId(),
    }
    FR_REVIEW_HEADERS.forEach((h, i) => (record[h] = h === 'Edited Text' ? frPlain(review[i]) : review[i]))
    const oldStatus = String(old[t.col('Website Status')])
    record['Website Status'] = oldStatus.indexOf('Published') === 0
      ? 'Story changed after publishing. Re-approve to publish the new version.'
      : FR_WAITING
    // A resubmission without photos keeps the earlier ones.
    if (photoLinks.length) record['Photos'] = photoLinks.join('\n')

    const row = t.header.map((h, i) => (h in record ? record[h] : old[i]))
    let rowNumber
    if (found) {
      rowNumber = found.index + 2
      sheet.getRange(rowNumber, 1, 1, row.length).setValues([row])
    } else {
      sheet.appendRow(row)
      rowNumber = sheet.getLastRow()
    }
    ;['Approve for Website', 'Held Back'].forEach((h) => sheet.getRange(rowNumber, t.col(h) + 1).insertCheckboxes().uncheck())
  })
}

// =====================================================================================
// Ticking boxes in the Review Sheet (installable trigger made by frSetup)
// "Approve for Website" publishes the story. "Held Back" keeps it off the website.
// The two boxes can't both be ticked: ticking one unticks the other.
// =====================================================================================
function frOnSheetEdit(e) {
  const range = e.range
  if (range.getRow() < 2) return
  const sheet = range.getSheet()
  if (sheet.getSheetId() !== frSheet().getSheetId()) return
  const header = frTable(sheet).header
  const approveCol = header.indexOf('Approve for Website') + 1
  const heldCol = header.indexOf('Held Back') + 1
  const first = range.getColumn()
  const last = first + range.getNumColumns() - 1
  const touches = (col) => col >= first && col <= last
  if (!touches(approveCol) && !touches(heldCol)) return

  frWithLock(() => {
    const t = frTable(sheet)
    for (let r = range.getRow(); r < range.getRow() + range.getNumRows(); r++) {
      const values = t.values[r - 2]
      if (!values) continue
      if (touches(approveCol) && values[t.col('Approve for Website')] === true) {
        frApplyDecision(sheet, t, r, 'approve')
      } else if (touches(heldCol) && values[t.col('Held Back')] === true) {
        frApplyDecision(sheet, t, r, 'hold')
      } else if (touches(heldCol) || touches(approveCol)) {
        frApplyDecision(sheet, t, r, 'reopen')
      }
    }
  })
}

// =====================================================================================
// Staff dashboard API. Code.gs's doPost() sends every action that starts with
// "firstReader" here. Every action needs a staff sign-in.
// =====================================================================================
function firstReaderPost(body) {
  frCheckStaff(body.idToken)
  const id = String(body.id || '')
  switch (body.action) {
    case 'firstReaderList': return frList()
    case 'firstReaderApprove': return { story: frDecide(id, 'approve') }
    case 'firstReaderHold': return { story: frDecide(id, 'hold') }
    case 'firstReaderReopen': return { story: frDecide(id, 'reopen') }
    case 'firstReaderSaveEdit': return { story: frSaveEdit(id, body.editedText) }
    case 'firstReaderRetry': return { story: frRetry(id) }
    case 'firstReaderPhoto': return frPhoto(body.fileId)
  }
  frFail('Unknown First Reader action.')
}

function frList() {
  const sheet = frSheet()
  const t = frTable(sheet)
  // Rows added by hand have no ID yet. Give them one so the dashboard can act on them.
  const idCol = t.col('ID')
  const blank = t.values.map((row, i) => (String(row[idCol]).trim() || !String(row[t.col('Submission')]).trim() ? -1 : i)).filter((i) => i >= 0)
  if (blank.length) {
    frWithLock(() => blank.forEach((i) => {
      t.values[i][idCol] = frNewId()
      sheet.getRange(i + 2, idCol + 1).setValue(t.values[i][idCol])
    }))
  }
  const stories = t.values
    .map((row, i) => frStory(t, row, i + 2))
    .filter((s) => s.id && (s.submission || s.name))
  return { stories: stories, sheetUrl: sheet.getParent().getUrl() + '#gid=' + sheet.getSheetId(), defaultPhoto: frDefaultPhoto() }
}

function frDecide(id, decision) {
  return frWithLock(() => {
    const sheet = frSheet()
    const t = frTable(sheet)
    const rowNumber = frRowById(t, id)
    if (decision === 'approve') sheet.getRange(rowNumber, t.col('Approve for Website') + 1).check()
    if (decision === 'hold') sheet.getRange(rowNumber, t.col('Held Back') + 1).check()
    frApplyDecision(sheet, t, rowNumber, decision)
    return frStoryAt(sheet, rowNumber)
  })
}

// Keeps the two checkboxes and the status in step, and publishes on approve.
// Runs inside the lock. The box that was just ticked is already ticked.
function frApplyDecision(sheet, t, rowNumber, decision) {
  const box = (name) => sheet.getRange(rowNumber, t.col(name) + 1)
  const status = box('Website Status')
  const published = String(status.getValue()).indexOf('Published') === 0
  if (decision === 'approve') {
    box('Held Back').uncheck()
    frPublishRow(sheet, t, rowNumber)
  } else if (decision === 'hold') {
    box('Approve for Website').uncheck()
    if (!published) status.setValue('Held back by staff on ' + frToday())
  } else {
    box('Approve for Website').uncheck()
    box('Held Back').uncheck()
    if (!published) status.setValue(FR_WAITING)
  }
}

function frSaveEdit(id, text) {
  text = String(text == null ? '' : text).replace(/\r/g, '').trim()
  if (!text) frFail('The edited story is empty.')
  if (text.length > FR_MAX_EDIT_LENGTH) frFail('The edited story is too long.')
  return frWithLock(() => {
    const sheet = frSheet()
    const t = frTable(sheet)
    const rowNumber = frRowById(t, id)
    sheet.getRange(rowNumber, t.col('Edited Text') + 1).setValue(frPlain(text))
    return frStoryAt(sheet, rowNumber)
  })
}

// Runs Gemini again on one story, for rows where the first review failed.
function frRetry(id) {
  const sheet = frSheet()
  let t = frTable(sheet)
  const row = t.values[frRowById(t, id) - 2]
  const submission = String(row[t.col('Submission')]).trim()
  if (!submission) frFail('This row has no story to review.')
  if (row[t.col('Approve for Website')] === true) frFail('This story is already approved. Hold it back first to review it again.')
  const review = frRunReview(submission, String(row[t.col('Name')]), String(row[t.col('Professional Title')]))
  return frWithLock(() => {
    t = frTable(sheet)
    const rowNumber = frRowById(t, id)
    FR_REVIEW_HEADERS.forEach((h, i) => {
      const col = t.col(h)
      if (col >= 0) sheet.getRange(rowNumber, col + 1).setValue(h === 'Edited Text' ? frPlain(review[i]) : review[i])
    })
    return frStoryAt(sheet, rowNumber)
  })
}

// One row as the dashboard sees it. Every column of the Review Sheet is included.
function frStory(t, row, rowNumber) {
  const at = (name) => {
    const i = t.col(name)
    return i < 0 ? '' : row[i]
  }
  const text = (name) => String(at(name) == null ? '' : at(name))
  const approved = at('Approve for Website') === true
  const heldBack = !approved && at('Held Back') === true
  const websiteStatus = text('Website Status')
  const score = at('Total Score')
  return {
    id: text('ID').trim(),
    row: rowNumber,
    lastUpdated: frIso(at('Last Updated')),
    name: text('Name'),
    email: text('Email'),
    members: text('Community Member(s)'),
    personTitle: text('Professional Title'),
    submission: text('Submission'),
    score: score === '' || isNaN(Number(score)) ? null : Number(score),
    decision: text('Decision'),
    needsReview: text('Needs Staff Review').toUpperCase() === 'YES',
    editedText: text('Edited Text'),
    changesMade: text('Changes Made'),
    feedback: text('Feedback for Writer'),
    factsToVerify: text('Facts to Verify'),
    scoreBreakdown: text('Score Breakdown'),
    rawReply: text('Raw Gemini Reply'),
    updateCount: Number(at('Update Count')) || 0,
    approved: approved,
    heldBack: heldBack,
    status: approved ? 'approved' : heldBack ? 'held' : 'pending',
    published: websiteStatus.indexOf('Published') === 0,
    websiteStatus: websiteStatus,
    photos: frPhotoIds(at('Photos')).map((fileId) => ({ fileId: fileId, url: 'https://drive.google.com/file/d/' + fileId + '/view' })),
  }
}

function frStoryAt(sheet, rowNumber) {
  const t = frTable(sheet)
  return frStory(t, t.values[rowNumber - 2], rowNumber)
}

// =====================================================================================
// Staff sign-in. Uses the same Google sign-in as the rest of the dashboard. The list of
// who may review stories is FR_STAFF_EMAILS, or STAFF_EMAILS when that isn't set.
// =====================================================================================
function frCheckStaff(idToken) {
  const props = frProps()
  const cache = CacheService.getScriptCache()
  const failures = Number(cache.get('frFailedLogins') || 0)
  if (failures >= 10) frFail('Too many failed sign-ins. Wait 15 minutes, or approve stories in the Review Sheet.', 'locked')
  const list = String(props.getProperty('FR_STAFF_EMAILS') || props.getProperty('STAFF_EMAILS') || '')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean)
  if (!list.length) frFail('No staff emails are set up yet. Add STAFF_EMAILS in the script properties.')
  const email = frVerifyIdToken(idToken)
  if (!email) {
    cache.put('frFailedLogins', String(failures + 1), 15 * 60)
    frFail('Your sign-in has expired. Sign in again.', 'unauthorized')
  }
  // Signed in, but not a First Reader reviewer: the tab says so without signing them out.
  if (list.indexOf(email.toLowerCase()) < 0) frFail('Your Google account is not on the First Reader staff list (FR_STAFF_EMAILS).', 'forbidden')
}

function frVerifyIdToken(idToken) {
  if (!idToken) return null
  const clientId = frProps().getProperty('GOOGLE_CLIENT_ID')
  if (!clientId) frFail('No GOOGLE_CLIENT_ID script property is set up yet.')
  const res = UrlFetchApp.fetch('https://oauth2.googleapis.com/tokeninfo?id_token=' + encodeURIComponent(idToken), { muteHttpExceptions: true })
  if (res.getResponseCode() !== 200) return null
  const info = JSON.parse(res.getContentText())
  if (info.aud !== clientId) return null
  if (info.email_verified !== 'true' && info.email_verified !== true) return null
  return info.email
}

// =====================================================================================
// Gemini review
// =====================================================================================
function frAnswer(answers, title) {
  const norm = (s) => String(s).toLowerCase().replace(/\s+/g, ' ').trim()
  const want = norm(title)
  if (answers[title] !== undefined) return String(answers[title])
  const key = Object.keys(answers).find((k) => norm(k) === want) || Object.keys(answers).find((k) => norm(k).indexOf(want) === 0)
  return key ? String(answers[key]) : ''
}

function frBuildPrompt(submission, name, personTitle) {
  // split/join instead of replace(), so "$" in a story can't break anything
  return FR_REVIEW_PROMPT
    .split('{{STYLE_GUIDE}}').join(styleGuideText)
    .split('{{SAMPLE_TEXT}}').join(sampleText)
    .split('{{SUBMISSION}}').join(submission)
    .split('{{SUBMITTER_NAME}}').join(name || '')
    .split('{{PERSON_TITLE}}').join(personTitle || '')
}

function frRunReview(submission, name, personTitle) {
  try {
    return frReviewColumns(frAskGemini(frBuildPrompt(submission, name, personTitle)), submission)
  } catch (err) {
    return frStatusColumns('error', 'Gemini error: ' + err.message)
  }
}

// The 9 review columns (Total Score .. Raw Gemini Reply) for one Gemini reply.
function frReviewColumns(raw, submission) {
  let r
  try {
    r = JSON.parse(String(raw).replace(/^```(?:json)?\s*|\s*```$/g, '').trim())
  } catch (err) {
    return frStatusColumns('parse_error', raw)
  }
  const s = r.scores || {}
  const why = r.score_reasons || {}
  // Add up the total here in case the model's arithmetic is off.
  const total = (Number(s.structure) || 0) + (Number(s.tone) || 0) + (Number(s.professionalism) || 0)
  const decision = String(r.decision || '').toLowerCase().replace(/[\s-]+/g, '_')
  const editedText = r.revised_text || r.mechanically_corrected_text || submission || '(No text returned. See Raw Gemini Reply.)'
  const breakdown =
    'Structure ' + s.structure + '/40: ' + (why.structure || '') + '\n' +
    'Tone ' + s.tone + '/35: ' + (why.tone || '') + '\n' +
    'Professionalism ' + s.professionalism + '/25: ' + (why.professionalism || '')
  return [
    total,
    decision,
    r.needs_staff_review === true ? 'YES' : 'no',
    editedText,
    frBullets(r.changes_made),
    frBullets(r.feedback_for_writer),
    frBullets(r.facts_to_verify),
    breakdown,
    raw,
  ]
}

function frStatusColumns(decision, raw) {
  return ['', decision, decision === 'no_submission' ? 'no' : 'YES', '', '', '', '', '', raw]
}

function frBullets(list) {
  if (!Array.isArray(list)) return String(list || '')
  return list.map((x) => '• ' + (typeof x === 'string' ? x : JSON.stringify(x))).join('\n')
}

function frIsGoodRaw(raw) {
  raw = String(raw || '')
  if (!raw || raw.indexOf('Gemini error') === 0) return false
  return frReviewColumns(raw)[1] !== 'parse_error'
}

// One attempt, no automatic retries, so a problem never burns through the quota.
function frAskGemini(prompt) {
  const apiKey = frProps().getProperty('GEMINI_API_KEY')
  if (!apiKey) throw new Error('the GEMINI_API_KEY script property is missing')
  const url = 'https://generativelanguage.googleapis.com/v1beta/models/' + FR_MODEL + ':generateContent'
  const res = UrlFetchApp.fetch(url, {
    method: 'post',
    contentType: 'application/json',
    headers: { 'x-goog-api-key': apiKey },
    payload: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { responseMimeType: 'application/json' },
    }),
    muteHttpExceptions: true,
  })
  const code = res.getResponseCode()
  const data = frParseJson(res.getContentText()) || {}
  if (code === 200 && data.candidates) return data.candidates[0].content.parts[0].text
  throw new Error('(' + code + ') ' + (data.error ? data.error.message : 'unknown error'))
}

// =====================================================================================
// Wix publishing
// =====================================================================================
function frPublishRow(sheet, t, rowNumber) {
  const row = sheet.getRange(rowNumber, 1, 1, t.header.length).getValues()[0]
  const at = (name) => String(row[t.col(name)] == null ? '' : row[t.col(name)])
  const status = sheet.getRange(rowNumber, t.col('Website Status') + 1)
  const approveBox = sheet.getRange(rowNumber, t.col('Approve for Website') + 1)
  if (at('Website Status').indexOf('Published') === 0) return // never publish the same row twice

  const edited = at('Edited Text').trim()
  if (FR_UNPUBLISHABLE.indexOf(at('Decision')) >= 0 || !edited || edited.charAt(0) === '(') {
    status.setValue('Not published: this row has no reviewed story. Fix the Edited Text, then approve again.')
    approveBox.uncheck()
    return
  }

  const members = at('Community Member(s)')
  const parts = frSplitStory(edited, members)
  const data = {}
  data[FR_WIX_FIELDS.title] = parts.title || members
  data[FR_WIX_FIELDS.story] = parts.body
  data[FR_WIX_FIELDS.submittedBy] = parts.submittedBy
  data[FR_WIX_FIELDS.person] = members
  if (FR_WIX_FIELDS.personTitle && at('Professional Title').trim()) data[FR_WIX_FIELDS.personTitle] = at('Professional Title').trim()
  data[FR_WIX_FIELDS.approvedDate] = new Date().toISOString()

  // A photo that fails never blocks the story; the status says what happened.
  const notes = []
  if (FR_WIX_FIELDS.photo) {
    const urls = []
    frPhotoIds(at('Photos')).slice(0, FR_MAX_PHOTOS).forEach((id, i) => {
      try {
        urls.push(frUploadPhotoToWix(id, members + ' ' + (i + 1)))
      } catch (uploadErr) {
        try {
          urls.push(frSharedDrivePhotoUrl(id))
          notes.push('photo ' + (i + 1) + ' linked from Drive')
        } catch (shareErr) {
          notes.push('photo ' + (i + 1) + ' skipped (' + uploadErr.message + '; Drive link: ' + shareErr.message + ')')
        }
      }
    })
    if (urls.length) {
      data[FR_WIX_FIELDS.photo] = urls[0]
      if (FR_WIX_FIELDS.gallery) data[FR_WIX_FIELDS.gallery] = urls.map((u) => ({ type: 'image', src: u, title: members }))
    } else if (frDefaultPhoto()) {
      try {
        data[FR_WIX_FIELDS.photo] = frDefaultWixPhotoUrl()
        notes.push('default photo used')
      } catch (err) {
        notes.push('default photo skipped (' + err.message + ')')
      }
    }
  }

  try {
    const itemId = frInsertWixItem(data)
    status.setValue('Published ' + frToday() + ' (Wix item ' + itemId + ')' + (notes.length ? '. Note: ' + notes.join('; ') : ''))
  } catch (err) {
    status.setValue('Wix error: ' + err.message)
    approveBox.uncheck() // so staff can simply approve again
  }
}

// FR_DEFAULT_PHOTO_URL as { fileId } for a Drive image, { url } for an image link, or null.
function frDefaultPhoto() {
  const value = String(frProps().getProperty('FR_DEFAULT_PHOTO_URL') || '').trim()
  if (!value) return null
  const ids = frPhotoIds(value)
  if (ids.length) return { fileId: ids[0] }
  if (/^[\w-]{25,}$/.test(value)) return { fileId: value }
  return /^https:\/\//.test(value) ? { url: value } : null
}

// The default photo's link for Wix. A Drive image is copied to Wix once and remembered.
function frDefaultWixPhotoUrl() {
  const photo = frDefaultPhoto()
  if (!photo) return ''
  if (photo.url) return photo.url
  const key = 'fr_default_wix_' + photo.fileId
  const saved = frProps().getProperty(key)
  if (saved) return saved
  let url
  try {
    url = frUploadPhotoToWix(photo.fileId, 'South-View default photo')
  } catch (err) {
    return frSharedDrivePhotoUrl(photo.fileId) // not remembered, so the Wix copy is tried again next time
  }
  frProps().setProperty(key, url)
  return url
}

// One story photo for the dashboard, as a data URL, so photos stay private in Drive.
// Only photos linked from the Review Sheet can be fetched.
function frPhoto(fileId) {
  fileId = String(fileId || '')
  const t = frTable(frSheet())
  const col = t.col('Photos')
  const def = frDefaultPhoto()
  const linked = (def && def.fileId === fileId) || (col >= 0 && t.values.some((row) => frPhotoIds(row[col]).indexOf(fileId) >= 0))
  if (!fileId || !linked) frFail('That photo is not linked from the Review Sheet.', 'not_found')
  let file
  try {
    file = DriveApp.getFileById(fileId)
  } catch (err) {
    frFail("Can't open that photo in Drive. It may have been deleted, or this account can't see it.", 'not_found')
  }
  if (!/^image\//.test(file.getMimeType())) frFail('That file is not an image.', 'not_found')
  let blob = file.getSize() > FR_MAX_PREVIEW_BYTES ? file.getThumbnail() : file.getBlob()
  // Browsers can't show some phone formats, such as HEIC.
  if (['image/jpeg', 'image/png', 'image/gif', 'image/webp'].indexOf(blob.getContentType()) < 0) blob = blob.getAs('image/jpeg')
  return { dataUrl: 'data:' + blob.getContentType() + ';base64,' + Utilities.base64Encode(blob.getBytes()) }
}

function frPhotoIds(text) {
  const ids = []
  String(text || '').split(/\s+/).forEach((part) => {
    const m = part.match(/\/d\/([\w-]{10,})/) || part.match(/[?&]id=([\w-]{10,})/)
    if (m && ids.indexOf(m[1]) < 0) ids.push(m[1])
  })
  return ids
}

// Copies one Drive photo into the Wix Media Manager and returns its wixstatic.com URL.
function frUploadPhotoToWix(driveFileId, displayName) {
  let blob = DriveApp.getFileById(driveFileId).getBlob()
  const okTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']
  if (okTypes.indexOf(blob.getContentType()) < 0) blob = blob.getAs('image/jpeg') // e.g. iPhone HEIC
  const mime = blob.getContentType()
  const ext = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/gif': 'gif', 'image/webp': 'webp' }[mime]
  const fileName = displayName.replace(/[^\w\- ]/g, '').trim().replace(/\s+/g, '-') + '.' + ext
  const headers = frWixHeaders()

  const gen = UrlFetchApp.fetch('https://www.wixapis.com/site-media/v1/files/generate-upload-url', {
    method: 'post', contentType: 'application/json', headers: headers,
    payload: JSON.stringify({ mimeType: mime, fileName: fileName }), muteHttpExceptions: true,
  })
  const genBody = frReadJson(gen, 'upload link')
  if (!genBody.uploadUrl) throw new Error('upload link: no uploadUrl in reply')

  const sep = genBody.uploadUrl.indexOf('?') >= 0 ? '&' : '?'
  const put = UrlFetchApp.fetch(genBody.uploadUrl + sep + 'filename=' + encodeURIComponent(fileName), {
    method: 'put', contentType: mime, payload: blob.getBytes(), muteHttpExceptions: true,
  })
  const putBody = frReadJson(put, 'upload')
  const file = putBody.file || putBody
  if (!file.url) throw new Error('upload: no file url in reply')
  return file.url
}

// Fallback when Wix won't take an upload: lets anyone with the link view this one photo,
// which is about to be public on the website anyway.
function frSharedDrivePhotoUrl(driveFileId) {
  const file = DriveApp.getFileById(driveFileId)
  if (!/^image\//.test(file.getMimeType())) throw new Error('not an image')
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW)
  return 'https://drive.google.com/thumbnail?id=' + driveFileId + '&sz=w1600'
}

function frInsertWixItem(data) {
  const res = UrlFetchApp.fetch('https://www.wixapis.com/wix-data/v2/items', {
    method: 'post',
    contentType: 'application/json',
    headers: frWixHeaders(),
    payload: JSON.stringify({ dataCollectionId: FR_WIX_COLLECTION_ID, dataItem: { data: data } }),
    muteHttpExceptions: true,
  })
  const body = frReadJson(res, 'Wix CMS')
  if (!body.dataItem) throw new Error('Wix CMS: no item in reply')
  return body.dataItem.id
}

function frWixHeaders() {
  const props = frProps()
  const key = props.getProperty('WIX_API_KEY')
  const site = props.getProperty('WIX_SITE_ID')
  if (!key || !site) throw new Error('Add WIX_API_KEY and WIX_SITE_ID in Script Properties.')
  return { Authorization: key, 'wix-site-id': site }
}

// Reads a JSON reply. If Wix sends an error page instead, says which step failed and why.
function frReadJson(response, step) {
  const code = response.getResponseCode()
  const text = response.getContentText() || ''
  const body = frParseJson(text || '{}')
  if (!body) throw new Error(step + ' ' + code + ': not JSON: ' + text.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 120))
  if (code !== 200) throw new Error(step + ' ' + code + ': ' + (body.message || text.slice(0, 120)))
  return body
}

// "Jane Doe (1921–1998)\n\nParagraphs...\n\nSubmitted by ..." -> { title, body, submittedBy }
function frSplitStory(text, fallbackName) {
  let rest = String(text || '').replace(/\r/g, '').trim()
  let submittedBy = ''
  const sub = rest.match(/(?:^|\s)(submitted by\s[^\n]*)\s*$/i)
  if (sub) {
    submittedBy = sub[1].trim()
    rest = rest.slice(0, sub.index).trim()
  }
  let title = ''
  const head = rest.match(/^\s*[#*\s]*([^\n()]{2,60}\((?:born\s+)?\d{4}(?:\s*[–—-]\s*(?:\d{4}|present))?\))[*\s]*/i)
  if (head) {
    title = head[1].trim()
    rest = rest.slice(head[0].length).trim()
  } else {
    const firstLine = rest.split('\n')[0].trim()
    if (rest.indexOf('\n') >= 0 && firstLine.length <= 80 && !/[.!?]$/.test(firstLine)) {
      title = firstLine.replace(/^[#*\s]+|[*\s]+$/g, '')
      rest = rest.slice(rest.indexOf('\n') + 1).trim()
    }
  }
  return { title: title || String(fallbackName || '').trim(), body: rest, submittedBy: submittedBy }
}

// =====================================================================================
// Sheet helpers
// =====================================================================================
function frProps() {
  return PropertiesService.getScriptProperties()
}

// FR_SHEET_ID can be the Sheet's ID or its link.
function frSpreadsheet() {
  const value = String(frProps().getProperty('FR_SHEET_ID') || '').trim()
  if (!value) frFail('First Reader is not set up yet. Run frSetup() in the Apps Script editor.')
  const m = value.match(/\/d\/([\w-]+)/)
  try {
    return SpreadsheetApp.openById(m ? m[1] : value)
  } catch (err) {
    frFail("Can't open the First Reader Review Sheet. Check FR_SHEET_ID in the script properties, and that this account can edit that Sheet.")
  }
}

function frSheet() {
  const ss = frSpreadsheet()
  return ss.getSheetByName(FR_TAB_NAME) || ss.getSheets()[0]
}

// FR_FORM_ID can be the form's ID or its edit link.
function frFormId() {
  const value = String(frProps().getProperty('FR_FORM_ID') || '').trim()
  const m = value.match(/\/forms\/d\/([\w-]+)/)
  return m ? m[1] : value
}

function frTable(sheet) {
  const values = sheet.getDataRange().getValues()
  const header = (values.shift() || []).map((h) => String(h).trim())
  return { header: header, values: values, col: (name) => header.indexOf(name) }
}

function frRequire(t) {
  const missing = FR_REQUIRED.filter((h) => t.col(h) < 0)
  if (missing.length) frFail('The Review Sheet is missing the "' + missing[0] + '" column. Run frSetup() in the Apps Script editor.')
}

function frRowById(t, id) {
  frRequire(t)
  if (!id) frFail('No story ID was sent.')
  const i = t.values.findIndex((row) => String(row[t.col('ID')]).trim() === id)
  if (i < 0) frFail('That story is no longer in the Review Sheet. Refresh the page.', 'not_found')
  return i + 2
}

function frFindByPerson(t, name, members) {
  frRequire(t)
  const key = frNormName(name) + '#' + frNormMembers(members)
  for (let i = 0; i < t.values.length; i++) {
    const row = t.values[i]
    if (frNormName(String(row[t.col('Name')])) + '#' + frNormMembers(String(row[t.col('Community Member(s)')])) === key) {
      return {
        index: i,
        submission: String(row[t.col('Submission')]).trim(),
        raw: t.col('Raw Gemini Reply') < 0 ? '' : String(row[t.col('Raw Gemini Reply')]),
        count: t.col('Update Count') < 0 ? 0 : row[t.col('Update Count')],
      }
    }
  }
  return null
}

function frNormMembers(text) {
  return String(text).toLowerCase().split(/,|;|\band\b|&|\n/).map((s) => s.trim().replace(/\s+/g, ' ')).filter(Boolean).sort().join('|')
}

function frNormName(text) {
  return String(text).toLowerCase().trim().replace(/\s+/g, ' ')
}

function frWithLock(fn) {
  const lock = LockService.getScriptLock()
  lock.waitLock(30000)
  try {
    return fn()
  } finally {
    lock.releaseLock()
  }
}

// Text that starts with = + - @ would otherwise run as a spreadsheet formula.
function frPlain(text) {
  text = String(text == null ? '' : text)
  return /^[=+\-@]/.test(text) ? "'" + text : text
}

function frNewId() {
  return Utilities.getUuid().slice(0, 8)
}

function frToday() {
  return Utilities.formatDate(new Date(), 'America/New_York', 'MMM d, yyyy h:mm a')
}

function frIso(value) {
  const date = value instanceof Date ? value : new Date(value)
  return value === '' || isNaN(date) ? '' : date.toISOString()
}

function frParseJson(text) {
  try {
    return JSON.parse(text)
  } catch (err) {
    return null
  }
}

function frFail(message, code) {
  const err = new Error(message)
  err.code = code
  throw err
}

// =====================================================================================
// Manual tools (run from the editor)
// =====================================================================================

// Reviews again every row whose Gemini review failed. Stops at the first failure, so a
// quota problem doesn't use up more requests.
function frRetryFailedReviews() {
  const t = frTable(frSheet())
  for (let i = 0; i < t.values.length; i++) {
    const row = t.values[i]
    if (!String(row[t.col('Submission')]).trim() || frIsGoodRaw(row[t.col('Raw Gemini Reply')])) continue
    if (row[t.col('Approve for Website')] === true) continue
    const story = frRetry(String(row[t.col('ID')]).trim())
    if (story.decision === 'error') {
      console.log('Stopped at row ' + (i + 2) + ': ' + story.rawReply)
      return
    }
  }
}

// One Gemini request on the built-in test story. Logs the result; changes nothing.
function frTestReview() {
  const cols = frRunReview(FR_TEST_STORY, 'Keisha Thompson', 'Granddaughter')
  FR_REVIEW_HEADERS.forEach((h, i) => console.log(h + ':\n' + cols[i]))
}

// Three small test calls to Wix. Uploads nothing and changes nothing.
function frDiagnoseWixMedia() {
  const headers = frWixHeaders()
  const tests = [
    ['1. CMS', 'post', 'https://www.wixapis.com/wix-data/v2/items/query', { dataCollectionId: FR_WIX_COLLECTION_ID, query: { paging: { limit: 1 } } }],
    ['2. Media: list files', 'get', 'https://www.wixapis.com/site-media/v1/files?paging.limit=1', null],
    ['3. Media: upload link', 'post', 'https://www.wixapis.com/site-media/v1/files/generate-upload-url', { mimeType: 'image/jpeg', fileName: 'test.jpg' }],
  ]
  tests.forEach((test) => {
    const opts = { method: test[1], headers: headers, muteHttpExceptions: true, followRedirects: false }
    if (test[3]) {
      opts.contentType = 'application/json'
      opts.payload = JSON.stringify(test[3])
    }
    const res = UrlFetchApp.fetch(test[2], opts)
    const text = (res.getContentText() || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 250)
    console.log(test[0] + ' -> ' + res.getResponseCode() + '\n   ' + text)
  })
}
