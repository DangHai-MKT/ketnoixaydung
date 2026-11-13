export type ChatSide = 'buyer' | 'seller';
export const chatPath = (side: ChatSide, id: string) =>
  side === 'buyer' ? `/account/purchases/${id}/chat` : `/seller/transactions/${id}/chat`;
export const chatMessageLimit = 2000;
