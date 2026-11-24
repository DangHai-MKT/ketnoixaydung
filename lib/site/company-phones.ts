/** Keep identifiers as strings and never combine two separate phone numbers. */
export function companyPhones(value:string|undefined) {
  return [...new Set((value??'').split(/[;,/]/).map(s=>s.trim().replace(/\s+/g,' ')).filter(Boolean))];
}
export function validCompanyPhones(value:string) {
  const phones=companyPhones(value);
  return phones.length>0&&phones.length<=20&&phones.every(phone=>/^(?:\+?[0-9]|\([0-9])[0-9 .()-]{5,39}$/.test(phone)
    && phone.replace(/\D/g,'').length>=6&&phone.replace(/\D/g,'').length<=15);
}
