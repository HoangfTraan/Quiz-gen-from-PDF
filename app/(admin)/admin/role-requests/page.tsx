import { createClient } from "@/utils/supabase/server";
import RoleRequestTable from "./RoleRequestTable";

export default async function RoleRequestsPage(props: {
  searchParams: Promise<{ page?: string }>;
}) {
  const searchParams = await props.searchParams;
  const page = parseInt(searchParams.page || "1");
  const pageSize = 10;
  
  const supabase = await createClient();

  // 1. Fetch pending role requests
  const { data: requests, count: totalItems } = await supabase
    .from("role_requests")
    .select(`
      id,
      requested_role,
      status,
      created_at,
      user_id,
      users:user_id (id, full_name, email, avatar)
    `, { count: 'exact' })
    .eq('status', 'pending')
    .order("created_at", { ascending: false })
    .range((page - 1) * pageSize, page * pageSize - 1);

  const totalPages = Math.ceil((totalItems || 0) / pageSize);

  // Parse nested user data correctly
  const formattedRequests = (requests || []).map((req: any) => ({
    ...req,
    user: Array.isArray(req.users) ? req.users[0] : req.users
  }));

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-extrabold text-gray-900">
          Yêu cầu cấp quyền
        </h1>
      </div>
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="animate-page-fade">
          <RoleRequestTable requests={formattedRequests} />
          {/* We can reuse Pagination component from users folder if needed, but for simplicity we'll just show the table first */}
          {formattedRequests.length === 0 && (
             <div className="p-10 text-center text-gray-500 font-medium">
               Không có yêu cầu cấp quyền nào đang chờ duyệt.
             </div>
          )}
        </div>
      </div>
    </div>
  );
}
