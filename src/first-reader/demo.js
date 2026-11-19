// Demo backend for the First Reader tab: sample stories about invented people, kept in
// this browser only. Each story has the same fields the live backend (FirstReader.gs)
// sends for one row of the Review Sheet.
const KEY = 'south-view-first-reader-demo'

// A drawing standing in for an uploaded family photo (sepia porch portrait).
const PORCH_PHOTO =
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 375">
  <defs><linearGradient id="s" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#e9d8b9"/><stop offset="1" stop-color="#b99568"/></linearGradient></defs>
  <rect width="300" height="375" fill="url(#s)"/>
  <rect x="0" y="250" width="300" height="125" fill="#8a6a45"/>
  <rect x="20" y="40" width="14" height="210" fill="#a7865c"/><rect x="266" y="40" width="14" height="210" fill="#a7865c"/>
  <rect x="0" y="30" width="300" height="16" fill="#7a5c3b"/>
  <circle cx="150" cy="150" r="34" fill="#6b4f33"/>
  <rect x="112" y="118" width="76" height="12" rx="4" fill="#4a3522"/><rect x="128" y="96" width="44" height="26" rx="6" fill="#4a3522"/>
  <path d="M96 290c4-58 26-92 54-92s50 34 54 92z" fill="#5a4129"/>
  <rect x="70" y="282" width="160" height="16" fill="#6b4f33"/>
</svg>`)

const DEMO_PHOTOS = { 'demo-photo-1': PORCH_PHOTO }

const daysAgo = (n) => new Date(Date.now() - n * 86400000).toISOString()

const breakdown = (s, t, p) =>
  `Structure ${s}/40: Opens with the name and years and ends with the submitter.\nTone ${t}/35: Warm and respectful, in the family's own voice.\nProfessionalism ${p}/25: A few spelling and grammar fixes were needed.`

function seed() {
  return [
    {
      id: 'demo-1',
      row: 2,
      lastUpdated: daysAgo(1),
      name: 'Keisha Thompson',
      email: 'keisha@example.com',
      members: 'James Earl Thompson',
      personTitle: 'Railroad worker',
      submission:
        "My granddaddy James Earl Thompson was born in 1930 in Macon and he moved to Atlanta when he was 19. He worked for the railroad for 35 years and he aint never missed a day of work. Everybody on our street knew him cause he be out on the porch every evening waving at folks.\n\nHe was a deacon at Mount Zion Baptist Church and he started a program that gave free groceries to familes who needed help. He did that for over 20 years and never asked for nothing back.\n\nHe passed away in 2009 and he is buried at South-View next to his mama. We miss him every day.\n\nSubmitted by Keisha Thompson, granddaughter",
      score: 82,
      decision: 'auto_edit',
      needsReview: false,
      editedText:
        'James Earl Thompson (1930–2009)\n\nJames Earl Thompson was born in Macon in 1930 and moved to Atlanta when he was 19. He worked for the railroad for 35 years and never missed a day of work. Everybody on his street knew him, because he was out on the porch every evening waving at folks.\n\nHe was a deacon at Mount Zion Baptist Church, where he started a program that gave free groceries to families who needed help. He ran it for more than 20 years and never asked for anything back.\n\nHe died in 2009 and is buried at South-View next to his mother. His family misses him every day.\n\nSubmitted by Keisha Thompson, granddaughter',
      changesMade: '• Added a name-and-years first line\n• Fixed "familes" to "families"\n• Smoothed a few sentences while keeping the family\'s voice',
      feedback: '',
      factsToVerify: '• Born 1930 in Macon\n• Died 2009\n• Buried next to his mother at South-View',
      scoreBreakdown: breakdown(32, 30, 20),
      rawReply: '{"decision":"auto_edit", "...": "sample reply"}',
      updateCount: 0,
      approved: false,
      heldBack: false,
      status: 'pending',
      published: false,
      websiteStatus: 'Waiting for staff approval',
      photos: [{ fileId: 'demo-photo-1', url: '#' }],
    },
    {
      id: 'demo-2',
      row: 3,
      lastUpdated: daysAgo(3),
      name: 'Marcus Reynolds',
      email: 'marcus@example.com',
      members: 'Dorothy Mae Reynolds',
      personTitle: 'Seamstress',
      submission:
        'Aunt Dot sewed every choir robe at our church for forty years. If you need the pattern call my cousin Tanya at her house on Simpson Street, she still has them all.\n\nSubmitted by Marcus Reynolds',
      score: 58,
      decision: 'feedback',
      needsReview: true,
      editedText:
        "Dorothy Mae Reynolds\n\nDorothy Mae Reynolds sewed every choir robe at her church for forty years.\n\nSubmitted by Marcus Reynolds, nephew",
      changesMade: '• Removed a living relative\'s home street\n• Added a heading line',
      feedback: '• Add her birth and death years if you know them\n• Share a memory that shows who she was',
      factsToVerify: '• Sewed choir robes for forty years\n• Birth and death years are missing',
      scoreBreakdown: breakdown(18, 24, 16),
      rawReply: '{"decision":"feedback", "...": "sample reply"}',
      updateCount: 1,
      approved: false,
      heldBack: false,
      status: 'pending',
      published: false,
      websiteStatus: 'Waiting for staff approval',
      photos: [],
    },
    {
      id: 'demo-3',
      row: 4,
      lastUpdated: daysAgo(2),
      name: 'Lena Brooks',
      email: 'lena@example.com',
      members: 'Walter Brooks',
      personTitle: '',
      submission: 'Grandpa Walter fixed every radio on our block.\n\nSubmitted by Lena Brooks',
      score: null,
      decision: 'error',
      needsReview: true,
      editedText: '',
      changesMade: '',
      feedback: '',
      factsToVerify: '',
      scoreBreakdown: '',
      rawReply: 'Gemini error: (429) Resource has been exhausted (e.g. check quota).',
      updateCount: 0,
      approved: false,
      heldBack: false,
      status: 'pending',
      published: false,
      websiteStatus: 'Waiting for staff approval',
      photos: [],
    },
    {
      id: 'demo-4',
      row: 5,
      lastUpdated: daysAgo(9),
      name: 'Gloria Booker',
      email: 'gloria@example.com',
      members: 'Clarence Booker',
      personTitle: 'Schoolteacher',
      submission: 'My father taught history at our neighborhood high school for 31 years...\n\nSubmitted by Gloria Booker, daughter',
      score: 91,
      decision: 'auto_edit',
      needsReview: false,
      editedText:
        'Clarence Booker (1924–2001)\n\nClarence Booker taught history at his neighborhood high school for 31 years, and former students still quote his lessons.\n\nSubmitted by Gloria Booker, daughter',
      changesMade: '• Added a name-and-years first line',
      feedback: '',
      factsToVerify: '• Taught for 31 years\n• 1924–2001',
      scoreBreakdown: breakdown(38, 31, 22),
      rawReply: '{"decision":"auto_edit", "...": "sample reply"}',
      updateCount: 0,
      approved: true,
      heldBack: false,
      status: 'approved',
      published: true,
      websiteStatus: 'Published (demo)',
      photos: [],
    },
  ]
}

function read() {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY))
    if (Array.isArray(saved)) return saved
  } catch {
    // Storage blocked or broken: fall back to fresh samples.
  }
  return seed()
}

function write(stories) {
  try {
    localStorage.setItem(KEY, JSON.stringify(stories))
  } catch {
    // Storage blocked: changes last until the page reloads.
  }
}

const wait = () => new Promise((r) => setTimeout(r, 350))

async function change(id, fn) {
  await wait()
  const stories = read()
  const story = stories.find((s) => s.id === id)
  if (!story) throw new Error('That story is no longer in the Review Sheet. Refresh the page.')
  fn(story)
  story.status = story.approved ? 'approved' : story.heldBack ? 'held' : 'pending'
  write(stories)
  return { ...story }
}

export async function listStories() {
  await wait()
  return { stories: read(), sheetUrl: '', defaultPhoto: null }
}

export const approveStory = (id) =>
  change(id, (s) => {
    if (['error', 'parse_error', 'no_submission'].includes(s.decision) || !s.editedText.trim()) {
      s.websiteStatus = 'Not published: this row has no reviewed story. Fix the Edited Text, then approve again.'
      return
    }
    s.approved = true
    s.heldBack = false
    if (!s.published) {
      s.published = true
      s.websiteStatus = 'Published (demo)'
    }
  })

export const holdStory = (id) =>
  change(id, (s) => {
    s.approved = false
    s.heldBack = true
    if (!s.published) s.websiteStatus = 'Held back by staff (demo)'
  })

export const reopenStory = (id) =>
  change(id, (s) => {
    s.approved = false
    s.heldBack = false
    if (!s.published) s.websiteStatus = 'Waiting for staff approval'
  })

export const saveEdit = (id, text) =>
  change(id, (s) => {
    if (!String(text).trim()) throw new Error('The edited story is empty.')
    s.editedText = String(text).trim()
  })

export const retryReview = (id) =>
  change(id, (s) => {
    if (s.approved) throw new Error('This story is already approved. Hold it back first to review it again.')
    Object.assign(s, {
      score: 74,
      decision: 'auto_edit',
      needsReview: false,
      editedText: `${s.members}\n\n${s.submission.replace(/\n*Submitted by[^\n]*$/i, '')}\n\nSubmitted by ${s.name}`,
      changesMade: '• Added a heading line',
      feedback: '',
      factsToVerify: '• Birth and death years are missing',
      scoreBreakdown: breakdown(26, 28, 20),
      rawReply: '{"decision":"auto_edit", "...": "sample reply"}',
    })
  })

// Demo photos are bundled drawings, standing in for photos families upload.
export async function loadPhoto(fileId) {
  await wait()
  const photo = DEMO_PHOTOS[fileId]
  if (!photo) throw new Error('That photo is not linked from the Review Sheet.')
  return photo
}

export async function resetDemoStories() {
  write(seed())
}
