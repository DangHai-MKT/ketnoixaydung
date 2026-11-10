import { participantRoles, participantStatuses, type ProjectParticipant } from '../lib/projects/participants';

export default function ProjectParticipantCards({ participants }: { participants: ProjectParticipant[] }) {
  if (!participants.length) return null;
  return <section className="project-participants">
    <h3>Các bên tham gia dự án</h3>
    <div className="project-participant-grid">
      {participants.map((row, index) => <article className="project-participant-card" key={index}>
        <header><span>{participantRoles[row.role]}</span><h4>{row.name}</h4></header>
        <dl>
          {row.scope && <div><dt>Hạng mục</dt><dd>{row.scope}</dd></div>}
          {row.stage && <div><dt>Giai đoạn</dt><dd>{row.stage}</dd></div>}
          <div><dt>Tình trạng theo nguồn</dt><dd>{participantStatuses[row.status]}</dd></div>
          {row.source && <div><dt>Nguồn đối chiếu</dt><dd>{row.source}</dd></div>}
          {row.checkedOn && <div><dt>Ngày đối chiếu</dt><dd><time dateTime={row.checkedOn}>{row.checkedOn.split('-').reverse().join('/')}</time></dd></div>}
          {row.contact && <div><dt>Người liên hệ</dt><dd>{row.contact}</dd></div>}
          {row.address && <div><dt>Địa chỉ đơn vị</dt><dd>{row.address}</dd></div>}
          {row.phone && <div><dt>Điện thoại liên hệ</dt><dd>{row.phone}</dd></div>}
          {row.email && <div><dt>Email liên hệ</dt><dd>{row.email}</dd></div>}
        </dl>
      </article>)}
    </div>
  </section>;
}
