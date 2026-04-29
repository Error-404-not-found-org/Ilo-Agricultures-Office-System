import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Bell, Check, Info, AlertTriangle, AlertCircle, HeartPulse, Settings, Trash2 } from 'lucide-react';
import axios from '../lib/axios';

const NotificationBell = () => {
    const [isOpen, setIsOpen] = useState(false);
    const queryClient = useQueryClient();

    const { data: notifications = [] } = useQuery({
        queryKey: ['notifications'],
        queryFn: async () => {
            const res = await axios.get('/notifications');
            return res.data;
        },
        refetchInterval: 30000, // refresh every 30 seconds
    });

    const unreadCount = notifications.filter(n => !n.isRead).length;

    const markAsReadMutation = useMutation({
        mutationFn: async (id) => {
            return await axios.patch('/notifications/mark-read', { notificationId: id });
        },
        onSuccess: () => {
            queryClient.invalidateQueries(['notifications']);
        }
    });

    const markAllAsReadMutation = useMutation({
        mutationFn: async () => {
            return await axios.patch('/notifications/mark-read');
        },
        onSuccess: () => {
            queryClient.invalidateQueries(['notifications']);
        }
    });

    const clearNotificationsMutation = useMutation({
        mutationFn: async () => {
            return await axios.delete('/notifications');
        },
        onSuccess: () => {
            queryClient.invalidateQueries(['notifications']);
        }
    });

    const getIcon = (type) => {
        switch(type) {
            case 'health-request': return <HeartPulse size={18} className="text-blue-500" />;
            case 'ai-request': return <Settings size={18} className="text-emerald-500" />;
            default: return <Info size={18} className="text-gray-500" />;
        }
    };

    return (
        <div className="relative">
            <button 
                onClick={() => setIsOpen(!isOpen)}
                className="relative p-2 rounded-full hover:bg-base-content/10 transition-colors"
            >
                <Bell size={24} className="text-base-content/70" />
                {unreadCount > 0 && (
                    <span className="absolute top-0 right-0 bg-red-500 text-white text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center border-2 border-base-100">
                        {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                )}
            </button>

            {isOpen && (
                <>
                    <div 
                         className="fixed inset-0 z-40" 
                         onClick={() => setIsOpen(false)} 
                    ></div>
                    <div className="absolute right-0 mt-2 w-80 bg-base-100 rounded-xl shadow-2xl z-50 border border-base-content/10 overflow-hidden animate-in fade-in zoom-in duration-200">
                        <div className="flex items-center justify-between p-4 border-b border-base-content/10 bg-base-200/50">
                            <h3 className="font-bold text-base-content">Notifications</h3>
                            <div className="flex gap-2">
                                {unreadCount > 0 && (
                                    <button 
                                        onClick={() => markAllAsReadMutation.mutate()}
                                        className="text-[10px] text-blue-600 hover:text-blue-800 font-black uppercase tracking-widest flex items-center gap-1 bg-blue-500/10 px-2 py-1 rounded-md"
                                    >
                                        <Check size={10} /> Read
                                    </button>
                                )}
                                {notifications.length > 0 && (
                                    <button 
                                        onClick={() => clearNotificationsMutation.mutate()}
                                        className="text-[10px] text-rose-600 hover:text-rose-800 font-black uppercase tracking-widest flex items-center gap-1 bg-rose-500/10 px-2 py-1 rounded-md"
                                    >
                                        <Trash2 size={10} /> Clear
                                    </button>
                                )}
                            </div>
                        </div>
                        
                        <div className="max-h-[70vh] overflow-y-auto">
                            {notifications.length === 0 ? (
                                <div className="p-6 text-center text-base-content/50 text-sm italic">
                                    No notifications right now.
                                </div>
                            ) : (
                                notifications.map(notif => (
                                    <div 
                                        key={notif._id}
                                        onClick={() => {
                                            if (!notif.isRead) markAsReadMutation.mutate(notif._id);
                                        }}
                                        className={`p-4 border-b border-base-content/5 flex gap-3 hover:bg-base-content/10 cursor-pointer transition-all ${!notif.isRead ? 'bg-blue-500/5' : ''}`}
                                    >
                                        <div className={`p-2 rounded-xl shrink-0 h-min ${!notif.isRead ? 'bg-blue-500/10' : 'bg-base-content/10'}`}>
                                            <Bell size={16} className={!notif.isRead ? 'text-blue-500' : 'text-base-content/30'} />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <h4 className={`text-sm tracking-tight ${!notif.isRead ? 'font-black text-base-content' : 'font-bold text-base-content/50'}`}>
                                                {notif.title}
                                            </h4>
                                            <p className="text-xs text-base-content/40 mt-1 line-clamp-2 leading-relaxed font-medium">
                                                {notif.message}
                                            </p>
                                            <span className="text-[9px] uppercase font-black text-base-content/20 mt-2 block tracking-widest">
                                                {new Date(notif.createdAt).toLocaleDateString()}
                                            </span>
                                        </div>
                                        {!notif.isRead && (
                                            <div className="w-2 h-2 rounded-full bg-blue-500 shrink-0 mt-2 shadow-[0_0_8px_rgba(59,130,246,0.5)]"></div>
                                        )}
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </>
            )}
        </div>
    );
};

export default NotificationBell;
