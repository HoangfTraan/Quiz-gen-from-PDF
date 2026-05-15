"use client";

import { useState, useRef, useEffect } from "react";
import { Edit2, Check, X } from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import { useRouter } from "next/navigation";

export default function QuizTitleEditor({
  quizId,
  initialTitle,
  canEdit = false,
}: {
  quizId: string;
  initialTitle: string;
  canEdit?: boolean;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [title, setTitle] = useState(initialTitle);
  const [isSaving, setIsSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isEditing]);

  // Real-time synchronization
  useEffect(() => {
    const channel = supabase
      .channel(`quiz_title_${quizId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "quizzes",
          filter: `id=eq.${quizId}`,
        },
        (payload) => {
          if (payload.new && payload.new.title) {
            setTitle(payload.new.title);
            router.refresh();
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [quizId, supabase, router]);

  const handleSave = async () => {
    if (!title.trim() || title === initialTitle) {
      setIsEditing(false);
      setTitle(initialTitle);
      return;
    }

    setIsSaving(true);
    const { error } = await supabase
      .from("quizzes")
      .update({ title: title.trim() })
      .eq("id", quizId);

    if (error) {
      alert("Lỗi khi cập nhật tên bộ đề");
      setTitle(initialTitle);
    }
    
    setIsSaving(false);
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleSave();
    } else if (e.key === "Escape") {
      setIsEditing(false);
      setTitle(initialTitle);
    }
  };

  if (isEditing) {
    return (
      <div className="flex items-center gap-2 w-full max-w-2xl">
        <input
          ref={inputRef}
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={isSaving}
          className="flex-1 text-2xl font-extrabold text-gray-800 bg-white border-2 border-blue-500 rounded-xl px-4 py-2 outline-none focus:ring-4 focus:ring-blue-100 transition-all shadow-sm"
          placeholder="Nhập tên bộ đề..."
        />
        <button
          onClick={handleSave}
          disabled={isSaving}
          className="p-2.5 bg-green-100 text-green-700 hover:bg-green-200 hover:text-green-800 rounded-xl transition-colors disabled:opacity-50"
          title="Lưu (Enter)"
        >
          <Check size={22} strokeWidth={2.5} />
        </button>
        <button
          onClick={() => {
            setIsEditing(false);
            setTitle(initialTitle);
          }}
          disabled={isSaving}
          className="p-2.5 bg-gray-100 text-gray-500 hover:bg-gray-200 hover:text-gray-700 rounded-xl transition-colors disabled:opacity-50"
          title="Hủy (Esc)"
        >
          <X size={22} strokeWidth={2.5} />
        </button>
      </div>
    );
  }

  return (
    <div className="group flex items-center gap-3">
      <h1 className="text-2xl font-extrabold text-gray-800 break-words">{title}</h1>
      {canEdit && (
        <button
          onClick={() => setIsEditing(true)}
          className="opacity-0 group-hover:opacity-100 p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
          title="Sửa tên bộ đề"
        >
          <Edit2 size={18} strokeWidth={2.5} />
        </button>
      )}
    </div>
  );
}
