import type {Role} from '../auth/permissions';

// Navigation only; destination pages still enforce authentication and seller verification.
export function sellerEntryDestination(roles:readonly Role[],profile:{verificationStatus:string;correctionRequestedAt:Date|string|null}|null) {
  if(!profile)return '/seller/register';
  if(profile.verificationStatus==='verified'&&roles.includes('seller'))return '/account#ban-thong-tin';
  if(profile.verificationStatus==='unverified'||profile.verificationStatus==='rejected')return '/seller/register';
  return '/seller/application';
}
