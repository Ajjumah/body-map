import { useStore } from '../store';
import Icon from '../components/Icon';

// SADAG Suicide Crisis Helpline (South Africa), toll-free, 24 hours.
// Verified 2026-09-27 against sadag.org and the gov.za contacts list.
export const SADAG = { name: 'SADAG 24-hour helpline', number: '0800 567 567', tel: '0800567567', note: 'South African Depression and Anxiety Group · Suicide Crisis Helpline · toll-free, 24 hours' };

const telHref = (s: string) => `tel:${s.replace(/[^\d+]/g, '')}`;
const looksLikePhone = (s: string) => /^[+\d][\d\s()-]{5,}$/.test(s.trim());

export default function HelpScreen() {
  const { settings } = useStore();
  const hasContact = settings.supportContact || settings.supportName;
  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-3xl text-ink">Help &amp; support</h2>
      <p className="text-lg text-ink">If things feel like too much right now, you don’t have to hold it alone. Reaching out is a strong thing to do.</p>

      {hasContact ? (
        <section aria-labelledby="h-contact" className="card p-4">
          <h3 id="h-contact" className="text-sm font-semibold text-muted">Your support person</h3>
          <p className="font-display text-2xl text-ink">{settings.supportName || 'Support contact'}</p>
          {settings.supportContact &&
            (looksLikePhone(settings.supportContact) ? (
              <a href={telHref(settings.supportContact)} className="btn btn-primary btn-big mt-2">
                <Icon name="phone" size={20} /> Call {settings.supportContact}
              </a>
            ) : (
              <p className="mt-1 text-ink">{settings.supportContact}</p>
            ))}
        </section>
      ) : (
        <p className="card border-dashed p-4 text-muted">
          You can add someone you trust in <a href="#/settings" className="font-bold text-ink underline">Settings</a> so they’re always one tap away.
        </p>
      )}

      <section aria-labelledby="h-sadag" className="card p-4">
        <h3 id="h-sadag" className="text-2xl text-ink">{SADAG.name}</h3>
        <p className="text-sm text-muted">{SADAG.note}</p>
        <a href={`tel:${SADAG.tel}`} className="btn btn-primary btn-big mt-3">
          <Icon name="phone" size={20} /> Call {SADAG.number}
        </a>
      </section>

      <section aria-labelledby="h-now" className="card bg-accent-soft p-4">
        <h3 id="h-now" className="mb-1 text-xl text-ink">If you’re in immediate danger</h3>
        <p className="text-ink">Please contact your local emergency number or go to the nearest emergency room.</p>
      </section>

      <section aria-labelledby="h-about" className="card p-4 text-sm text-muted">
        <h3 id="h-about" className="mb-1 text-xl text-ink">About Body Map</h3>
        <p>Body Map helps you notice where feelings show up in your body. It’s a self-awareness aid, not a diagnosis or treatment. Everything stays on this device: no accounts, no tracking.</p>
      </section>
    </div>
  );
}
