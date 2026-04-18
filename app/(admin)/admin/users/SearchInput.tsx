"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Search } from "lucide-react";
import { useTransition, useEffect, useState } from "react";

export default function SearchInput() {
  const { replace } = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [query, setQuery] = useState(searchParams.get("q")?.toString() || "");

  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      const params = new URLSearchParams(searchParams);
      if (query) {
        params.set("q", query);
      } else {
        params.delete("q");
      }
      startTransition(() => {
        replace(`${pathname}?${params.toString()}`);
      });
    }, 400);

    return () => clearTimeout(delayDebounceFn);
  }, [query, pathname, replace, searchParams]);

  return (
    <div className="relative max-w-sm">
      <Search
        className={`absolute left-3 top-1/2 -translate-y-1/2 transition-colors ${
          isPending ? "text-blue-500 animate-pulse" : "text-gray-400"
        }`}
        size={18}
      />
      <input
        type="text"
        placeholder="Tìm người dùng (Tên hoặc Email)..."
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        autoFocus={true}
        className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all"
      />
    </div>
  );
}
