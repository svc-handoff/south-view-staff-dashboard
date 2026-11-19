import { isDemo } from '../data/store'
import * as demo from './demo'

// First Reader's backend is FirstReader.gs, added to the same Apps Script web app as the
// gallery (see apps-script/FIRST_READER_SETUP.md). Its stories live in their own Google
// Sheet, the First Reader Review Sheet, not in the gallery's Sheet.
const API_URL = import.meta.env.VITE_APPS_SCRIPT_URL
// The Google sign-in token the Staff page saved (see data/sheetStore.js).
const TOKEN_KEY = 'south-view-staff-token'

async function call(action, extra = {}) {
  // Plain-text body, so the browser skips the CORS preflight Apps Script can't answer.
  const res = await fetch(API_URL, {
    method: 'POST',
    body: JSON.stringify({ action, idToken: sessionStorage.getItem(TOKEN_KEY), ...extra }),
  })
  if (!res.ok) throw new Error(`The server responded with ${res.status}`)
  const data = await res.json()
  if (data.ok) return data
  // The gallery's script answers "Unknown action." until FirstReader.gs is added to it.
  if (data.error === 'Unknown action.') {
    throw Object.assign(new Error('First Reader is not set up in the Apps Script yet. See apps-script/FIRST_READER_SETUP.md.'), {
      code: 'not_set_up',
    })
  }
  throw Object.assign(new Error(data.error), { code: data.code })
}

const story = (action) => async (id, extra) => (await call(action, { id, ...extra })).story

export const listStories = isDemo ? demo.listStories : () => call('firstReaderList')
export const approveStory = isDemo ? demo.approveStory : story('firstReaderApprove')
export const holdStory = isDemo ? demo.holdStory : story('firstReaderHold')
export const reopenStory = isDemo ? demo.reopenStory : story('firstReaderReopen')
export const retryReview = isDemo ? demo.retryReview : story('firstReaderRetry')
export const saveEdit = isDemo ? demo.saveEdit : (id, editedText) => story('firstReaderSaveEdit')(id, { editedText })
// A story's photo stays private in Drive; the script sends it to signed-in staff as a data URL.
export const loadPhoto = isDemo ? demo.loadPhoto : async (fileId) => (await call('firstReaderPhoto', { fileId })).dataUrl
export const resetDemoStories = demo.resetDemoStories
