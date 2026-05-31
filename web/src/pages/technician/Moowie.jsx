import React, { useState, useEffect, useRef, useMemo } from "react";
import {
  MessageSquare,
  Send,
  Plus,
  Trash2,
  Sparkles,
  PawPrint,
  Loader2,
  Clock,
  ArrowRight,
  Bot,
  User,
  Info,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import axiosInstance from "../../lib/axios";
import Topbar from "../../components/ui/Topbar";
import { useToast } from "../../contexts/ToastContext";

export default function MoowieChatPage() {
  const toast = useToast();
  const messagesEndRef = useRef(null);

  // ---- LOCAL CHAT SESSION ARCHIVE ----
  const [threads, setThreads] = useState(() => {
    const saved = localStorage.getItem("moowie_threads");
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error("Failed parsing moowie_threads", e);
      }
    }
    return [
      {
        id: "default",
        title: "Initial Veterinary Consult",
        messages: [
          {
            sender: "moowie",
            text: "Moo! Hello! I am Moowie, your AI Field Veterinary Auditor. Ask me any questions about our breeding schedules, voluntary waiting periods, diagnostic checkups, or coordinate specific animal profiles directly from the Oton municipal registry!",
            timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          },
        ],
      },
    ];
  });

  const [activeThreadId, setActiveThreadId] = useState("default");
  const [inputMessage, setInputMessage] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [selectedAnimalId, setSelectedAnimalId] = useState("");

  // Persist chat threads to localStorage
  useEffect(() => {
    localStorage.setItem("moowie_threads", JSON.stringify(threads));
  }, [threads]);

  // ---- FETCH ANIMAL REGISTRY FOR CONTEXT ATTACHMENT ----
  const { data: animals = [] } = useQuery({
    queryKey: ["technician", "animals-list"],
    queryFn: async () => {
      const res = await axiosInstance.get("/technician/dashboard-registry");
      return Array.isArray(res.data) ? res.data : [];
    },
  });

  // Find active chat thread
  const activeThread = useMemo(() => {
    return threads.find((t) => t.id === activeThreadId) || threads[0];
  }, [threads, activeThreadId]);

  // Scroll to bottom on new message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [activeThread?.messages, isGenerating]);

  // ---- THREAD OPERATIONS ----
  const handleNewChat = () => {
    const newId = `thread_${Date.now()}`;
    const newThread = {
      id: newId,
      title: "New AI Session",
      messages: [
        {
          sender: "moowie",
          text: "Moo! Let's start a fresh operational analysis. Ask me about insemination timelines, calving rates, or link a livestock profile below to begin.",
          timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        },
      ],
    };
    setThreads((prev) => [newThread, ...prev]);
    setActiveThreadId(newId);
    setSelectedAnimalId("");
  };

  const handleDeleteThread = (id, e) => {
    e.stopPropagation();
    if (threads.length === 1) {
      toast.error("You must retain at least one chat thread.");
      return;
    }
    const index = threads.findIndex((t) => t.id === id);
    const updated = threads.filter((t) => t.id !== id);
    setThreads(updated);
    if (activeThreadId === id) {
      setActiveThreadId(updated[0]?.id || "default");
    }
  };

  const handleClearAllHistory = () => {
    if (window.confirm("Are you sure you want to delete all chat history threads?")) {
      const defaultThread = [
        {
          id: "default",
          title: "Fresh Veterinary Session",
          messages: [
            {
              sender: "moowie",
              text: "Moo! History cleared successfully. Ready for your veterinary field audit inputs!",
              timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
            },
          ],
        },
      ];
      setThreads(defaultThread);
      setActiveThreadId("default");
      setSelectedAnimalId("");
      toast.success("Chat history cleared.");
    }
  };

  // ---- SEND MESSAGE PROCESSOR ----
  const handleSendMessage = async (customPrompt = "") => {
    const messageToSend = customPrompt.trim() || inputMessage.trim();
    if (!messageToSend) return;

    // Add user message
    const userMsg = {
      sender: "user",
      text: messageToSend,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };

    let updatedMessages = [...activeThread.messages, userMsg];

    // Auto update thread title if it's default naming
    let threadTitle = activeThread.title;
    if (threadTitle === "New AI Session" || threadTitle === "Initial Veterinary Consult") {
      threadTitle = messageToSend.slice(0, 30) + (messageToSend.length > 30 ? "..." : "");
    }

    setThreads((prev) =>
      prev.map((t) =>
        t.id === activeThreadId
          ? { ...t, title: threadTitle, messages: updatedMessages }
          : t
      )
    );
    setInputMessage("");
    setIsGenerating(true);

    try {
      // API call to backend Gemini generator
      const response = await axiosInstance.post("/moowie/ask", {
        message: messageToSend,
        animalId: selectedAnimalId || undefined,
      });

      const reply = response.data?.text || "Moo! I didn't receive a reply from my brain matrix.";

      const moowieMsg = {
        sender: "moowie",
        text: reply,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      };

      setThreads((prev) =>
        prev.map((t) =>
          t.id === activeThreadId
            ? { ...t, messages: [...updatedMessages, moowieMsg] }
            : t
        )
      );
    } catch (err) {
      console.error("Moowie ask error:", err);
      const errorMsg = {
        sender: "moowie",
        text: "Moo! I ran into an error connecting to my brain module. Please verify backend connection and Gemini API keys.",
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      };
      setThreads((prev) =>
        prev.map((t) =>
          t.id === activeThreadId
            ? { ...t, messages: [...updatedMessages, errorMsg] }
            : t
        )
      );
    } finally {
      setIsGenerating(false);
    }
  };

  // Quick prompt click handler
  const handleQuickPrompt = (promptText) => {
    handleSendMessage(promptText);
  };

  const suggestionPrompts = [
    {
      title: "Voluntary Waiting Period",
      text: "Explain the Voluntary Waiting Period guidelines for Brahman cattle.",
    },
    {
      title: "Foot Rot Diagnostics",
      text: "What are the primary symptoms and recommended deworming/clinical treatment for bovine foot rot?",
    },
    {
      title: "Breeding Timeline",
      text: "Draft a dynamic pregnancy milestone calendar for Simmental cows based on an AI check today.",
    },
  ];

  return (
    <div className="flex-1 flex flex-col h-screen overflow-hidden bg-slate-50 dark:bg-slate-900 transition-colors duration-300">
      <Topbar
        title="Moowie AI Assistant"
        subtitle="Operational Field Auditor — dynamic diagnostic consultation & herd intelligence"
      />

      {/* Main Split Layout container */}
      <div className="flex-1 flex overflow-hidden min-h-0">
        
        {/* LEFT HISTORICAL SIDEBAR */}
        <aside className="w-80 border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 hidden md:flex md:flex-col justify-between shrink-0">
          
          {/* Top Control Block */}
          <div className="p-4 space-y-3">
            <button
              onClick={handleNewChat}
              className="w-full h-11 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl flex items-center justify-center gap-2 text-xs font-black uppercase tracking-wider transition-all shadow-md shadow-emerald-600/10 cursor-pointer"
            >
              <Plus size={14} /> New Consultation
            </button>
            <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">
              Active Sessions
            </div>
          </div>

          {/* Scrollable Threads List */}
          <div className="flex-1 overflow-y-auto px-3 space-y-1.5 custom-scrollbar">
            {threads.map((thread) => {
              const isActive = thread.id === activeThreadId;
              return (
                <div
                  key={thread.id}
                  onClick={() => setActiveThreadId(thread.id)}
                  className={`group p-3 rounded-xl border flex items-center justify-between gap-3 cursor-pointer transition-all duration-200 ${
                    isActive
                      ? "bg-emerald-50 dark:bg-emerald-950/20 border-emerald-500/30 text-emerald-800 dark:text-emerald-400 font-extrabold"
                      : "bg-transparent border-transparent hover:bg-slate-50 dark:hover:bg-slate-900/60 text-slate-600 dark:text-slate-400 font-bold"
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <MessageSquare
                      size={14}
                      className={isActive ? "text-emerald-600 dark:text-emerald-400" : "text-slate-400"}
                    />
                    <span className="text-xs truncate">{thread.title}</span>
                  </div>
                  <button
                    onClick={(e) => handleDeleteThread(thread.id, e)}
                    className="opacity-0 group-hover:opacity-100 hover:text-rose-500 text-slate-400 p-1 rounded-md transition-all"
                    title="Delete session"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              );
            })}
          </div>

          {/* Bottom Settings Block */}
          <div className="p-4 border-t border-slate-100 dark:border-slate-800/80 bg-slate-50/50 dark:bg-slate-950/50">
            <button
              onClick={handleClearAllHistory}
              className="w-full py-2.5 bg-rose-500/10 hover:bg-rose-500 hover:text-white text-rose-500 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-1.5 border border-rose-500/20 cursor-pointer"
            >
              <Trash2 size={12} /> Clear Chat History
            </button>
          </div>
        </aside>

        {/* RIGHT ACTIVE CHAT WRAPPER */}
        <main className="flex-1 flex flex-col bg-slate-50 dark:bg-slate-900/40 min-w-0 relative">
          
          {/* Chat Header Status Strip */}
          <div className="bg-white dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800 px-6 py-4 flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 bg-emerald-500/10 dark:bg-emerald-500/20 border border-emerald-500/20 rounded-full flex items-center justify-center relative shrink-0 overflow-hidden">
                <img src="https://res.cloudinary.com/donhulins/image/upload/v1778122530/image-removebg-preview_f6mqrz.png" alt="Moowie AI" className="w-full h-full object-cover" />
                <span className="absolute bottom-0.5 right-0.5 w-2 h-2 bg-emerald-500 rounded-full border border-white dark:border-slate-950 animate-pulse" />
              </div>
              <div>
                <h4 className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
                  Moowie Field Auditor
                  <span className="bg-emerald-100 dark:bg-emerald-950/50 text-[#00643b] text-[8px] font-black px-1.5 py-0.5 rounded-md uppercase tracking-widest border border-emerald-200/50">
                    Online
                  </span>
                </h4>
                <p className="text-[10px] text-slate-400 font-semibold mt-0.5">
                  Powered by Gemini 1.5 Flash Model Matrix
                </p>
              </div>
            </div>

            {/* LIVE REGISTRY CONTEXT ATTACHMENT SELECT */}
            <div className="flex items-center gap-2">
              <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest shrink-0 hidden sm:inline-block">
                Attach Herd Context:
              </label>
              <div className="relative shrink-0">
                <select
                  value={selectedAnimalId}
                  onChange={(e) => {
                    setSelectedAnimalId(e.target.value);
                    if (e.target.value) {
                      const animal = animals.find((a) => a.rawId === e.target.value);
                      toast.success(`Context locked to Animal ${animal?.id || "Selected"}`);
                    }
                  }}
                  className="h-9 px-3 py-1.5 text-xs font-bold rounded-xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 focus:border-emerald-500 focus:outline-none appearance-none pr-8 cursor-pointer"
                >
                  <option value="">-- Attach Animal (No Context) --</option>
                  {animals.map((a) => (
                    <option key={a.rawId} value={a.rawId}>
                      {a.id} ({a.breed}) — Owned by {a.farmerName}
                    </option>
                  ))}
                </select>
                <PawPrint
                  size={12}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
                />
              </div>
            </div>
          </div>

          {/* SCROLLABLE DIALOG SCREEN CONTAINER */}
          <div className="flex-1 overflow-y-auto px-6 py-6 space-y-4 custom-scrollbar">
            
            {/* Suggestion Prompt Cards Grid - display only at start of fresh session */}
            {activeThread.messages.length <= 1 && (
              <div className="max-w-3xl mx-auto space-y-4">
                <div className="bg-emerald-500/5 border border-emerald-500/10 rounded-2xl p-4 flex items-start gap-3">
                  <Sparkles size={16} className="text-emerald-500 mt-0.5 shrink-0" />
                  <div>
                    <h5 className="text-[10px] font-black uppercase text-emerald-600 dark:text-emerald-400 tracking-wider leading-none">
                      Suggested Consultations
                    </h5>
                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-1.5">
                      Select a veterinary template to query Moowie automatically:
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {suggestionPrompts.map((s, idx) => (
                    <div
                      key={idx}
                      onClick={() => handleQuickPrompt(s.text)}
                      className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 p-4 rounded-xl shadow-2xs hover:shadow-md hover:border-emerald-500 dark:hover:border-emerald-600 cursor-pointer transition-all duration-200 group flex flex-col justify-between"
                    >
                      <div>
                        <h6 className="text-[10px] font-black uppercase text-[#00643b] dark:text-emerald-400 tracking-wider mb-2">
                          {s.title}
                        </h6>
                        <p className="text-xs text-slate-500 dark:text-slate-400 font-medium leading-relaxed line-clamp-3">
                          "{s.text}"
                        </p>
                      </div>
                      <span className="text-[10px] font-bold text-slate-400 mt-4 flex items-center gap-1 group-hover:text-emerald-500 transition-colors self-end">
                        Ask <ArrowRight size={10} />
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Core Dialogue Loops */}
            <div className="max-w-4xl mx-auto space-y-4">
              {activeThread.messages.map((msg, index) => {
                const isAI = msg.sender === "moowie";
                return (
                  <div
                    key={index}
                    className={`flex gap-3 max-w-[85%] ${isAI ? "self-start" : "ml-auto flex-row-reverse"}`}
                  >
                    {/* Avatar Block */}
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 border shadow-2xs overflow-hidden ${
                        isAI
                          ? "bg-emerald-500/10 border-emerald-500/20"
                          : "bg-slate-900 border-slate-800 text-white"
                      }`}
                    >
                      {isAI ? (
                        <img src="https://res.cloudinary.com/donhulins/image/upload/v1778122530/image-removebg-preview_f6mqrz.png" alt="Moowie" className="w-full h-full object-cover" />
                      ) : (
                        <User size={14} />
                      )}
                    </div>

                    {/* Dialog Balloon Box */}
                    <div
                      className={`rounded-2xl p-4 text-xs font-bold leading-relaxed shadow-3xs ${
                        isAI
                          ? "bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200"
                          : "bg-emerald-600 border border-emerald-500 text-white"
                      }`}
                    >
                      {/* Message Content with proper carriage returns */}
                      <p className="whitespace-pre-line leading-relaxed">{msg.text}</p>
                      
                      {/* Timestamp Indicator */}
                      <div
                        className={`text-[9px] font-bold mt-2.5 text-right uppercase tracking-wider ${
                          isAI ? "text-slate-400" : "text-emerald-200/80"
                        }`}
                      >
                        {msg.timestamp}
                      </div>
                    </div>
                  </div>
                );
              })}

              {/* Dynamic typist loader active state */}
              {isGenerating && (
                <div className="flex gap-3 max-w-[85%] self-start">
                  <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 border border-emerald-500/20 bg-emerald-500/10 shadow-2xs overflow-hidden">
                    <img src="https://res.cloudinary.com/donhulins/image/upload/v1778122530/image-removebg-preview_f6mqrz.png" alt="Moowie loading" className="w-full h-full object-cover" />
                  </div>
                  <div className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 flex items-center gap-2">
                    <Loader2 size={12} className="animate-spin text-emerald-600" />
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                      Moowie is analyzing pasture vectors...
                    </span>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>
          </div>

          {/* Selected Animal ID Indicator banner */}
          {selectedAnimalId && (
            <div className="bg-emerald-500/5 dark:bg-emerald-950/10 border-t border-emerald-500/10 px-6 py-2 flex items-center justify-between text-[10px] font-bold text-slate-400">
              <span className="flex items-center gap-1">
                <Info size={12} className="text-emerald-500" />
                Active Database Context locked on Animal Ear Tag:{" "}
                <span className="font-mono text-emerald-600 dark:text-emerald-400 font-extrabold uppercase bg-emerald-500/10 px-2 py-0.5 rounded-md">
                  {animals.find((a) => a.rawId === selectedAnimalId)?.id}
                </span>
              </span>
              <button
                onClick={() => setSelectedAnimalId("")}
                className="text-slate-400 hover:text-rose-500 uppercase text-[9px] font-black tracking-widest underline transition-colors"
              >
                Clear Context
              </button>
            </div>
          )}

          {/* CHAT PANEL FOOTER INPUT CONTROL BLOCK */}
          <div className="bg-white dark:bg-slate-950 border-t border-slate-200 dark:border-slate-800 p-4">
            <div className="max-w-4xl mx-auto flex items-center gap-3">
              <input
                type="text"
                placeholder="Ask Moowie about herd cycles, disease checkups, calving expectations..."
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSendMessage();
                  }
                }}
                disabled={isGenerating}
                className="flex-1 h-12 px-5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-bold text-slate-800 dark:text-slate-200 placeholder:text-slate-400 focus:border-emerald-500 focus:outline-none transition-all disabled:opacity-50"
              />
              <button
                onClick={() => handleSendMessage()}
                disabled={isGenerating || !inputMessage.trim()}
                className="h-12 w-12 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl flex items-center justify-center shadow-md shadow-emerald-600/15 disabled:opacity-30 disabled:hover:bg-emerald-600 transition-all cursor-pointer shrink-0"
              >
                <Send size={16} />
              </button>
            </div>
          </div>

        </main>
      </div>
    </div>
  );
}
