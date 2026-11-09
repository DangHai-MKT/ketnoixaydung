export const transactionLabels: Record<string, string> = {
  project_purchase: 'Mua thông tin dự án', project_watch_subscription: 'Phí theo dõi lĩnh vực', topup: 'Nạp điểm', point_topup: 'Nạp điểm',
  payment_topup: 'Nạp điểm', reversal: 'Bút toán đảo', seller_earning_release: 'Giải phóng khoản giữ',
  earning_release: 'Giải phóng khoản giữ', refund: 'Hoàn điểm', withdrawal_reserve:'Giữ chỗ chi trả', withdrawal_payout:'Chi trả thu nhập',
};
export const statusLabels: Record<string, string> = { pending: 'Chờ ghi sổ', posted: 'Đã ghi sổ', failed: 'Thất bại', reversed: 'Đã đảo (trạng thái cũ)' };
export function transactionLabel(type: string) { return transactionLabels[type] ?? 'Giao dịch khác'; }
export function pointText(value: string) { return `${BigInt(value).toLocaleString('vi-VN')} POINT`; }
export function changeText(value: string) { return `${BigInt(value) > 0n ? '+' : ''}${pointText(value)}`; }
export function directionLabel(available: string, held: string, reserved = '0') {
  const a = BigInt(available), h = BigInt(held), total = a + h + BigInt(reserved);
  return total === 0n ? BigInt(reserved) ? 'Chuyển giữa khả dụng và giữ chỗ chi trả' : a || h ? 'Chuyển giữa khoản khả dụng và đang giữ' : 'Không đổi tổng điểm' : total > 0n ? 'Điểm vào' : 'Điểm ra';
}
