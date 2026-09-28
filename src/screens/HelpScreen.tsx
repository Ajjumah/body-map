import Icon from '../components/Icon';
import { detectCountry, helpFor } from '../data/helplines';
import { useT } from '../i18n';
import { useStore } from '../store';

const telHref = (s: string) => `tel:${s.replace(/[^\d+]/g, '')}`;
const looksLikePhone = (s: string) => /^[+\d][\d\s()-]{5,}$/.test(s.trim());

export default function HelpScreen() {
  const { settings } = useStore();
  const tr = useT();
  const { t } = tr;
  const hasContact = settings.supportContact || settings.supportName;
  const code = settings.helplineCountry ?? detectCountry();
  const help = helpFor(code);

  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-3xl text-ink">{t('help.title')}</h2>
      <p className="text-lg text-ink">{t('help.intro')}</p>

      {hasContact ? (
        <section aria-labelledby="h-contact" className="card p-4">
          <h3 id="h-contact" className="text-sm font-bold text-muted">{t('help.yourPerson')}</h3>
          <p className="font-display text-2xl text-ink">{settings.supportName || t('help.supportContact')}</p>
          {settings.supportContact &&
            (looksLikePhone(settings.supportContact) ? (
              <a href={telHref(settings.supportContact)} className="btn btn-primary btn-big mt-2">
                <Icon name="phone" size={20} /> {t('help.call', { number: settings.supportContact })}
              </a>
            ) : (
              <p className="mt-1 text-ink">{settings.supportContact}</p>
            ))}
        </section>
      ) : (
        <p className="card border-dashed p-4 text-muted">
          {t('help.addPerson')}{' '}
          <a href="#/settings" className="font-bold text-ink underline">{t('help.settingsLink')}</a>
        </p>
      )}

      <section aria-labelledby="h-lines" className="card p-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h3 id="h-lines" className="text-2xl text-ink">
            {help ? t('help.linesIn', { country: tr.country(help.code) }) : t('help.otherCountry')}
          </h3>
          <a href="#/settings" className="text-sm font-bold text-ink underline">{t('help.changeCountry')}</a>
        </div>
        {help?.lines.map((line) => (
          <div key={line.name} className="mt-3">
            <p className="font-bold text-ink">{line.name}</p>
            <p className="text-sm text-muted">
              {t('help.free24')}
              {line.noteKey && ` · ${t(line.noteKey)}`}
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              <a href={`tel:${line.tel}`} className="btn btn-primary btn-big">
                <Icon name="phone" size={20} /> {t('help.call', { number: line.number })}
              </a>
              {line.sms && (
                <a href={`sms:${line.tel}`} className="btn btn-big">
                  <Icon name="message" size={20} /> {t('help.text', { number: line.number })}
                </a>
              )}
            </div>
          </div>
        ))}
        <p className="mt-4 text-sm text-muted">
          {t('help.other')}{' '}
          <a href="https://findahelpline.com" target="_blank" rel="noopener noreferrer" className="font-bold text-ink underline">
            {t('help.otherLink')}
          </a>
        </p>
      </section>

      <section aria-labelledby="h-now" className="card bg-accent-soft p-4">
        <h3 id="h-now" className="mb-1 text-xl text-ink">{t('help.danger')}</h3>
        <p className="text-ink">{help ? t('help.dangerBody', { number: help.emergency }) : t('help.dangerGeneric')}</p>
        {help && (
          <a href={`tel:${help.emergency.split(/\s|\//)[0]}`} className="btn btn-danger mt-3">
            <Icon name="phone" size={18} /> {t('help.call', { number: help.emergency.split(/\s|\//)[0] })}
          </a>
        )}
      </section>

      <section aria-labelledby="h-about" className="card p-4 text-sm text-muted">
        <h3 id="h-about" className="mb-1 text-xl text-ink">{t('help.about')}</h3>
        <p>{t('help.aboutBody')}</p>
      </section>
    </div>
  );
}
