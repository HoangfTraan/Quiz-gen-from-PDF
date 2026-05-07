// ─── Pure helpers — safe to import in both Client and Server Components ───

export type AppRole = "admin" | "teacher" | "learner" | "user";

/** Giáo viên và admin có thể xem, kiểm duyệt, sửa bộ đề */
export function canManageQuiz(role: AppRole): boolean {
  return role === "admin" || role === "teacher";
}

/** Chỉ learner mới được làm bài */
export function canTakeQuiz(role: AppRole): boolean {
  return role === "learner";
}

/** Chỉ learner mới xem lịch sử và điểm số */
export function canViewScores(role: AppRole): boolean {
  return role === "learner";
}

/** Nhãn hiển thị cho từng role */
export function getRoleLabel(role: AppRole): string {
  const labels: Record<AppRole, string> = {
    admin: "Admin",
    teacher: "Giáo viên",
    learner: "Người học",
    user: "Người dùng",
  };
  return labels[role];
}

/** Màu badge cho từng role */
export function getRoleBadgeClass(role: AppRole): string {
  const classes: Record<AppRole, string> = {
    admin: "bg-purple-100 text-purple-700 border-purple-200",
    teacher: "bg-teal-100 text-teal-700 border-teal-200",
    learner: "bg-blue-100 text-blue-700 border-blue-200",
    user: "bg-gray-100 text-gray-600 border-gray-200",
  };
  return classes[role];
}
