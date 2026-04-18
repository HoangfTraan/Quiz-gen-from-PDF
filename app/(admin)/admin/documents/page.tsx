import { createClient } from "@/utils/supabase/server";
import SearchInput from "./SearchInput";
import DocumentTable from "./DocumentTable";
import Pagination from "./Pagination";

export default async function AdminDocumentsPage(props: {
  searchParams: Promise<{ q?: string; page?: string }>;
}) {
  const searchParams = await props.searchParams;
  const query = searchParams.q;
  const page = parseInt(searchParams.page || "1");
  const pageSize = 10;
  
  const supabase = await createClient();
  
  // Fetch total count for pagination
  let countQuery = supabase
    .from('documents')
    .select('*', { count: 'exact', head: true });
  
  if (query) {
    countQuery = countQuery.ilike('title', `%${query}%`);
  }
  
  const { count: totalItems } = await countQuery;
  const totalPages = Math.ceil((totalItems || 0) / pageSize);

  // Fetch paginated data
  let dbQuery = supabase
    .from('documents')
    .select(`
      *,
      users (
        email,
        full_name
      )
    `);
  
  if (query) {
    dbQuery = dbQuery.ilike('title', `%${query}%`);
  }

  dbQuery = dbQuery
    .order('created_at', { ascending: false })
    .range((page - 1) * pageSize, page * pageSize - 1);

  const { data: documents } = await dbQuery;

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-extrabold text-gray-900">Quản lý Tài liệu</h1>
      </div>
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="p-4 border-b border-gray-200">
          <SearchInput />
        </div>
        <div className="animate-page-fade" key={`${query}-${page}`}>
          <DocumentTable documents={documents as any || []} />
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
