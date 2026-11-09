'use client';
export default function ProjectEditorSteps({step,onChange,disabled=false}:{step:number;onChange:(step:number)=>void;disabled?:boolean}){return <nav className="p2-steps" aria-label="Các bước tạo dự án">{['Thông tin chung','Ảnh và tệp','Nội dung bảo vệ','Giá POINT','Kiểm tra và gửi'].map((label,index)=><button type="button" disabled={disabled} key={label} aria-current={step===index+1?'step':undefined} onClick={()=>onChange(index+1)}><b>{index+1}</b>{label}</button>)}</nav>;}

