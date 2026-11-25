import { useState, useRef, useEffect } from "react";
import { useMsal } from "@azure/msal-react";
import { sendChat } from "../../services/api";
import { offlineReply } from "../../services/offlineChat";
import MessageBubble from "./MessageBubble";

function firstNameOf(account) {
  if (!account) return "";
  const full = account.name || account.username || "";
  return full.split(/[ .@]/)[0];
}

function timeOfDayGreeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

/* Typing Indicator */
function TypingIndicator() {
  return (
    <div className="flex items-start gap-2.5 mb-3 animate-fadeIn">
      <div className="w-7 h-7 rounded-full bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center flex-shrink-0 shadow-sm">
        <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path d="M9.75 3.104v5.714a2.25 2.25 0 01-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 014.5 0m0 0v5.714a2.25 2.25 0 00.659 1.591L19 14.5M14.25 3.104c.251.023.501.05.75.082M19 14.5l-2.47-2.47" />
        </svg>
      </div>
      <div className="bg-white border border-gray-100 rounded-2xl rounded-tl-sm px-4 py-3 shadow-sm">
        <div className="flex gap-1.5">
          <span className="typing-dot w-2 h-2 bg-indigo-300 rounded-full" />
          <span className="typing-dot w-2 h-2 bg-indigo-300 rounded-full" />
          <span className="typing-dot w-2 h-2 bg-indigo-300 rounded-full" />
        </div>
      </div>
    </div>
  );
}

/* Quick Suggestion Chips */
const QUICK_SUGGESTIONS = [
  "Top 5 plants in unplanned value",
  "Compare auto vs non-auto",
  "Unplanned value by region",
  "Top 10 materials in RM",
];

export default function ChatPanel({ open, onClose }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  const { accounts } = useMsal();
  const firstName = firstNameOf(accounts[0]);
  const greeting = timeOfDayGreeting();

  const scrollRef = useRef(null);
  const inputRef = useRef(null);

  /* Auto scroll */
  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages, loading]);

  /* Focus input when panel opens */
  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 400);
  }, [open]);

  /* Send */
  const send = async (override) => {
    const q = (typeof override === "string" ? override : input).trim();
    if (!q || loading) return;

    const history = messages.map((m) => ({
      role: m.role === "user" ? "user" : "assistant",
      content: m.text || "",
      table: m.table || null,
      sql: m.sql || null,
    }));

    setMessages((prev) => [...prev, { role: "user", text: q }]);
    setInput("");
    setLoading(true);

    try {
      const res = await sendChat({ question: q, history });
      const data = res.data;

      setMessages((prev) => [
        ...prev,
        {
          role: "bot",
          text: data.data?.length ? null : data.answer || "No data available for the selected filters.",
          table: data.data || null,
          month: data.month || null,
          sql: data.sql || null,
        },
      ]);
    } catch {
      const fallback = offlineReply(q);
      setMessages((prev) => [
        ...prev,
        {
          role: "bot",
          text: fallback.table?.length ? null : fallback.answer,
          table: fallback.table,
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  const clearChat = () => {
    setMessages([]);
    setInput("");
  };

  return (
    <div
      className={`fixed bottom-24 right-6 z-50 w-[580px] transition-all duration-500 ease-out ${
        open
          ? "opacity-100 translate-y-0 scale-100"
          : "opacity-0 translate-y-10 scale-95 pointer-events-none"
      }`}
    >
      <div className="bg-white/90 backdrop-blur-2xl rounded-2xl shadow-2xl border border-gray-200/60 overflow-hidden flex flex-col h-[660px]">

        {/* Header */}
        <div className="relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-r from-indigo-600 via-purple-600 to-indigo-700" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_50%,rgba(255,255,255,0.1),transparent)]" />

          <div className="relative px-5 py-4 flex justify-between items-center">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-white/15 backdrop-blur flex items-center justify-center">
                <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                  <path d="M9.75 3.104v5.714a2.25 2.25 0 01-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 014.5 0m0 0v5.714a2.25 2.25 0 00.659 1.591L19 14.5M14.25 3.104c.251.023.501.05.75.082M19 14.5l-2.47-2.47" />
                </svg>
              </div>
              <div>
                <h3 className="text-white font-semibold text-sm tracking-tight">Stock Insights AI</h3>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  <p className="text-indigo-200 text-[10px] font-medium">Online &bull; Values in Lakhs</p>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              {messages.length > 0 && (
                <button
                  onClick={clearChat}
                  className="text-white/50 hover:text-white/90 p-1.5 rounded-lg hover:bg-white/10 transition"
                  title="Clear chat"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              )}
              <button
                onClick={onClose}
                className="text-white/50 hover:text-white/90 p-1.5 rounded-lg hover:bg-white/10 transition"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
        </div>

        {/* Messages */}
        <div
          ref={scrollRef}
          className="flex-1 overflow-y-auto px-4 py-4 space-y-1 scroll-smooth bg-gradient-to-b from-gray-50/80 to-white/40"
        >
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-center animate-fadeIn px-4">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-100 to-purple-100 flex items-center justify-center mb-4 text-3xl">
                👋
              </div>

              <p className="text-gray-800 text-base font-semibold mb-1">
                {firstName ? `Hi ${firstName}, ${greeting.toLowerCase()}!` : `${greeting}!`}
              </p>
              <p className="text-gray-500 text-sm font-medium mb-1">
                Ask anything about your inventory data
              </p>
              <p className="text-gray-400 text-xs mb-5 max-w-[280px]">
                Get instant insights on unplanned stock, plant performance, and business trends
              </p>

              {/* Quick suggestion chips */}
              <div className="flex flex-wrap justify-center gap-2">
                {QUICK_SUGGESTIONS.map((q, i) => (
                  <button
                    key={i}
                    onClick={() => send(q)}
                    className="text-[11px] px-3 py-1.5 rounded-full bg-white border border-gray-200 text-gray-600 hover:border-indigo-300 hover:text-indigo-600 hover:bg-indigo-50 transition-all shadow-sm"
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((m, i) => (
            <div key={i} className="animate-slideUp">
              <MessageBubble {...m} />
            </div>
          ))}

          {loading && <TypingIndicator />}
        </div>

        {/* Input */}
        <div className="p-3 border-t border-gray-100 bg-white/80 backdrop-blur">
          <div className="flex gap-2 items-center">
            <div className="flex-1 relative">
              <input
                ref={inputRef}
                className="w-full bg-gray-50/80 border border-gray-200 rounded-xl px-4 py-2.5 pr-10 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-400/50 focus:border-indigo-300 transition"
                placeholder="Ask about stock data..."
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
              />
            </div>

            <button
              onClick={() => send()}
              disabled={loading || !input.trim()}
              className="w-10 h-10 flex items-center justify-center bg-gradient-to-r from-indigo-500 to-purple-500 text-white rounded-xl hover:shadow-lg hover:shadow-indigo-200 hover:scale-105 active:scale-95 transition-all disabled:opacity-30 disabled:hover:scale-100 disabled:hover:shadow-none"
            >
              <svg className="w-4.5 h-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
