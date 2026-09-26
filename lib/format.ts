import { daysBetween, todayISO } from './dates';
import { tf, t } from '../localization';

type Language = 'en' | 'zh';

const WEEKDAYS = { zh: ['日', '一', '二', '三', '四', '五', '六'], en: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] };

/** '2026-09-29' -> '9/29 (二)' / 'Tue 9/29'; adds the year only when it differs from this year. */
export const formatDate = (iso: string, lang: Language) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return iso;
  const [y, m, d] = iso.split('-').map(Number);
  const wd = WEEKDAYS[lang][new Date(y, m - 1, d).getDay()];
  const md = `${m}/${d}`;
  const withYear = y === new Date().getFullYear() ? md : `${y}/${md}`;
  return lang === 'zh' ? `${withYear} (${wd})` : `${wd} ${withYear}`;
};

/** Human relative day: Today / Tomorrow / in 3 days / 5 days ago. */
export const relativeDay = (iso: string, lang: Language, today = todayISO()) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return '';
  const diff = daysBetween(today, iso);
  if (diff === 0) return t('dates.today', lang);
  if (diff === 1) return t('dates.tomorrow', lang);
  if (diff === -1) return t('dates.yesterday', lang);
  return diff > 0 ? tf('dates.inDays', lang, { n: diff }) : tf('dates.daysAgo', lang, { n: -diff });
};

/** '9/29 (二) · 3 天後' */
export const friendlyDate = (iso: string, lang: Language) => `${formatDate(iso, lang)} · ${relativeDay(iso, lang)}`;
