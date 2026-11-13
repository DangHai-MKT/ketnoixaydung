export default function ProjectContactActions({ phone, email }: { phone?: string; email?: string }) {
  const number = phone?.trim();
  const address = email?.trim();
  const tel = number && /^\+?[0-9 ().-]{8,40}$/.test(number) ? number.replace(/[^+0-9]/g, '') : null;
  const mail = address && /^[a-z0-9._+%-]+@[a-z0-9.-]+\.[a-z]{2,}$/i.test(address) ? address : null;
  if (!tel && !mail) return null;
  return <div className="fw-actions">
    {tel && <a className="dash-outline" href={'tel:' + tel}>Gọi</a>}
    {mail && <a className="dash-outline" href={'mailto:' + mail.replace(/[+%]/g, char => encodeURIComponent(char))}>Gửi email</a>}
  </div>;
}
