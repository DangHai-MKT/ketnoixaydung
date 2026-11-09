export type OverlapFinding = 'likely_duplicate' | 'review_scope' | 'related_package';

export type ListingEvidence = {
  title: string;
  provinceCode: string | null;
  districtName: string | null;
  projectStage: string | null;
  publicSummary: string;
  privateData: Record<string, unknown>;
  checksums: string[];
};

export function normalizeProjectText(value: unknown) {
  return typeof value === 'string'
    ? value.toLowerCase().replace(/đ/g, 'd').normalize('NFD').replace(/\p{M}/gu, '').replace(/[^a-z0-9]+/g, ' ').trim()
    : '';
}

function similarity(left: string, right: string) {
  const tokens = (value: string) => new Set(value.split(' ').filter(word => word.length > 1));
  const a = tokens(left), b = tokens(right);
  const shared = [...a].filter(word => b.has(word)).length;
  return shared / (a.size + b.size - shared || 1);
}

export function compareListingEvidence(a: ListingEvidence, b: ListingEvidence) {
  const field = (listing: ListingEvidence, key: string) => normalizeProjectText(listing.privateData[key]);
  const equal = (left: string, right: string) => Boolean(left && right && left === right);
  const titleA = normalizeProjectText(a.title), titleB = normalizeProjectText(b.title);
  const sameTitle = equal(titleA, titleB);
  const sameProvince = equal(normalizeProjectText(provinceLabel(a.provinceCode ?? '')), normalizeProjectText(provinceLabel(b.provinceCode ?? '')));
  const districtA = normalizeProjectText(a.districtName), districtB = normalizeProjectText(b.districtName);
  const sameInvestor = equal(field(a, 'investorName'), field(b, 'investorName'));
  const sameCode = equal(field(a, 'projectReference'), field(b, 'projectReference'));
  const sameAddress = equal(field(a, 'exactLocation'), field(b, 'exactLocation'));
  const titleSimilarity = similarity(titleA, titleB);
  const similarTitle = (sameInvestor && titleSimilarity >= 0.55)
    || (equal(districtA, districtB) && titleSimilarity >= 0.75);
  const related = sameCode || (sameProvince && (sameAddress || (
    (!districtA || !districtB || districtA === districtB || sameInvestor)
    && (sameTitle || similarTitle)
  )));
  const sharedFiles = new Set(a.checksums.filter(hash => b.checksums.includes(hash))).size;
  if (!related && !sharedFiles) return null;

  const stageA = normalizeProjectText(a.projectStage), stageB = normalizeProjectText(b.projectStage);
  const scopeA = field(a, 'packageScope'), scopeB = field(b, 'packageScope');
  const differentScope = Boolean((stageA && stageB && stageA !== stageB)
    || (scopeA && scopeB && similarity(scopeA, scopeB) < 0.5));
  const sameScope = equal(stageA, stageB) && equal(scopeA, scopeB);
  const similarDescription = similarity(normalizeProjectText(a.publicSummary), normalizeProjectText(b.publicSummary)) >= 0.8;
  const similarProtectedNotes = ['procurementNotes', 'technicalNotes'].some(key => {
    const left = field(a, key), right = field(b, key);
    return left.length >= 30 && right.length >= 30 && similarity(left, right) >= 0.85;
  });
  const changedFiles = a.checksums.length > 0 && b.checksums.length > 0
    && (a.checksums.some(hash => !b.checksums.includes(hash)) || b.checksums.some(hash => !a.checksums.includes(hash)));
  const finding: OverlapFinding = related && differentScope && !sharedFiles ? 'related_package'
    : related && !differentScope && !changedFiles
      && ((sharedFiles > 0 && (sameScope || similarDescription)) || (sameScope && (similarDescription || similarProtectedNotes)))
      ? 'likely_duplicate' : 'review_scope';
  const signals = [
    ...(sameCode ? ['Cùng mã công trình khai báo'] : []),
    ...(sameProvince && sameTitle ? ['Tên công trình và tỉnh/thành trùng'] : []),
    ...(sameProvince && !sameTitle && similarTitle ? ['Tên công trình tương đồng trong cùng tỉnh/thành'] : []),
    ...(sameProvince && sameAddress ? ['Vị trí được bảo vệ trùng'] : []),
    ...(sameProvince && sameInvestor ? ['Chủ đầu tư và tỉnh/thành trùng'] : []),
    ...(differentScope ? ['Giai đoạn hoặc phạm vi khai báo khác nhau'] : []),
    ...(similarDescription ? ['Mô tả công khai tương đồng cao'] : []),
    ...(similarProtectedNotes ? ['Ghi chú bảo vệ tương đồng cao'] : []),
    ...(sharedFiles ? [`${sharedFiles} tệp bán kèm có nội dung nhị phân giống hệt`] : []),
    ...(changedFiles ? ['Danh sách tệp bán kèm có khác biệt'] : []),
  ];
  return { finding, signals };
}
import { provinceLabel } from './locations';

