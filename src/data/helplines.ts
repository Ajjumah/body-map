/**
 * Free crisis lines by country, plus the emergency number.
 * Verified 2026-09-28 against the services' own or government sites:
 * sadag.org, 988lifeline.org, samaritans.org, lifeline.org.au, 1737.org.nz,
 * telemanas.mohfw.gov.in, sanidad.gob.es/linea024, 3114.fr, cvv.org.br,
 * sns24.gov.pt, gob.mx/lineadelavida. Re-check before relying on them.
 */
export type Helpline = {
  name: string;
  /** Display form of the number. */
  number: string;
  /** Digits for tel:/sms: links. */
  tel: string;
  /** Can also be reached by SMS on the same number. */
  sms?: boolean;
  /** i18n key for an extra instruction. */
  noteKey?: 'help.pt.option';
};

export type CountryHelp = { code: string; lines: Helpline[]; emergency: string };

export const HELPLINES: CountryHelp[] = [
  { code: 'ZA', emergency: '112 / 10111', lines: [{ name: 'SADAG Suicide Crisis Helpline', number: '0800 567 567', tel: '0800567567' }] },
  { code: 'US', emergency: '911', lines: [{ name: '988 Suicide & Crisis Lifeline', number: '988', tel: '988', sms: true }] },
  { code: 'CA', emergency: '911', lines: [{ name: '9-8-8 Suicide Crisis Helpline', number: '988', tel: '988', sms: true }] },
  { code: 'GB', emergency: '999', lines: [{ name: 'Samaritans', number: '116 123', tel: '116123' }] },
  { code: 'IE', emergency: '112', lines: [{ name: 'Samaritans', number: '116 123', tel: '116123' }] },
  { code: 'AU', emergency: '000', lines: [{ name: 'Lifeline Australia', number: '13 11 14', tel: '131114' }] },
  { code: 'NZ', emergency: '111', lines: [{ name: '1737, Need to talk?', number: '1737', tel: '1737', sms: true }] },
  { code: 'IN', emergency: '112', lines: [{ name: 'Tele-MANAS', number: '14416', tel: '14416' }] },
  { code: 'ES', emergency: '112', lines: [{ name: 'Línea 024', number: '024', tel: '024' }] },
  { code: 'FR', emergency: '112', lines: [{ name: '3114 – Prévention du suicide', number: '3114', tel: '3114' }] },
  { code: 'PT', emergency: '112', lines: [{ name: 'SNS 24', number: '808 24 24 24', tel: '808242424', noteKey: 'help.pt.option' }] },
  { code: 'BR', emergency: '192', lines: [{ name: 'CVV – Centro de Valorização da Vida', number: '188', tel: '188' }] },
  { code: 'MX', emergency: '911', lines: [{ name: 'Línea de la Vida', number: '800 911 2000', tel: '8009112000' }] },
];

export const DEFAULT_COUNTRY = 'ZA';
/** Marker for "my country isn't listed". */
export const OTHER_COUNTRY = 'OTHER';

export function helpFor(code?: string): CountryHelp | undefined {
  return HELPLINES.find((h) => h.code === code);
}

const TZ_COUNTRY: Record<string, string> = {
  'Africa/Johannesburg': 'ZA',
  'Europe/London': 'GB',
  'Europe/Belfast': 'GB',
  'Europe/Dublin': 'IE',
  'Europe/Madrid': 'ES',
  'Atlantic/Canary': 'ES',
  'Europe/Paris': 'FR',
  'Europe/Lisbon': 'PT',
  'Atlantic/Madeira': 'PT',
  'Atlantic/Azores': 'PT',
  'Asia/Kolkata': 'IN',
  'Asia/Calcutta': 'IN',
  'Pacific/Auckland': 'NZ',
  'Pacific/Chatham': 'NZ',
  'America/Mexico_City': 'MX',
  'America/Monterrey': 'MX',
  'America/Tijuana': 'MX',
  'America/Cancun': 'MX',
  'America/Merida': 'MX',
  'America/Chihuahua': 'MX',
  'America/Hermosillo': 'MX',
  'America/Mazatlan': 'MX',
  'America/Sao_Paulo': 'BR',
  'America/Fortaleza': 'BR',
  'America/Recife': 'BR',
  'America/Bahia': 'BR',
  'America/Belem': 'BR',
  'America/Manaus': 'BR',
  'America/Cuiaba': 'BR',
  'America/Campo_Grande': 'BR',
  'America/Porto_Velho': 'BR',
  'America/Rio_Branco': 'BR',
  'America/Toronto': 'CA',
  'America/Montreal': 'CA',
  'America/Vancouver': 'CA',
  'America/Edmonton': 'CA',
  'America/Winnipeg': 'CA',
  'America/Regina': 'CA',
  'America/Halifax': 'CA',
  'America/St_Johns': 'CA',
  'America/Moncton': 'CA',
  'America/Whitehorse': 'CA',
  'America/Yellowknife': 'CA',
  'America/New_York': 'US',
  'America/Chicago': 'US',
  'America/Denver': 'US',
  'America/Phoenix': 'US',
  'America/Los_Angeles': 'US',
  'America/Anchorage': 'US',
  'America/Detroit': 'US',
  'America/Boise': 'US',
  'Pacific/Honolulu': 'US',
};

function currentTimeZone(): string | undefined {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    return undefined;
  }
}

/**
 * Best guess at the person's country for the Help screen: time zone first (a better
 * location signal than language, since many South Africans use en-US/en-GB browsers),
 * then the region in the browser's language tags, else South Africa.
 */
export function detectCountry(
  prefs: readonly string[] = typeof navigator !== 'undefined' ? navigator.languages ?? [] : [],
  timeZone: string | undefined = currentTimeZone(),
): string {
  if (timeZone) {
    const byTz = TZ_COUNTRY[timeZone] ?? (timeZone.startsWith('Australia/') ? 'AU' : undefined);
    if (byTz) return byTz;
  }
  for (const p of prefs) {
    const region = p.split('-')[1]?.toUpperCase();
    if (region && helpFor(region)) return region;
  }
  return DEFAULT_COUNTRY;
}
