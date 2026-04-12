import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50 py-12 sm:px-6 lg:px-8 relative animate-fade-in-blur">
      <Link 
        href="/" 
        className="absolute top-4 left-4 md:top-8 md:left-8 flex items-center gap-2 text-gray-600 hover:text-blue-600 transition-colors font-semibold bg-white px-4 py-2.5 rounded-xl shadow-sm border border-gray-200 hover:shadow-md"
      >
         <ArrowLeft size={20} /> Trang chủ
      </Link>
      
      <div className="mb-6 w-full max-w-md text-center">
         <h1 className="text-4xl font-black text-blue-700 tracking-tight">QuizGen</h1>
      </div>

      {children}
    </div>
  )
}
