import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MessageSquare, X, Send, Sparkles, Loader2, Bot, User, Maximize2, Minimize2 } from 'lucide-react';
import axiosInstance from '../lib/axios';
import { useUser } from '@clerk/clerk-react';

const MoowieChat = () => {
    const { user } = useUser();
    const [isOpen, setIsOpen] = useState(false);
    const [isMinimized, setIsMinimized] = useState(false);
    const [input, setInput] = useState('');
    const [messages, setMessages] = useState([
        {
            role: 'assistant',
            content: `Moo! Hello ${user?.firstName || 'there'}! I'm Moowie, your agricultural assistant. How can I help you manage your herd today?`,
            timestamp: new Date()
        }
    ]);
    const [isLoading, setIsLoading] = useState(false);
    const scrollRef = useRef(null);

    // Context Detection: Get animalId from URL if on a profile page
    const pathname = window.location.pathname;
    const animalIdMatch = pathname.match(/\/(?:livestock|animals)\/([a-fA-F0-9]{24})/);
    const contextAnimalId = animalIdMatch ? animalIdMatch[1] : null;

    const WAVING_MOOWIE = "https://res.cloudinary.com/donhulins/image/upload/v1778124094/moowie_hi_animals_section_xbocgj.png";
    const IDLE_MOOWIE = "https://res.cloudinary.com/donhulins/image/upload/v1778122530/image-removebg-preview_f6mqrz.png";

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages]);

    const handleSendMessage = async (e) => {
        e.preventDefault();
        if (!input.trim() || isLoading) return;

        const currentInput = input;
        const userMessage = {
            role: 'user',
            content: currentInput,
            timestamp: new Date()
        };

        setMessages(prev => [...prev, userMessage]);
        setInput('');
        setIsLoading(true);

        try {
            const response = await axiosInstance.post('/moowie/ask', {
                message: currentInput,
                animalId: contextAnimalId
            });

            const assistantMessage = {
                role: 'assistant',
                content: response.data.text,
                timestamp: new Date()
            };

            setMessages(prev => [...prev, assistantMessage]);
        } catch (error) {
            console.error('Moowie Error:', error);
            const errorMessage = error.response?.data?.error || error.response?.data?.message || "I couldn't connect to the pasture right now. Please try again later.";
            
            setMessages(prev => [...prev, {
                role: 'assistant',
                content: `I'm sorry, my horns are a bit tangled! ${errorMessage}`,
                timestamp: new Date(),
                isError: true
            }]);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="fixed bottom-6 right-6 z-100 flex flex-col items-end">
            <AnimatePresence>
                {isOpen && !isMinimized && (
                    <motion.div
                        initial={{ opacity: 0, y: 20, scale: 0.95, transformOrigin: 'bottom right' }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 20, scale: 0.95 }}
                        className="w-[380px] h-[550px] bg-white dark:bg-slate-900 rounded-[32px] shadow-[0_20px_60px_rgba(0,0,0,0.3)] border border-slate-200 dark:border-slate-800 flex flex-col overflow-hidden mb-4"
                    >
                        {/* Header */}
                        <div className="p-6 bg-emerald-600 dark:bg-emerald-700 text-white flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center border border-white/20 overflow-hidden shadow-lg">
                                    <img 
                                        src={IDLE_MOOWIE} 
                                        alt="Moowie" 
                                        className="w-10 h-10 object-contain mt-1"
                                    />
                                </div>
                                <div>
                                    <h3 className="font-bold text-sm">Moowie Assistant</h3>
                                    <div className="flex items-center gap-1.5">
                                        <div className="w-1.5 h-1.5 bg-emerald-300 rounded-full animate-pulse" />
                                        <span className="text-[10px] text-emerald-100 font-medium uppercase tracking-wider">Online Pasture</span>
                                    </div>
                                </div>
                            </div>
                            <div className="flex items-center gap-1">
                                <button 
                                    onClick={() => setIsMinimized(true)}
                                    className="p-2 hover:bg-white/10 rounded-xl transition-colors"
                                >
                                    <Minimize2 size={16} />
                                </button>
                                <button 
                                    onClick={() => setIsOpen(false)}
                                    className="p-2 hover:bg-white/10 rounded-xl transition-colors"
                                >
                                    <X size={18} />
                                </button>
                            </div>
                        </div>

                        {/* Messages */}
                        <div 
                            ref={scrollRef}
                            className="flex-1 overflow-y-auto p-6 space-y-4 scroll-smooth bg-slate-50 dark:bg-slate-950/30"
                        >
                            {messages.map((msg, i) => (
                                <motion.div
                                    key={i}
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} items-end gap-2`}
                                >
                                    {msg.role === 'assistant' && (
                                        <div className="w-8 h-8 rounded-full bg-white border border-slate-100 flex items-center justify-center shrink-0 mb-1 overflow-hidden shadow-sm">
                                            <img src={IDLE_MOOWIE} className="w-6 h-6 object-contain" />
                                        </div>
                                    )}
                                    <div className={`
                                        max-w-[75%] p-4 rounded-[22px] text-[13px] leading-relaxed shadow-sm
                                        ${msg.role === 'user' 
                                            ? 'bg-emerald-600 text-white rounded-br-none' 
                                            : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-100 dark:border-slate-700 rounded-bl-none'}
                                    `}>
                                        {msg.content}
                                    </div>
                                </motion.div>
                            ))}
                            {isLoading && (
                                <div className="flex justify-start items-end gap-2">
                                    <div className="w-8 h-8 rounded-full bg-white border border-slate-100 flex items-center justify-center shrink-0 mb-1 overflow-hidden">
                                        <img src={IDLE_MOOWIE} className="w-6 h-6 object-contain" />
                                    </div>
                                    <div className="bg-white dark:bg-slate-800 p-4 rounded-[22px] rounded-bl-none border border-slate-100 dark:border-slate-700 flex gap-1">
                                        <motion.div animate={{ opacity: [0.4, 1, 0.4] }} transition={{ repeat: Infinity, duration: 1 }} className="w-1.5 h-1.5 bg-emerald-500 rounded-full" />
                                        <motion.div animate={{ opacity: [0.4, 1, 0.4] }} transition={{ repeat: Infinity, duration: 1, delay: 0.2 }} className="w-1.5 h-1.5 bg-emerald-500 rounded-full" />
                                        <motion.div animate={{ opacity: [0.4, 1, 0.4] }} transition={{ repeat: Infinity, duration: 1, delay: 0.4 }} className="w-1.5 h-1.5 bg-emerald-500 rounded-full" />
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Input */}
                        <form onSubmit={handleSendMessage} className="p-4 bg-white dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800">
                            <div className="relative">
                                <input
                                    type="text"
                                    value={input}
                                    onChange={(e) => setInput(e.target.value)}
                                    placeholder="Ask Moowie anything..."
                                    className="w-full h-12 pl-4 pr-12 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-2xl text-[13px] focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all placeholder:text-slate-400"
                                />
                                <button
                                    type="submit"
                                    disabled={!input.trim() || isLoading}
                                    className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 bg-emerald-600 text-white rounded-xl flex items-center justify-center disabled:opacity-50 hover:bg-emerald-500 transition-colors shadow-lg shadow-emerald-600/20"
                                >
                                    <Send size={14} />
                                </button>
                            </div>
                        </form>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Bubble Button */}
            <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => {
                    setIsOpen(true);
                    setIsMinimized(false);
                }}
                className={`
                    w-16 h-16 rounded-[24px] flex items-center justify-center text-white shadow-2xl transition-all overflow-hidden
                    ${isOpen && !isMinimized ? 'bg-emerald-100 dark:bg-slate-800 text-emerald-600' : 'bg-emerald-600 hover:bg-emerald-500'}
                `}
            >
                {isOpen && !isMinimized ? <X size={28} /> : (
                    <div className="relative w-full h-full p-2 flex items-center justify-center">
                        <img 
                            src={WAVING_MOOWIE} 
                            alt="Moo!" 
                            className="w-12 h-12 object-contain"
                        />
                        <span className="absolute top-2 right-2 w-3 h-3 bg-red-500 border-2 border-emerald-600 rounded-full" />
                    </div>
                )}
            </motion.button>

            {/* Minimized Bar */}
            {isMinimized && isOpen && (
                <motion.div 
                    initial={{ y: 20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    onClick={() => setIsMinimized(false)}
                    className="absolute bottom-20 right-0 h-14 px-5 bg-emerald-600 text-white rounded-[20px] flex items-center gap-3 cursor-pointer shadow-xl hover:bg-emerald-500 transition-all border border-white/20 backdrop-blur-md"
                >
                    <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center overflow-hidden">
                        <img src={IDLE_MOOWIE} className="w-8 h-8 object-contain" />
                    </div>
                    <span className="text-xs font-bold uppercase tracking-widest">Moowie is waiting</span>
                    <Maximize2 size={14} className="ml-2" />
                </motion.div>
            )}
        </div>
    );
};

export default MoowieChat;
