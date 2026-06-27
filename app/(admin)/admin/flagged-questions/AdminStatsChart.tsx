"use client";

import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from "recharts";

interface AdminStatsChartProps {
  goodCount: number;
  errorCount: number;
}

export default function AdminStatsChart({ goodCount, errorCount }: AdminStatsChartProps) {
  const data = [
    { name: "Câu hỏi Tốt", value: goodCount, color: "#10B981" }, // emerald-500
    { name: "Câu hỏi Lỗi", value: errorCount, color: "#EF4444" }, // red-500
  ];

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white p-3 rounded-xl shadow-lg border border-gray-100">
          <p className="font-bold text-gray-800 mb-1">{payload[0].name}</p>
          <p className="text-sm font-medium" style={{ color: payload[0].payload.color }}>
            Số lượng: {payload[0].value} câu
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 flex flex-col md:flex-row items-center justify-around gap-8">
      <div className="flex-1 w-full text-center md:text-left">
        <h3 className="text-xl font-extrabold text-gray-900 mb-2">Biểu đồ Phân bổ Chất lượng AI</h3>
        <p className="text-gray-500 text-sm mb-6 leading-relaxed">
          Biểu đồ hiển thị tỷ lệ trực quan giữa số lượng câu hỏi đạt chuẩn và các câu hỏi đã được ghi nhận có lỗi.
        </p>
      </div>

      <div className="flex-1 w-full h-80 min-w-[300px]">
        {goodCount === 0 && errorCount === 0 ? (
          <div className="w-full h-full flex items-center justify-center text-gray-400 font-medium">
            Chưa có dữ liệu thống kê
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                innerRadius={80}
                outerRadius={110}
                paddingAngle={5}
                dataKey="value"
                stroke="none"
                animationDuration={1500}
                animationBegin={200}
              >
                {data.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
              <Legend 
                verticalAlign="bottom" 
                height={36} 
                iconType="circle"
                formatter={(value) => <span className="text-gray-700 font-bold ml-1">{value}</span>}
              />
            </PieChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
