import { useCallback, useEffect, useState } from 'react'
import { isDemo } from '../data/store'
import { formatDate } from '../components'
import { approveStory, holdStory, listStories, loadPhoto, reopenStory, resetDemoStories, retryReview, saveEdit } from './api'
import placeholder from './default-photo.svg'
import './first-reader.css'

// First Reader: community stories that families submit through the Google Form. Gemini
// gives each one a first read, and staff decide here or in the Review Sheet whether it
// goes on the website. Both places show the same rows and stay in step.

const FILTERS = [
  { status: 'pending', label: 'Waiting for review' },
  { status: 'approved', label: 'Approved' },
  { status: 'held', label: 'Held back' },
]

const DECISIONS = {
  auto_edit: { label: 'Meets the guidelines', tone: 'good' },
  feedback: { label: 'Needs work', tone: 'warn' },
  error: { label: 'AI review failed', tone: 'bad' },
  parse_error: { label: 'AI reply unreadable', tone: 'bad' },
  no_submission: { label: 'No story found', tone: 'bad' },
}
const FAILED = ['error', 'parse_error', 'no_submission']

export default function FirstReader({ onError }) {
  const [stories, setStories] = useState(null)
  const [sheetUrl, setSheetUrl] = useState('')
  // South-View's default image for stories without a photo (FR_DEFAULT_PHOTO_URL), if set:
  // { fileId } for a Drive image or { url } for an image link.
  const [defaultPhoto, setDefaultPhoto] = useState(null)
  const [filter, setFilter] = useState('pending')
  const [search, setSearch] = useState('')
  const [message, setMessage] = useState(null)

  // An expired sign-in goes back to the Staff page's sign-in. Any other problem,
  // including "not on the First Reader staff list", stays in this tab.
  const handleError = useCallback(
    (err) => (err.code === 'unauthorized' ? onError(err) : setMessage(err.message || 'Something went wrong.')),
    [onError],
  )

  const load = useCallback(async () => {
    setMessage(null)
    try {
      const data = await listStories()
      setStories(data.stories)
      setSheetUrl(data.sheetUrl || '')
      setDefaultPhoto(data.defaultPhoto || null)
    } catch (err) {
      setStories((s) => s ?? [])
      handleError(err)
    }
  }, [handleError])

  useEffect(() => {
    load()
  }, [load])

  const replace = (story) => setStories((all) => all.map((s) => (s.id === story.id ? story : s)))

  async function reset() {
    await resetDemoStories()
    setFilter('pending')
    load()
  }

  const query = search.trim().toLowerCase()
  const matches = (s) => !query || [s.members, s.name, s.email].some((v) => v.toLowerCase().includes(query))
  const shown = (stories || []).filter((s) => s.status === filter && matches(s))
  // Newest first, with stories the AI asked staff to look at closely on top of the waiting list.
  shown.sort((a, b) => (filter === 'pending' ? b.needsReview - a.needsReview : 0) || b.lastUpdated.localeCompare(a.lastUpdated))

  return (
    <div className="fr">
      <div className="fr-head">
        <p className="lead">
          Stories families share about people buried at South-View. Gemini gives each one a first read; nothing goes on
          the website until you approve it. You can also decide in the{' '}
          {sheetUrl ? (
            <a href={sheetUrl} target="_blank" rel="noreferrer">Review Sheet</a>
          ) : (
            'Review Sheet'
          )}
          : tick <strong>Approve for Website</strong> or <strong>Held Back</strong>.
        </p>
        <div className="fr-tools">
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name"
            aria-label="Search stories by name"
          />
          <button className="button button-outline" onClick={load}>Refresh</button>
          {isDemo && <button className="button button-outline" onClick={reset}>Reset sample stories</button>}
        </div>
      </div>

      <div className="fr-filters" role="tablist" aria-label="Story status">
        {FILTERS.map((f) => (
          <button
            key={f.status}
            role="tab"
            aria-selected={filter === f.status}
            className={filter === f.status ? 'fr-filter active' : 'fr-filter'}
            onClick={() => setFilter(f.status)}
          >
            {f.label} <span>{(stories || []).filter((s) => s.status === f.status).length}</span>
          </button>
        ))}
      </div>

      {message && <p className="error">{message}</p>}
      {isDemo && <p className="hint fr-demo">Demo mode: these are sample stories about invented people, saved only in this browser.</p>}
      {stories === null && <p className="empty">Loading stories…</p>}
      {stories && shown.length === 0 && <p className="empty">{query ? 'No stories match that name.' : 'Nothing here right now.'}</p>}

      <div className="review-list">
        {shown.map((story) => (
          <StoryCard key={story.id} story={story} defaultPhoto={defaultPhoto} onChange={replace} onError={handleError} />
        ))}
      </div>
    </div>
  )
}

function StoryCard({ story, defaultPhoto, onChange, onError }) {
  const [busy, setBusy] = useState(false)
  const [confirm, setConfirm] = useState(false)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(story.editedText)
  const [note, setNote] = useState(null)
  const decision = DECISIONS[story.decision] || { label: story.decision || 'Not reviewed', tone: 'warn' }
  const failed = FAILED.includes(story.decision)

  async function run(action, ...args) {
    setBusy(true)
    setNote(null)
    try {
      const updated = await action(story.id, ...args)
      onChange(updated)
      return updated
    } catch (err) {
      onError(err)
    } finally {
      setBusy(false)
      setConfirm(false)
    }
  }

  async function approve() {
    // Publishing is public, so it takes a second click.
    if (!confirm) return setConfirm(true)
    const updated = await run(approveStory)
    if (updated && updated.status !== 'approved') setNote(updated.websiteStatus)
  }

  async function save() {
    if ((await run(saveEdit, draft)) !== undefined) setEditing(false)
  }

  return (
    <article className="review-card fr-card">
      <div className="fr-card-top">
        <StoryPhoto story={story} defaultPhoto={defaultPhoto} />
        <div className="fr-who">
          <p className="fr-kicker">{story.personTitle || 'Community story'}</p>
          <h2 className="fr-person">{story.members || <em>No name given</em>}</h2>
          <p className="fr-by">
            Submitted by {story.name || 'unknown'}
            {story.email && (
              <>
                {' · '}
                <a href={`mailto:${story.email}`}>{story.email}</a>
              </>
            )}
          </p>
        </div>
        <div className="fr-meta">
          {story.lastUpdated && <span>{story.updateCount ? 'Updated' : 'Submitted'} {formatDate(story.lastUpdated)}</span>}
          {story.updateCount > 0 && <span>Resubmitted {story.updateCount} {story.updateCount === 1 ? 'time' : 'times'}</span>}
          <span>Sheet row {story.row}</span>
        </div>
      </div>

      <div className="fr-badges">
        {story.score !== null && (
          <span className={`fr-badge ${story.score >= 70 ? 'good' : 'warn'}`}>Score {story.score}/100</span>
        )}
        <span className={`fr-badge ${decision.tone}`}>{decision.label}</span>
        {story.needsReview && <span className="fr-badge bad">Needs a closer look</span>}
      </div>

      <div className="fr-texts">
        <section>
          <h3>Story as submitted</h3>
          <div className="fr-text">{story.submission || <em>No story text.</em>}</div>
        </section>
        <section>
          <h3>
            Edited text <span>what gets published; the first line becomes the title</span>
          </h3>
          {editing ? (
            <>
              <textarea value={draft} onChange={(e) => setDraft(e.target.value)} rows={12} aria-label="Edited text" />
              <div className="actions">
                <button className="button" disabled={busy || !draft.trim()} onClick={save}>
                  {busy ? 'Saving…' : 'Save edits'}
                </button>
                <button
                  className="button button-outline"
                  disabled={busy}
                  onClick={() => {
                    setEditing(false)
                    setDraft(story.editedText)
                  }}
                >
                  Cancel
                </button>
              </div>
            </>
          ) : (
            <>
              <div className="fr-text">{story.editedText || <em>No edited text yet.</em>}</div>
              {!story.approved && (
                <button
                  className="fr-link"
                  onClick={() => {
                    setDraft(story.editedText || story.submission)
                    setEditing(true)
                  }}
                >
                  Edit this text
                </button>
              )}
            </>
          )}
        </section>
      </div>

      <dl className="fr-details">
        <Detail label="Facts to verify" value={story.factsToVerify} />
        <Detail label="Changes made" value={story.changesMade} />
        <Detail label="Feedback for the writer" value={story.feedback} />
        <Detail label="Score breakdown" value={story.scoreBreakdown} />
        {story.photos.length > 0 && (
          <div>
            <dt>Photos</dt>
            <dd>
              {story.photos.map((p, i) =>
                p.url.startsWith('https://') ? (
                  <a key={p.fileId} href={p.url} target="_blank" rel="noreferrer" className="fr-photo-link">
                    Photo {i + 1} in Drive
                  </a>
                ) : (
                  <span key={p.fileId} className="fr-photo-link">Photo {i + 1}</span>
                ),
              )}
              <p className="fr-small">Approved stories send the first {Math.min(3, story.photos.length)} to the website. To leave one off, delete its link in the Sheet's Photos column first.</p>
            </dd>
          </div>
        )}
      </dl>

      <p className={`fr-status ${story.websiteStatus.startsWith('Wix error') || story.websiteStatus.startsWith('Not published') ? 'is-error' : ''}`}>
        <strong>Website:</strong> {story.websiteStatus || 'Not published'}
      </p>
      {story.published && story.status !== 'approved' && (
        <p className="burial-day-note">
          This story is already on the website. To take it down, or to change the live version, edit it in the Wix CMS
          (CommunityStories collection).
        </p>
      )}

      <details className="fr-raw">
        <summary>Raw Gemini reply</summary>
        <pre>{story.rawReply || 'None'}</pre>
      </details>

      {note && <p className="error">{note}</p>}
      <div className="actions">
        {story.status !== 'approved' && !failed && (
          <button className={confirm ? 'button button-danger' : 'button'} disabled={busy || editing} onClick={approve}>
            {busy && confirm ? 'Publishing…' : confirm ? 'Click again to publish' : story.published ? 'Approve' : 'Approve & publish'}
          </button>
        )}
        {story.status === 'pending' && (
          <button className="button button-outline" disabled={busy} onClick={() => run(holdStory)}>Hold back</button>
        )}
        {story.status !== 'pending' && (
          <button className="button button-outline" disabled={busy} onClick={() => run(reopenStory)}>
            Move back to waiting
          </button>
        )}
        {failed && story.status !== 'approved' && (
          <button className="button button-outline" disabled={busy} onClick={() => run(retryReview)}>
            {busy ? 'Working…' : 'Run the AI review again'}
          </button>
        )}
      </div>
    </article>
  )
}

// The story's first photo, loaded privately from Drive through the script. A story with no
// photo shows South-View's default photo (what the website will use), or a placeholder.
function StoryPhoto({ story, defaultPhoto }) {
  const ownId = story.photos[0]?.fileId
  const usingDefault = !ownId && Boolean(defaultPhoto)
  const fileId = ownId || defaultPhoto?.fileId
  const [src, setSrc] = useState(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    if (!fileId) return
    let cancelled = false
    setSrc(null)
    setFailed(false)
    loadPhoto(fileId)
      .then((url) => !cancelled && setSrc(url))
      .catch(() => !cancelled && setFailed(true))
    return () => {
      cancelled = true
    }
  }, [fileId])

  let shown = placeholder
  if (fileId && !failed) shown = src
  else if (!fileId && defaultPhoto?.url) shown = defaultPhoto.url

  let caption = null
  if (ownId && failed) caption = "This photo couldn't be loaded. Open it from the link below."
  else if (usingDefault) caption = 'No photo shared. The website will show this default photo.'
  else if (story.photos.length > 1) caption = `1 of ${story.photos.length} photos`

  return (
    <figure className="fr-photo">
      {fileId && !src && !failed ? (
        <div className="fr-photo-img fr-photo-loading" aria-label="Loading photo" />
      ) : (
        <img
          className="fr-photo-img"
          src={shown}
          alt={ownId && !failed ? `Photo of ${story.members || 'the person in this story'}` : usingDefault ? 'Default photo' : 'No photo shared'}
          referrerPolicy="no-referrer"
          onError={(e) => {
            if (!e.currentTarget.src.endsWith(placeholder)) e.currentTarget.src = placeholder
          }}
        />
      )}
      {caption && <figcaption>{caption}</figcaption>}
    </figure>
  )
}

function Detail({ label, value }) {
  if (!value || !value.trim()) return null
  return (
    <div>
      <dt>{label}</dt>
      <dd className="fr-text">{value}</dd>
    </div>
  )
}
