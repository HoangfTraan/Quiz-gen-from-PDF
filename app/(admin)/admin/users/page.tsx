import { createClient } from "@/utils/supabase/server";
import SearchInput from "./SearchInput";
import UserTable from "./UserTable";
import Pagination from "./Pagination";

export default async function AdminUsersPage(props: {
  searchParams: Promise<{ q?: string; page?: string }>;
}) {
  const searchParams = await props.searchParams;
  const query = searchParams.q;
  const page = parseInt(searchParams.page || "1");
  const pageSize = 10;
  
  const supabase = await createClient();
  
  // 1. Build Base Count Query
  let countQuery = supabase
    .from('users')
    .select('*', { count: 'exact', head: true });
  
  if (query) {
    countQuery = countQuery.or(`full_name.ilike.%${query}%,email.ilike.%${query}%`);
  }
  
  const { count: totalItems } = await countQuery;
  const totalPages = Math.ceil((totalItems || 0) / pageSize);

  // 2. Build Base Data Query
  let dbQuery = supabase.from('users').select('*');
  
  if (query) {
    dbQuery = dbQuery.or(`full_name.ilike.%${query}%,email.ilike.%${query}%`);
  }

  const { data: users } = await dbQuery
    .order('created_at', { ascending: false })
    .range((page - 1) * pageSize, page * pageSize - 1);

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-extrabold text-gray-900">Quản lý Người dùng</h1>
      </div>
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="p-4 border-b border-gray-200">
          <SearchInput />
        </div>
        <div className="animate-page-fade" key={`${query}-${page}`}>
          <UserTable users={users || []} />
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
