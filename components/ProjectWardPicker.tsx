'use client';

import { useId, useRef, useState } from 'react';
import {canonicalWard,wardFilterAliases} from '../lib/projects/wards';
import { normalizeProjectText } from '../lib/projects/overlap';

export default function ProjectWardPicker({ label, value, options, onChange, province='' }: {
  label: string; value: string; province?:string; options: readonly string[]; onChange: (value: string) => void;
}) {
  const id = useId();
  const dropdown = useRef<HTMLDetailsElement>(null);
  const search = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState('');
  const selected=canonicalWard(province,value)||value;
  const savedOption = selected && !options.includes(selected) ? [selected] : [];
  const words = normalizeProjectText(query).split(' ').filter(Boolean);
  const matches = [...savedOption, ...options].filter(name => {
    const names=[name,...wardFilterAliases(province,name)];
    return names.some(candidate=>{const text=normalizeProjectText(candidate);return words.every(word=>text.includes(word));});
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
      <summary aria-labelledby={`${id} ${id}-value`}><span id={`${id}-value`}>{selected || 'Chọn phường / xã / đặc khu'}</span></summary>
      <div className="project-ward-popup">
        <input ref={search} type="search" aria-label="Tìm phường / xã / đặc khu" placeholder="Tìm tên mới hoặc tên cũ, có dấu hoặc không dấu"
          value={query} onChange={event => setQuery(event.target.value)}
          onKeyDown={event => {
            if (event.key !== 'Enter') return;
            event.preventDefault();
            if (matches.length === 1) { onChange(matches[0]); close(); }
          }}/>
        <ul>
          {value && <li><button type="button" onClick={() => { onChange(''); close(); }}>Bỏ lựa chọn</button></li>}
          {matches.map(name => <li key={name}><button type="button" aria-pressed={name === selected}
            onClick={() => { onChange(name); close(); }}>{name}{savedOption.includes(name) && ' (đã lưu)'}</button></li>)}
        </ul>
        {!matches.length && <p role="status">Không tìm thấy phường / xã phù hợp.</p>}
      </div>
    </details>
  </div>;
}
