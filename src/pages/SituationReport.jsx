import PropTypes from 'prop-types'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../auth/useAuth.js'
import { generateSituationReport } from '../services/situationReport.js'

const SAMPLE_NOTES = `Flooding in Sunamganj since yesterday evening. Around 3 villages cut off, possibly 4000 people stranded on rooftops and high ground. Two health workers report stomach illness spreading among children. Drinking water tube wells submerged. One mobile tower down. Pregnant woman needs evacuation - reported via radio from Tahirpur. Rice stocks expected to run out in 2 days. No electricity since 3am.`

const SECTIONS = [
  { key: 'affected_population_estimate', isList: false },
  { key: 'key_risks', isList: true },
  { key: 'immediate_needs', isList: true },
  { key: 'recommended_actions', isList: true },
]

function ResultColumn({ heading, value, isList }) {
  return (
    <div>
      <p className="text-xs font-bold uppercase tracking-wide text-primary">
        {heading}
      </p>
      {isList ? (
        <ul className="mt-3 grid gap-2">
          {value.map((item, idx) => (
            <li
              className="rounded-md bg-primary-50 px-3 py-2 text-sm leading-6 text-slate-800"
              key={`${heading}-${idx}`}
            >
              {item}
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 rounded-md bg-primary-50 px-3 py-2 text-sm leading-6 text-slate-800">
          {value}
        </p>
      )}
    </div>
  )
}

ResultColumn.propTypes = {
  heading: PropTypes.string.isRequired,
  value: PropTypes.oneOfType([
    PropTypes.string,
    PropTypes.arrayOf(PropTypes.string),
  ]).isRequired,
  isList: PropTypes.bool.isRequired,
}

function SituationReport() {
  const { t } = useTranslation()
  const { user } = useAuth()
  const [notes, setNotes] = useState('')
  const [report, setReport] = useState(null)
  const [status, setStatus] = useState('idle')
  const [error, setError] = useState(null)

  const onSubmit = async (event) => {
    event.preventDefault()
    setStatus('loading')
    setError(null)
    setReport(null)

    try {
      const result = await generateSituationReport(notes.trim())
      setReport(result)
      setStatus('idle')
    } catch (err) {
      setError(err.message)
      setStatus('idle')
    }
  }

  const loadSample = () => {
    setNotes(SAMPLE_NOTES)
  }

  const isLoading = status === 'loading'
  const canSubmit = notes.trim().length > 10 && !isLoading

  return (
    <section className="page-shell">
      <div className="mb-8 max-w-3xl">
        <p className="text-sm font-semibold uppercase tracking-wide text-primary">
          {t('dashboard.workspace', { role: t(`roles.${user.role}`) })}
        </p>
        <h1 className="mt-3 text-4xl font-bold leading-tight text-slate-950">
          {t('situation.title')}
        </h1>
        <p className="mt-4 leading-7 text-slate-600">
          {t('situation.intro')}
        </p>
      </div>

      <div className="grid gap-6 xl:grid-cols-[420px_minmax(0,1fr)]">
        <aside className="self-start rounded-lg border border-primary-100 bg-white p-6 shadow-soft">
          <h2 className="text-xl font-bold text-slate-950">
            {t('situation.fieldNotes')}
          </h2>
          <p className="mt-2 text-sm text-slate-600">
            {t('situation.fieldNotesHelp')}
          </p>

          <form className="mt-5 grid gap-4" onSubmit={onSubmit}>
            <label className="form-label">
              <span className="flex items-center justify-between">
                {t('situation.rawNotes')}
                <button
                  className="text-xs font-bold uppercase tracking-wide text-primary hover:underline"
                  onClick={loadSample}
                  type="button"
                >
                  {t('situation.loadSample')}
                </button>
              </span>
              <textarea
                className="form-input min-h-[260px] resize-y leading-6"
                onChange={(event) => setNotes(event.target.value)}
                placeholder={t('situation.placeholder')}
                value={notes}
              />
            </label>

            <button
              className="button-primary w-full"
              disabled={!canSubmit}
              type="submit"
            >
              {isLoading ? t('situation.generating') : t('situation.generate')}
            </button>
          </form>

          {error ? (
            <div className="mt-5 rounded-md border border-accent-100 bg-accent-50 p-4 text-sm leading-6 text-accent-700">
              <p className="font-bold">{t('situation.errorTitle')}</p>
              <p className="mt-1 break-words">{error}</p>
            </div>
          ) : null}
        </aside>

        <div className="min-w-0">
          {isLoading ? (
            <div className="grid min-h-[300px] place-items-center rounded-lg border border-dashed border-primary-100 bg-white p-8 text-center shadow-soft">
              <div>
                <p className="text-sm font-semibold uppercase tracking-wide text-primary">
                  {t('situation.working')}
                </p>
                <p className="mt-3 text-lg font-bold text-slate-950">
                  {t('situation.reading')}
                </p>
                <p className="mt-2 text-sm text-slate-600">
                  {t('situation.generatingSummary')}
                </p>
              </div>
            </div>
          ) : null}

          {!isLoading && !report ? (
            <div className="grid min-h-[300px] place-items-center rounded-lg border border-dashed border-primary-100 bg-white p-8 text-center shadow-soft">
              <div className="max-w-md">
                <p className="text-sm font-semibold uppercase tracking-wide text-primary">
                  {t('situation.awaitingInput')}
                </p>
                <p className="mt-3 text-lg font-bold text-slate-950">
                  {t('situation.awaitingTitle')}
                </p>
                <p className="mt-2 text-sm text-slate-600">
                  {t('situation.awaitingBody')}
                </p>
              </div>
            </div>
          ) : null}

          {!isLoading && report ? (
            <article className="rounded-lg border border-primary-100 bg-white p-6 shadow-soft">
              <header className="mb-6 flex flex-wrap items-end justify-between gap-3 border-b border-primary-100 pb-4">
                <div>
                  <h2 className="text-2xl font-bold text-slate-950">
                    {t('situation.summary')}
                  </h2>
                  <p className="mt-1 text-sm text-slate-600">
                    {t('situation.review')}
                  </p>
                </div>
                <span className="rounded-md bg-primary-50 px-3 py-1 text-xs font-bold uppercase tracking-wide text-primary">
                  {t('situation.bilingual')}
                </span>
              </header>

              <div className="grid gap-8">
                {SECTIONS.map((section) => {
                  const data = report[section.key]
                  if (!data) return null
                  return (
                    <section key={section.key}>
                      <div className="mb-3 flex flex-wrap items-baseline gap-2">
                        <h3 className="text-lg font-bold text-slate-950">
                          {t(`situation.sections.${section.key}.en`)}
                        </h3>
                        <span className="text-sm font-semibold text-slate-500">
                          / {t(`situation.sections.${section.key}.bn`)}
                        </span>
                      </div>
                      <div className="grid gap-4 md:grid-cols-2">
                        <ResultColumn
                          heading={t('situation.english')}
                          isList={section.isList}
                          value={data.en}
                        />
                        <ResultColumn
                          heading={t('situation.bangla')}
                          isList={section.isList}
                          value={data.bn}
                        />
                      </div>
                    </section>
                  )
                })}
              </div>
            </article>
          ) : null}
        </div>
      </div>
    </section>
  )
}

export default SituationReport
