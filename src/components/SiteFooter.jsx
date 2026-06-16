import { useTranslation } from 'react-i18next'

function SiteFooter() {
  const { t } = useTranslation()

  return (
    <footer className="border-t border-white/[0.06] bg-[#0b1111]">
      <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-5 text-sm text-slate-400 sm:px-6 md:flex-row md:items-center md:justify-between lg:px-8">
        <p className="font-semibold text-slate-400">
          {t('footer.copyright')}{' '}
          <a className="text-emerald-300" href="mailto:washique234@gmail.com">
            washique234@gmail.com
          </a>
        </p>
        <p>
          {t('footer.contact')}{' '}
          <a className="font-semibold text-emerald-300" href="tel:01920065926">
            01920065926
          </a>
        </p>
      </div>
    </footer>
  )
}

export default SiteFooter
