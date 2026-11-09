import { vietnamOutline } from './vietnam-map-outline';

const cities = [
  { province: 'Hà Nội', label: 'Hà Nội', longitude: 105.8342, latitude: 21.0278 },
  { province: 'Đà Nẵng', label: 'Đà Nẵng', longitude: 108.2022, latitude: 16.0544 },
  { province: 'TP. Hồ Chí Minh', label: 'TP. HCM', longitude: 106.6297, latitude: 10.8231 },
];

// Reference points within each archipelago, not their geographic extent.
const archipelagos = [
  { name: 'Hoàng Sa', longitude: 111.602, latitude: 16.533, labelOffset: 17 },
  { name: 'Trường Sa', longitude: 114.318, latitude: 11.066, labelOffset: 17 },
];

function project(longitude: number, latitude: number) {
  return { x: (longitude - 101.5) * 18.8 + 7, y: (23.7 - latitude) * 19.6 + 8 };
}

export default function VietnamMap({ cityCount }: { cityCount?: (province: string) => string }) {
  return (
    <svg viewBox="0 0 265 323" role={cityCount ? 'group' : 'img'} aria-label="Bản đồ Việt Nam, có vị trí minh họa của Hoàng Sa và Trường Sa">
      <path d={vietnamOutline} fill="#549fdd" fillRule="evenodd" stroke="#f0f8ff" strokeWidth="0.85" strokeLinejoin="round" />
      <g fill="#244f79" fontSize="13" fontWeight="600">
        {archipelagos.map(({ name, longitude, latitude, labelOffset }) => {
          const { x, y } = project(longitude, latitude);
          return (
            <g key={name}>
              <circle cx={x} cy={y} r="3.5" fill="#edf7ff" stroke="#2d6da5" strokeWidth="1.4" />
              <text x={x} y={y + labelOffset} textAnchor={name === 'Trường Sa' ? 'end' : 'middle'}>{name}</text>
            </g>
          );
        })}
      </g>
      {cityCount && cities.map(({ province, label, longitude, latitude }) => {
        const { x, y } = project(longitude, latitude);
        const count = cityCount(province);
        const labelX = province === 'Đà Nẵng' ? x - 86 : x + 10;
        return (
          <a key={province} href={`/projects?province=${encodeURIComponent(province)}`} className="mk-map-city" aria-label={`${province}, ${count} dự án`}>
            <circle cx={x} cy={y} r="5.5" fill="#e96600" stroke="white" strokeWidth="2" />
            <rect x={labelX} y={y - 28} width="76" height="39" rx="6" fill="white" />
            <text x={labelX + 7} y={y - 12} fill="#173856" fontSize="12" fontWeight="700">{label}</text>
            <text x={labelX + 7} y={y + 3} fill="#466886" fontSize="11">{count} dự án</text>
          </a>
        );
      })}
    </svg>
  );
}
