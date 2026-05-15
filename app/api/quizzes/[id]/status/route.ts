import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { getUserRole } from "@/utils/rbac-server";
import { canAuthorQuiz } from "@/utils/rbac";

/**
 * POST /api/quizzes/[id]/status
 * Body: { status: "draft" | "published" }
 *
 * Chỉ teacher sở hữu quiz mới được thay đổi trạng thái.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();

  // 1. Kiểm tra đăng nhập
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json(
      { error: "Chưa đăng nhập" },
      { status: 401 }
    );
  }

  // 2. Kiểm tra role — chỉ teacher
  const role = await getUserRole(user.id);
  if (!canAuthorQuiz(role)) {
    return NextResponse.json(
      { error: "Bạn không có quyền thực hiện thao tác này" },
      { status: 403 }
    );
  }

  // 3. Parse body
  let body: { status?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Body không hợp lệ" },
      { status: 400 }
    );
  }

  const newStatus = body.status;
  if (newStatus !== "draft" && newStatus !== "published") {
    return NextResponse.json(
      { error: "Trạng thái phải là 'draft' hoặc 'published'" },
      { status: 400 }
    );
  }

  // 4. Kiểm tra quyền sở hữu quiz
  const { data: quiz, error: quizError } = await supabase
    .from("quizzes")
    .select("id, user_id, status")
    .eq("id", id)
    .single();

  if (quizError || !quiz) {
    return NextResponse.json(
      { error: "Không tìm thấy bộ đề" },
      { status: 404 }
    );
  }

  if (quiz.user_id !== user.id) {
    return NextResponse.json(
      { error: "Bạn không phải chủ sở hữu bộ đề này" },
      { status: 403 }
    );
  }

  // 5. Nếu đang xuất bản, kiểm tra bộ đề phải có câu hỏi
  if (newStatus === "published") {
    const { count } = await supabase
      .from("questions")
      .select("*", { count: "exact", head: true })
      .eq("quiz_id", id);

    if (!count || count === 0) {
      return NextResponse.json(
        { error: "Không thể xuất bản bộ đề chưa có câu hỏi" },
        { status: 400 }
      );
    }
  }

  // 6. Cập nhật trạng thái
  const { error: updateError } = await supabase
    .from("quizzes")
    .update({ status: newStatus })
    .eq("id", id);

  if (updateError) {
    return NextResponse.json(
      { error: "Không thể cập nhật trạng thái: " + updateError.message },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true, id, status: newStatus });
}
