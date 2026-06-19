"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/utils/supabase/client";
import { Activity, Zap, Server, BrainCircuit, Save } from "lucide-react";
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, AreaChart, Area
} from "recharts";
import JobTable from "./JobTable";

export default function TokenDashboardClient({ initialJobs }: { initialJobs: any[] }) {
  const [jobs, setJobs] = useState<any[]>(initialJobs);
  const supabase = createClient();

  useEffect(() => {
    const channel = supabase.channel('realtime_ai_jobs')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'ai_jobs'
      }, (payload) => {
        setJobs((currentJobs) => {
          // Add new job at the beginning
          return [payload.new, ...currentJobs];
        });
      })
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'ai_jobs'
      }, (payload) => {
        setJobs((currentJobs) => {
          return currentJobs.map(job => job.id === payload.new.id ? payload.new : job);
        });
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase]);

  // Tính toán metrics
  const totalJobs = jobs.length;
  const totalTokens = jobs.reduce((acc, job) => acc + (job.total_tokens || 0), 0);
  const promptTokens = jobs.reduce((acc, job) => acc + (job.prompt_tokens || 0), 0);
  const completionTokens = jobs.reduce((acc, job) => acc + (job.completion_tokens || 0), 0);
  const cachedTokens = jobs.reduce((acc, job) => {
    // Nếu trong Database có ghi nhận cached_tokens > 0, ta lấy thẳng
    if (job.cached_tokens && job.cached_tokens > 0) {
      return acc + job.cached_tokens;
    }
    // Nếu trong DB đang là 0 (do các jobs cũ hoặc giá trị mặc định), ta tính toán bù trừ
    const calc = (job.total_tokens || 0) - ((job.prompt_tokens || 0) + (job.completion_tokens || 0));
    return acc + (calc > 0 ? calc : 0);
  }, 0);

  // Chuẩn bị data cho biểu đồ (nhóm theo ngày hoặc 10 jobs gần nhất)
  // Để real-time nhìn thấy sự thay đổi rõ ràng, ta lấy 15 jobs gần nhất (đã sort giảm dần theo time, nên ta reverse lại để biểu đồ đi từ trái sang phải)
  const recentJobsForChart = [...jobs].slice(0, 15).reverse().map((job, index) => {
    return {
      name: `Job ${job.id.substring(0, 4)}`,
      prompt: job.prompt_tokens || 0,
      completion: job.completion_tokens || 0,
      total: job.total_tokens || 0,
      type: job.job_type,
      time: new Date(job.started_at).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
    };
  });

  return (
    <div className="space-y-6">
      {/* Metrics Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex flex-col justify-center gap-3">
          <div className="p-2.5 bg-blue-50 text-blue-600 rounded-xl w-max">
            <Activity size={20} />
          </div>
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Tổng số tác vụ</p>
            <h3 className="text-xl font-black text-gray-900">{totalJobs}</h3>
          </div>
        </div>
        
        <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex flex-col justify-center gap-3">
          <div className="p-2.5 bg-purple-50 text-purple-600 rounded-xl w-max">
            <BrainCircuit size={20} />
          </div>
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Tổng Tokens</p>
            <h3 className="text-xl font-black text-gray-900">{totalTokens.toLocaleString('vi-VN')}</h3>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex flex-col justify-center gap-3">
          <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-xl w-max">
            <Server size={20} />
          </div>
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Prompt (Input)</p>
            <h3 className="text-xl font-black text-gray-900">{promptTokens.toLocaleString('vi-VN')}</h3>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex flex-col justify-center gap-3">
          <div className="p-2.5 bg-orange-50 text-orange-600 rounded-xl w-max">
            <Zap size={20} />
          </div>
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Completion</p>
            <h3 className="text-xl font-black text-gray-900">{completionTokens.toLocaleString('vi-VN')}</h3>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-green-100 shadow-sm flex flex-col justify-center gap-3 bg-green-50/30">
          <div className="p-2.5 bg-green-100 text-green-700 rounded-xl w-max">
            <Save size={20} />
          </div>
          <div>
            <p className="text-xs font-bold text-green-600/80 uppercase tracking-wider">Cached (Tiết kiệm)</p>
            <h3 className="text-xl font-black text-green-700">{cachedTokens.toLocaleString('vi-VN')}</h3>
          </div>
        </div>
      </div>

      {/* Chart Section */}
      <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
        <h2 className="text-lg font-bold text-gray-900 mb-6 flex items-center gap-2">
          Biểu đồ Token Usage (15 tác vụ gần nhất)
        </h2>
        <div className="h-80 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={recentJobsForChart}
              margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
              <XAxis dataKey="time" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#6B7280' }} dy={10} />
              <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#6B7280' }} dx={-10} />
              <Tooltip 
                cursor={{ fill: '#F3F4F6' }}
                contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}
              />
              <Legend wrapperStyle={{ paddingTop: '20px' }} />
              <Bar dataKey="prompt" name="Prompt Tokens" stackId="a" fill="#6366F1" radius={[0, 0, 4, 4]} />
              <Bar dataKey="completion" name="Completion Tokens" stackId="a" fill="#F59E0B" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Table Section */}
      <div>
        <h2 className="text-lg font-bold text-gray-900 mb-4 ml-1">Lịch sử tác vụ (Real-time)</h2>
        <JobTable initialJobs={jobs} />
      </div>
    </div>
  );
}
