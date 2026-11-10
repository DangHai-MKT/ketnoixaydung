'use client';

import {useEffect, useRef, useState} from 'react';
import type {PriceContext, PriceSuggestion} from '../lib/projects/price-learning';
import {formatPoints} from '../lib/projects/workflow';
import {suggestedProjectPrice} from '../lib/projects/quick-create';

export default function ProjectPriceSuggestion({context, disabled, onApply}: {
  context: PriceContext;
  disabled: boolean;
  onApply: (points: string) => void;
}) {
  const request = useRef<AbortController | null>(null);
  const [result, setResult] = useState<PriceSuggestion | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => () => request.current?.abort(), []);

  async function analyze() {
    if (request.current || disabled) return;
    const controller = new AbortController();
    request.current = controller;
    setPending(true);
    setError('');
    setResult(null);
    try {
      const response = await fetch('/api/seller/projects/price-suggestion', {
        method: 'POST', headers: {'Content-Type': 'application/json'},
        body: JSON.stringify(context), signal: controller.signal,
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || 'Chưa thể phân tích giá. Vui lòng thử lại.');
      if (!controller.signal.aborted) setResult(body);
    } catch (cause) {
      if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : 'Chưa thể phân tích giá.');
    } finally {
      request.current = null;
      if (!controller.signal.aborted) setPending(false);
    }
  }

  return <div className="p2-quick-panel">
    <p><strong>Giá gợi ý: {formatPoints(suggestedProjectPrice)} POINT</strong> cho tin mới. Bạn có thể chỉnh giá trước khi gửi duyệt.</p>
    <div className="p2-quick-heading">
      <div><h3>Tham khảo thêm từ giao dịch</h3><p>Dựa trên giá mua thông tin đã hoàn tất. Bạn quyết định giá cuối cùng.</p></div>
      <button type="button" className="button button-secondary" disabled={pending || disabled} onClick={analyze}>
        {pending ? 'Đang phân tích…' : 'Phân tích giá'}
      </button>
    </div>
    {error && <p className="auth-error" role="alert">{error}</p>}
    <div aria-live="polite" aria-busy={pending}>
      {result && <p>{result.message}</p>}
      {result?.suggestedPoints && result.lowerPoints && result.upperPoints &&
        <div className="p2-quick-heading">
          <div>
            <p>{result.method === 'learned' ? 'AI học từ giao dịch' : 'Tham chiếu cùng danh mục'}</p>
            <strong>{formatPoints(result.suggestedPoints)} POINT</strong>
            <p>Khoảng tham khảo {formatPoints(result.lowerPoints)}–{formatPoints(result.upperPoints)} POINT · {result.sampleCount} dự án</p>
          </div>
          <button type="button" className="button button-primary" disabled={disabled} onClick={() => onApply(result.suggestedPoints!)}>
            Dùng giá này
          </button>
        </div>}
    </div>
  </div>;
}
