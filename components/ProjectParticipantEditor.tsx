'use client';

import { maxProjectParticipants, participantLimits, participantRoles, participantStatuses, type ProjectParticipant } from '../lib/projects/participants';

const blank: ProjectParticipant = { name:'', role:'unknown', scope:'', stage:'', status:'unverified', source:'', checkedOn:'', contact:'' };
const fields = [
  ['scope', 'Hạng mục phụ trách'], ['stage', 'Giai đoạn phụ trách'],
  ['source', 'Nguồn đối chiếu'], ['checkedOn', 'Ngày đối chiếu'], ['contact', 'Đầu mối công việc'],
] as const;

export default function ProjectParticipantEditor({ rows, onChange }: { rows: ProjectParticipant[]; onChange: (rows: ProjectParticipant[]) => void }) {
  function update<K extends keyof ProjectParticipant>(index: number, field: K, value: ProjectParticipant[K]) {
    onChange(rows.map((row, i) => i === index ? { ...row, [field]: value } : row));
  }
  return <section className="project-participants">
    <h3>Các bên tham gia dự án</h3>
    <p className="p2-note">Thêm từng đơn vị theo đúng vai trò và hạng mục trong hồ sơ nguồn. Chỉ nhập đầu mối công việc bạn có quyền cung cấp.</p>
    {rows.map((row, index) => <fieldset key={index} className="project-participant-card">
      <legend>Đơn vị {index + 1}</legend>
      <div className="project-form-grid">
        <label>Tên đơn vị<input required value={row.name} maxLength={participantLimits.name} onChange={event=>update(index,'name',event.target.value)}/></label>
        <label>Vai trò<select value={row.role} onChange={event=>update(index,'role',event.target.value as ProjectParticipant['role'])}>
          {Object.entries(participantRoles).map(([key,label])=><option key={key} value={key}>{label}</option>)}
        </select></label>
        <label>Tình trạng theo nguồn<select value={row.status} onChange={event=>update(index,'status',event.target.value as ProjectParticipant['status'])}>
          {Object.entries(participantStatuses).map(([key,label])=><option key={key} value={key}>{label}</option>)}
        </select></label>
        {fields.map(([key,label])=><label key={key}>{label}<input type={key==='checkedOn'?'date':'text'}
          required={row.status==='announced'&&(key==='source'||key==='checkedOn')} value={row[key]} maxLength={participantLimits[key]}
          onChange={event=>update(index,key,event.target.value)}/></label>)}
      </div>
      <button type="button" className="button button-secondary" onClick={()=>onChange(rows.filter((_,i)=>i!==index))}>Gỡ đơn vị {index + 1}</button>
    </fieldset>)}
    <button type="button" className="button button-secondary" disabled={rows.length>=maxProjectParticipants}
      onClick={()=>onChange([...rows,{...blank}])}>＋ Thêm đơn vị tham gia</button>
  </section>;
}
