'use client';
const steps = ['Thông tin cơ bản', 'Ảnh và tài liệu', 'Thông tin để bán', 'Giá bán', 'Kiểm tra và gửi'];

export default function ProjectEditorSteps({ step, onChange, disabled = false, saved }: {
  step: number; onChange: (step: number) => void; disabled?: boolean; saved: boolean;
}) {
  return <>
    <p className="project-editor-progress">Bước {step}/{steps.length} · {steps[step - 1]}</p>
    <nav className="p2-steps" aria-label="Các bước tạo dự án">
      {steps.map((label, index) => <button type="button" disabled={disabled || (!saved && index > 0)}
        key={label} aria-current={step === index + 1 ? 'step' : undefined} onClick={() => onChange(index + 1)}>
        <b>{index + 1}</b>{label}
      </button>)}
    </nav>
  </>;
}

