'use client';

import Script from 'next/script';
import { usePathname } from 'next/navigation';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { analyticsOrigin, analyticsPageLocation, analyticsReferrer } from '../lib/settings/analytics';

const preferenceKey = 'knxd.analytics-consent.v1';
type Preference = 'granted' | 'denied';
declare global {
  interface Window {
    dataLayer?: unknown[];
    [key: `ga-disable-${string}`]: boolean | undefined;
  }
}

function browserPreference(value: string | null): Preference | null {
  return value === 'granted' || value === 'denied' ? value : null;
}

export default function PublicAnalytics({ measurementId }: { measurementId: string }) {
  const pathname = usePathname();
  const pageLocation = analyticsPageLocation(pathname);
  const [preference, setPreference] = useState<Preference | null>();
  const [officialSite, setOfficialSite] = useState(false);
  const [editing, setEditing] = useState(false);
  const [ready, setReady] = useState(false);
  const lastPath = useRef('');
  const previousPage = useRef('');
  const configured = useRef(false);
  const disabledKey = `ga-disable-${measurementId}` as const;
  const active = officialSite && Boolean(pageLocation) && preference === 'granted';

  useEffect(() => {
    if (window.location.origin !== analyticsOrigin) return;
    setOfficialSite(true);
    try { setPreference(browserPreference(localStorage.getItem(preferenceKey))); }
    catch { setPreference(null); }
    function sync(event: StorageEvent) {
      if (event.key !== preferenceKey && event.key !== null) return;
      const next = browserPreference(event.newValue);
      if (next !== 'granted') window[disabledKey] = true;
      setPreference(next);
    }
    window.addEventListener('storage', sync);
    return () => window.removeEventListener('storage', sync);
  }, [disabledKey]);

  useLayoutEffect(() => {
    window[disabledKey] = !active;
    if (!active) lastPath.current = '';
    return () => { window[disabledKey] = true; };
  }, [active, disabledKey]);

  useEffect(() => {
    if (!active || !ready || !pageLocation || lastPath.current === pathname) return;
    if (window[disabledKey]) return;
    const queue = window.dataLayer ??= [];
    const command: (...args: unknown[]) => void = function () { queue.push(arguments); };
    const pageReferrer = previousPage.current || analyticsReferrer(document.referrer);
    const fields = { page_location: pageLocation, page_referrer: pageReferrer,
      page_title: pageLocation.slice(analyticsOrigin.length), ignore_referrer: !pageReferrer };
    if (!configured.current) {
      command('consent', 'default', {
        analytics_storage: 'granted', ad_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied',
      });
      command('js', new Date());
      command('config', measurementId, {
        ...fields, send_page_view: false, allow_google_signals: false, allow_ad_personalization_signals: false,
      });
      configured.current = true;
    }
    command('set', fields);
    command('event', 'page_view', { ...fields, send_to: measurementId });
    previousPage.current = pageLocation;
    lastPath.current = pathname;
  }, [active, ready, pageLocation, pathname, measurementId, disabledKey]);

  function choose(value: Preference) {
    if (value === 'denied') {
      window[disabledKey] = true;
      previousPage.current = '';
    }
    try { localStorage.setItem(preferenceKey, value); } catch { /* Use the choice for this page session. */ }
    setPreference(value);
    setEditing(false);
  }

  if (!officialSite || preference === undefined) return null;
  return <>
    {active && <Script id={`analytics-${measurementId}`} strategy="afterInteractive"
      src={`https://www.googletagmanager.com/gtag/js?id=${measurementId}`}
      referrerPolicy="no-referrer" onReady={() => setReady(true)} />}
    <button type="button" className="site-analytics-link" onClick={() => setEditing(true)}>Tùy chọn đo lường</button>
    {(editing || (pageLocation && preference === null)) && <section className="site-analytics-notice" aria-labelledby="analytics-choice">
      <h2 id="analytics-choice">Đo lường lượt truy cập</h2>
      <p>Nếu bạn đồng ý, Google Analytics sẽ dùng cookie để thống kê lượt xem các trang công khai được chọn. Bạn có thể đổi lựa chọn ở chân trang bất cứ lúc nào.</p>
      <div>
        <button type="button" onClick={() => choose('denied')}>Không đồng ý</button>
        <button type="button" onClick={() => choose('granted')}>Đồng ý đo lường</button>
      </div>
    </section>}
  </>;
}
