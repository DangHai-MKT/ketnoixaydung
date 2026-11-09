'use client';
import { useState } from 'react';
import { shiftReportDay } from '../lib/dashboard/admin-report';
export default function AdminReportFilters({ start: initialStart, end: initialEnd, range: initialRange, interval, q, today }: { start: string; end: string; range: string; interval: string; q: string; today: string }) {
  const [start, setStart] = useState(initialStart), [end, setEnd] = useState(initialEnd), [range, setRange] = useState(initialRange);
  function preset(value: string) {
    setRange(value);
    if (value !== 'custom') { setStart(shiftReportDay(today, 1 - Number(value))); setEnd(today); }
  }
  return <form className="ar-filters" action="/admin" method="get"><div className="ar-date-fields"><label><span>Từ ngày</span><input type="date" name="start" value={start} max={today} onChange={event => { setStart(event.target.value); setRange('custom'); }} required /></label><b>–</b><label><span>Đến ngày</span><input type="date" name="end" value={end} min={start} max={today} onChange={event => { setEnd(event.target.value); setRange('custom'); }} required /></label></div><label><span>Khoảng thời gian</span><select name="range" value={range} onChange={event => preset(event.target.value)}><option value="7">7 ngày gần đây</option><option value="30">30 ngày gần đây</option><option value="90">90 ngày gần đây</option><option value="custom">Tùy chọn</option></select></label><label><span>Nhóm thời gian</span><select name="interval" defaultValue={interval}><option value="day">Theo ngày</option><option value="week">Theo tuần</option></select></label>{q && <input type="hidden" name="q" value={q} />}<button type="submit">Áp dụng</button></form>;
}
