"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { Suspense } from "react";

function TemplateContent({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  
  // Sử dụng key dựa trên toàn bộ URL để kích hoạt lại animation khi chuyển trang (pagination)
  return (
    <div 
      key={pathname + (searchParams?.toString() || "")} 
      className="animate-page-fade"
    >
      {children}
    </div>
  );
}

export default function Template({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<div className="opacity-0">{children}</div>}>
      <TemplateContent>{children}</TemplateContent>
    </Suspense>
  );
}
