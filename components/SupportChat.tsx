"use client";

import { useState, useRef, useEffect } from "react";
import { MessageCircle, X, Send, Bot } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const QUICK_QUESTIONS = [
  "How does JPRADAR work?",
  "What platforms do you monitor?",
  "When will I get my first report?",
  "How do I cancel my subscription?",
];

const FAQ: Record<string, string> = {
  "how does jpradar work": "JPRADAR monitors Japanese social media platforms (X/Twitter JP, Note, and others) using AI. Every day, we scan public posts matching your keywords, translate and analyze them, and deliver a concise English intelligence report to your dashboard and Slack.",
  "what platforms": "We currently monitor X (Twitter Japan), Note.com, and Reddit Japan. We're adding Hatena Bookmark and 5ch monitoring in the next update.",
  "when will i get my first report": "Your first report will appear in your dashboard the next morning after adding a keyword (reports generate at 10:00 AM JST daily). If you added a keyword today, check back tomorrow!",
  "how do i cancel": "You can cancel anytime from your account settings. Your access continues until the end of your billing period. No cancellation fees.",
  "how accurate": "Our reports are generated using Claude AI (Anthropic) and are designed to give you directional market intelligence. They're great for trend spotting and sentiment analysis. Always verify critical decisions with primary research.",
  "pricing": "We offer two plans: Starter at $299/month (3 keywords, weekly reports) and Pro at $799/month (10 keywords, daily reports + Slack). Beta users get 3 months free.",
  "slack": "Slack integration is coming soon — expected within 2 weeks. You'll be able to connect your Slack workspace from your dashboard settings.",
  "refund": "We offer a 7-day money-back guarantee. If you're not satisfied within 7 days of your first paid month, contact us for a full refund.",
};

function getAutoReply(message: string): string {
  const lower = message.toLowerCase();

  for (const [key, answer] of Object.entries(FAQ)) {
    if (key.split(" ").some(word => lower.includes(word) && word.length > 3)) {
      return answer;
    }
  }

  if (lower.includes("hello") || lower.includes("hi") || lower.includes("hey")) {
    return "Hi there! 👋 I'm the JPRADAR support bot. I can answer questions about how the service works, pricing, reports, and more. What can I help you with?";
  }

  if (lower.includes("human") || lower.includes("person") || lower.includes("agent")) {
    return "For complex issues, you can reach our team at support@wakaruai.net. We typically respond within 24 hours. In the meantime, I can help with most common questions!";
  }

  return "Thanks for your message! I'm not sure I have the exact answer for that. You can email our team at support@wakaruai.net for detailed assistance. Is there anything else I can help with?";
}

export default function SupportChat() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<{ role: "user" | "bot"; text: string }[]>([
    { role: "bot", text: "Hi! 👋 I'm the JPRADAR support bot. Ask me anything about the service, or pick a quick question below." }
  ]);
  const [input, setInput] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  function sendMessage(text?: string) {
    const msg = text || input.trim();
    if (!msg) return;
    setInput("");
    setMessages(prev => [...prev, { role: "user", text: msg }]);
    setTimeout(() => {
      setMessages(prev => [...prev, { role: "bot", text: getAutoReply(msg) }]);
    }, 600);
  }

  return (
    <>
      {/* Chat button */}
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-6 right-6 z-50 bg-blue-600 hover:bg-blue-700 text-white rounded-full w-14 h-14 flex items-center justify-center shadow-lg shadow-blue-200 transition-all hover:scale-105"
      >
        <MessageCircle size={24} />
      </button>

      {/* Chat window */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            className="fixed bottom-24 right-6 z-50 w-80 bg-white rounded-2xl border border-slate-200 shadow-2xl overflow-hidden"
          >
            {/* Header */}
            <div className="bg-blue-600 px-4 py-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Bot size={18} className="text-white" />
                <span className="text-white font-bold text-sm">JPRADAR Support</span>
                <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse"></span>
              </div>
              <button onClick={() => setOpen(false)} className="text-white/80 hover:text-white transition-colors">
                <X size={18} />
              </button>
            </div>

            {/* Messages */}
            <div className="h-72 overflow-y-auto px-4 py-4 space-y-3">
              {messages.map((m, i) => (
                <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-xs leading-relaxed ${
                    m.role === "user"
                      ? "bg-blue-600 text-white rounded-br-sm"
                      : "bg-slate-100 text-slate-700 rounded-bl-sm"
                  }`}>
                    {m.text}
                  </div>
                </div>
              ))}
              <div ref={bottomRef} />
            </div>

            {/* Quick questions */}
            {messages.length <= 1 && (
              <div className="px-4 pb-2 flex flex-wrap gap-1.5">
                {QUICK_QUESTIONS.map((q, i) => (
                  <button key={i} onClick={() => sendMessage(q)}
                    className="text-xs bg-blue-50 text-blue-600 px-2.5 py-1.5 rounded-full hover:bg-blue-100 transition-colors font-medium">
                    {q}
                  </button>
                ))}
              </div>
            )}

            {/* Input */}
            <div className="border-t border-slate-100 px-3 py-3 flex gap-2">
              <input
                type="text"
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => e.key === "Enter" && sendMessage()}
                placeholder="Type a question..."
                className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-blue-400 transition-colors"
              />
              <button onClick={() => sendMessage()}
                disabled={!input.trim()}
                className="bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white rounded-xl px-3 py-2 transition-colors">
                <Send size={14} />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
