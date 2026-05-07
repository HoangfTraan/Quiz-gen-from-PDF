import { createClient } from "@/utils/supabase/server";
import SearchInput from "./SearchInput";
import UserTable from "./UserTable";
import Pagination from "./Pagination";
import type { AppRole } from "@/utils/rbac";

export default async function AdminUsersPage(props: {
  searchParams: Promise<{ q?: string; page?: string }>;
}) {
  const searchParams = await props.searchParams;
  const query = searchParams.q;
  const page = parseInt(searchParams.page || "1");
  const pageSize = 10;

  const supabase = await createClient();

  // 1. Count
  let countQuery = supabase
    .from("users")
    .select("*", { count: "exact", head: true });
  if (query) {
    countQuery = countQuery.or(
      `full_name.ilike.%${query}%,email.ilike.%${query}%`
    );
  }
  const { count: totalItems } = await countQuery;
  const totalPages = Math.ceil((totalItems || 0) / pageSize);

  // 2. Lấy danh sách users (query đơn giản, không join user_roles vì bảng có thể chưa tồn tại)
  let dbQuery = supabase
    .from("users")
    .select("id, full_name, email, role, avatar");
  if (query) {
    dbQuery = dbQuery.or(
      `full_name.ilike.%${query}%,email.ilike.%${query}%`
    );
  }
  const { data: rawUsers } = await dbQuery
    .order("created_at", { ascending: false })
    .range((page - 1) * pageSize, page * pageSize - 1);

  // 3. Thử lấy user_roles riêng (safe — nếu bảng chưa có thì bỏ qua)
  const userIds = (rawUsers || []).map((u: any) => u.id);
  let roleMap: Record<string, AppRole> = {};

  if (userIds.length > 0) {
    const { data: userRolesData } = await supabase
      .from("user_roles")
      .select("user_id, roles(name)")
      .in("user_id", userIds);

    if (userRolesData) {
      console.log("Admin Users Page - userRolesData:", userRolesData);
      for (const ur of userRolesData as any[]) {
        // Handle both single object and array return types from Supabase
        const roleObj = Array.isArray(ur.roles) ? ur.roles[0] : ur.roles;
        const roleName = roleObj?.name as string;
        if (!roleName) continue;
        // Ưu tiên teacher > learner
        if (roleName === "teacher") roleMap[ur.user_id] = "teacher";
        else if (roleName === "learner" && roleMap[ur.user_id] !== "teacher")
          roleMap[ur.user_id] = "learner";
      }
    } else {
      console.log("Admin Users Page - userRolesData is null/empty");
    }
  }

  // 4. Gắn app_role vào từng user
  const users = (rawUsers || []).map((u: any) => {
    let app_role: AppRole =
      u.role === "admin" ? "admin" : roleMap[u.id] ?? "user";
    return { ...u, app_role };
  });

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-extrabold text-gray-900">
          Quản lý Người dùng
        </h1>
      </div>
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="p-4 border-b border-gray-200">
          <SearchInput />
        </div>
        <div className="animate-page-fade" key={`${query}-${page}`}>
          <UserTable users={users} />
          <Pagination
            currentPage={page}
            totalPages={totalPages}
            totalItems={totalItems || 0}
          />
        </div>
      </div>
    </div>
  );
}
