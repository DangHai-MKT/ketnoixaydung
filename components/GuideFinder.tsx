'use client';

import {useState} from 'react';
import {guideRoles,guideTopicHref,guideTopics} from '../lib/site/guide-topics';

const normalize=(value:string)=>value.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replaceAll('đ','d');

export default function GuideFinder() {
  const [query,setQuery]=useState('');
  const terms=normalize(query.trim()).split(/\s+/).filter(Boolean);
  const results=guideTopics.filter(topic=>{
    const text=normalize([topic.title,topic.description,topic.keywords,guideRoles[topic.role]].join(' '));
    return terms.every(term=>text.includes(term));
  });
  return <section className="guide-finder" aria-labelledby="guide-finder-title" id="tra-cuu">
    <div className="guide-section-heading"><span className="guide-kicker">Tra cứu nhanh</span>
      <h2 id="guide-finder-title">Bạn muốn làm gì?</h2></div>
    <label className="guide-search">Tìm chủ đề hướng dẫn
      <input type="search" value={query} onChange={event=>setQuery(event.target.value)} maxLength={100}
        placeholder="Ví dụ: nạp điểm, đăng tin, xác minh…"/>
    </label>
    {terms.length>0&&<p className="guide-result-count" role="status">{results.length} chủ đề phù hợp</p>}
    {results.length?<ul className="guide-topic-list">{results.map(topic=><li key={topic.role+topic.step}>
      <a href={guideTopicHref(topic)}><span className="guide-topic-copy"><small>{guideRoles[topic.role]}</small>
        <strong>{topic.title}</strong><span>{topic.description}</span></span><span aria-hidden="true">→</span></a>
    </li>)}</ul>:<div className="guide-no-results"><p>Thử từ khóa ngắn hơn hoặc xem toàn bộ chủ đề.</p>
      <button className="button button-secondary" type="button" onClick={()=>setQuery('')}>Xóa tìm kiếm</button></div>}
  </section>;
}
