'use client';

import { useId, useRef, useState } from 'react';
import { normalizeProjectText } from '../lib/projects/overlap';

export default function ProjectWardPicker({ label, value, options, onChange }: {
  label: string; value: string; options: readonly string[]; onChange: (value: string) => void;
}) {
  const id = useId();
  const dropdown = useRef<HTMLDetailsElement>(null);
  const search = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState('');
  const savedOption = value && !options.includes(value) ? [value] : [];
  const words = normalizeProjectText(query).split(' ').filter(Boolean);
  const matches = [...savedOption, ...options].filter(name => {
    const text = normalizeProjectText(name);
    return words.every(word => text.includes(word));
  });
  function close() {
    if (!dropdown.current) return;
    dropdown.current.open = false;
    dropdown.current.querySelector('summary')?.focus();
    setQuery('');
  }
  if (!options.length && !value) return <label>{label}<input disabled placeholder="Chọn tỉnh / thành trước" /></label>;
  return <div className="project-ward-picker">
    <span id={id}>{label}</span>
    <details ref={dropdown} onToggle={event => {
      if (event.currentTarget.open) search.current?.focus();
      else setQuery('');
    }} onKeyDown={event => {
      if (event.key === 'Escape' && dropdown.current?.open) {
        event.preventDefault();
        close();
      }
    }}>
      <summary aria-labelledby={`${id} ${id}-value`}><span id={`${id}-value`}>{value || 'Chọn phường / xã / đặc khu'}</span></summary>
      <div className="project-ward-popup">
        <input ref={search} type="search" aria-label="Tìm phường / xã / đặc khu" placeholder="Gõ tên có dấu hoặc không dấu"
          value={query} onChange={event => setQuery(event.target.value)}
          onKeyDown={event => {
            if (event.key !== 'Enter') return;
            event.preventDefault();
            if (matches.length === 1) { onChange(matches[0]); close(); }
          }}/>
        <ul>
          {value && <li><button type="button" onClick={() => { onChange(''); close(); }}>Bỏ lựa chọn</button></li>}
          {matches.map(name => <li key={name}><button type="button" aria-pressed={name === value}
            onClick={() => { onChange(name); close(); }}>{name}{savedOption.includes(name) && ' (đã lưu)'}</button></li>)}
        </ul>
        {!matches.length && <p role="status">Không tìm thấy phường / xã phù hợp.</p>}
      </div>
    </details>
  </div>;
}
