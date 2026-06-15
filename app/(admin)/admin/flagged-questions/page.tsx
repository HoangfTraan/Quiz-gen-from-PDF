import { createClient } from "@/utils/supabase/server";
import SearchInput from "../questions/SearchInput";
import FlaggedQuestionTable from "./FlaggedQuestionTable";
import Pagination from "../questions/Pagination";

export default async function AdminFlaggedQuestionsPage(props: {
  searchParams: Promise<{ q?: string; page?: string }>;
}) {
  const searchParams = await props.searchParams;
  const query = searchParams.q;
  const page = parseInt(searchParams.page || "1");
  const pageSize = 10;
  
  const supabase = await createClient();
  
  // 1. Build Base Count Query
  let countQuery = supabase
    .from('questions')
    .select('*', { count: 'exact', head: true })
    .in('moderation_status', ['flagged', 'error']);
  
  // Apply filter to count if exists
  if (query) {
    countQuery = countQuery.ilike('question_text', `%${query}%`);
  }
  
  const { count: totalItems } = await countQuery;
  const totalPages = Math.ceil((totalItems || 0) / pageSize);

  // 2. Build Base Data Query
  let dbQuery = supabase
    .from('questions')
    .select(`
      *,
      quizzes (
        title,
        documents (
          title,
          users (
            full_name
          )
        )
      )
    `)
    .in('moderation_status', ['flagged', 'error']);

  // Apply Filter first
  if (query) {
    dbQuery = dbQuery.ilike('question_text', `%${query}%`);
  }

  // Apply Order second
  dbQuery = dbQuery.order('created_at', { ascending: false });

  // Apply Range (Pagination) last
  dbQuery = dbQuery.range((page - 1) * pageSize, page * pageSize - 1);

  const { data: questions } = await dbQuery;

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-extrabold text-gray-900">Câu hỏi bị lỗi / Kém chất lượng</h1>
      </div>
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="p-4 border-b border-gray-200">
          <SearchInput />
        </div>
        <div className="animate-page-fade" key={`${query}-${page}`}>
          <FlaggedQuestionTable questions={questions as any || []} />
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
