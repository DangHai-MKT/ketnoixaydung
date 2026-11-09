import VietnamMap from './VietnamMap';
import Icon from './MarketplaceIcon';

export default function MarketplaceRegion({ total, provinces, unavailable }: { total: number; provinces: Record<string, number>; unavailable: boolean }) {
  const names = [...new Set(['Hà Nội', 'TP. Hồ Chí Minh', 'Đà Nẵng', 'Bình Dương', 'Đồng Nai', 'Bắc Ninh', ...Object.keys(provinces)])].slice(0, 8);
  const count = (name: string) => unavailable ? '—' : (provinces[name] ?? 0).toLocaleString('vi-VN');
  return <section className="mk-region"><div className="mk-region-heading"><Icon name="pin" size={26} /><div><h2>Tìm dự án theo khu vực</h2><p>Khám phá cơ hội tại các tỉnh thành trên toàn quốc</p></div></div>
    <div className="mk-region-body"><nav aria-label="Dự án theo tỉnh thành"><a className="mk-region-all" href="/projects"><span>Toàn quốc</span><strong>{unavailable ? '—' : total.toLocaleString('vi-VN')}</strong></a>{names.map(name => <a key={name} href={`/projects?province=${encodeURIComponent(name)}`}><span>{name === 'TP. Hồ Chí Minh' ? 'TP. HCM' : name}</span><span>{count(name)}</span></a>)}<a href="/projects">Khu vực khác <span>→</span></a></nav>
      <div className="mk-map"><VietnamMap cityCount={count} /><span className="mk-map-caption">Vị trí quần đảo minh họa</span></div></div>
  </section>;
}
