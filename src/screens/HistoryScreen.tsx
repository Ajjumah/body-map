import { useMemo, useState } from 'react';
import { useT } from '../i18n';
import { applyFilters, type Filters as F } from '../lib/insights';
import { useStore } from '../store';
import { Segmented } from './BodyMapScreen';
import Filters from './Filters';
import Heatmap from './Heatmap';
import SessionView from './SessionView';
import Timeline from './Timeline';

type Tab = 'timeline' | 'heatmap';

export default function HistoryScreen({ route }: { route: string[] }) {
  const { sessions, entries } = useStore();
  const { t } = useT();
  const tab: Tab = route[1] === 'heatmap' ? 'heatmap' : 'timeline';
  const [filters, setFilters] = useState<F>({ range: 'all' });
  const filtered = useMemo(() => applyFilters(entries, filters), [entries, filters]);

  if (route[1] === 'session' && route[2]) return <SessionView sessionId={route[2]} />;
  return (
    <section aria-labelledby="history-title" className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="history-title" className="text-3xl text-ink">{t('history.title')}</h2>
        <Segmented<Tab>
          value={tab}
          onChange={(t) => (location.hash = t === 'heatmap' ? '#/history/heatmap' : '#/history')}
          label={t('history.view')}
          options={[['timeline', t('history.timeline')], ['heatmap', t('history.heatmap')]]}
        />
      </div>
      <Filters value={filters} onChange={setFilters} />
      {tab === 'timeline' ? <Timeline sessions={sessions} entries={filtered} /> : <Heatmap entries={filtered} />}
    </section>
  );
}
