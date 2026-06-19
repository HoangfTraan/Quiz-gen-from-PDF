import { Activity } from "lucide-react";
import { createClient } from "@/utils/supabase/server";
import TokenDashboardClient from "./TokenDashboardClient";

export default async function AdminAiJobsPage() {
  const supabase = await createClient();
  
  const { data: jobs } = await supabase
    .from('ai_jobs')
    .select('*, documents(title)')
    .order('started_at', { ascending: false });

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex justify-between items-center mb-2">
        <div>
          <h1 className="text-2xl font-extrabold text-gray-900 flex items-center gap-2">
            <Activity className="text-blue-600" /> Giám sát AI & Token Usage
          </h1>
          <p className="text-sm text-gray-500 mt-1 font-medium">Theo dõi hoạt động của mô hình AI, đo lường chi phí token theo thời gian thực.</p>
        </div>
      </div>

      <TokenDashboardClient initialJobs={jobs || []} />
    </div>
  );
}
