"use client";

import { useState, useEffect, useRef } from "react";
import { Sparkles, Loader2, Bot } from "lucide-react";

export default function AiRecommendationCard({ attemptId, hasWrongAnswers }: { attemptId: string, hasWrongAnswers: boolean }) {
    const [loading, setLoading] = useState(true);
    const [recommendation, setRecommendation] = useState<string>("");
    const fetchCalledRef = useRef(false);

    useEffect(() => {
        if (!hasWrongAnswers) {
            setRecommendation("Tuyệt vời! Bạn không sai câu nào nên không có lỗ hổng kiến thức để bù đắp.");
            setLoading(false);
            return;
        }

        if (fetchCalledRef.current) return;
        fetchCalledRef.current = true;

        async function fetchAI() {
            try {
                const res = await fetch("/api/ai-recommendation", {
                    method: "POST", headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ attemptId })
                });
                const data = await res.json();
                setRecommendation(data.recommendation || "Rất tiếc! AI không thể chẩn đoán do lỗi đường truyền.");
            } catch (err) {
                setRecommendation("Kết nối tới Trợ lý AI thất bại.");
            } finally {
                setLoading(false);
            }
        }
        fetchAI();
    }, [attemptId, hasWrongAnswers]);

    const formatMarkdown = (text: string) => {
        return text.split('\n').map((line, i) => {
            let formattedLine = line.replace(/\*\*(.*?)\*\*/g, '<strong class="font-bold text-purple-900">$1</strong>');
            if (formattedLine.trim().startsWith('- ')) {
                formattedLine = `<li class="ml-4 list-disc">${formattedLine.substring(2)}</li>`;
            }
            return <p key={i} className="mb-2" dangerouslySetInnerHTML={{ __html: formattedLine }} />;
        });
    };

    return (
        <div className="bg-gradient-to-br from-indigo-50 to-purple-50 rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-purple-100 p-8 mb-8 relative overflow-hidden transition-all duration-500 hover:shadow-[0_8px_30px_rgb(0,0,0,0.08)]">
            <div className="absolute -top-10 -right-10 p-6 opacity-5 rotate-12 pointer-events-none">
                <Bot size={250} className="text-purple-600" />
            </div>
            
            <div className="relative z-10 w-full">
                <h2 className="text-2xl font-black text-purple-900 flex items-center gap-3 mb-6">
                    <Sparkles className="text-purple-600 animate-pulse" /> 
                    Chuẩn đoán
                </h2>
                
                {loading ? (
                    <div className="flex flex-col items-center justify-center py-12 space-y-5">
                        <div className="w-20 h-20 bg-white rounded-full shadow-lg flex items-center justify-center text-purple-600 relative">
                            <div className="absolute inset-0 rounded-full border-4 border-purple-200 animate-ping opacity-20"></div>
                            <Loader2 className="animate-spin" size={40} />
                        </div>
                        <p className="text-purple-800 font-bold animate-pulse text-lg tracking-wide">AI đang "bắt mạch" lỗi sai và vạch lộ trình...</p>
                    </div>
                ) : (
                    <div className="text-purple-900 leading-relaxed font-medium bg-white/60 p-6 rounded-xl border border-white/80 shadow-inner backdrop-blur-md">
                        {formatMarkdown(recommendation)}
                    </div>
                )}
            </div>
        </div>
    );
}
