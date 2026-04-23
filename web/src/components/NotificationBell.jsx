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
                className="relative p-2 rounded-full hover:bg-gray-100 transition-colors"
            >
                <Bell size={24} className="text-gray-600" />
                {unreadCount > 0 && (
                    <span className="absolute top-0 right-0 bg-red-500 text-white text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center border-2 border-white">
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
                    <div className="absolute right-0 mt-2 w-80 bg-white rounded-xl shadow-2xl z-50 border border-gray-100 overflow-hidden animate-in fade-in zoom-in duration-200">
                        <div className="flex items-center justify-between p-4 border-b border-gray-100 bg-[#f8fafc]">
                            <h3 className="font-bold text-gray-800">Notifications</h3>
                            <div className="flex gap-2">
                                {unreadCount > 0 && (
                                    <button 
                                        onClick={() => markAllAsReadMutation.mutate()}
                                        className="text-[10px] text-blue-600 hover:text-blue-800 font-black uppercase tracking-widest flex items-center gap-1 bg-blue-50 px-2 py-1 rounded-md"
                                    >
                                        <Check size={10} /> Read
                                    </button>
                                )}
                                {notifications.length > 0 && (
                                    <button 
                                        onClick={() => clearNotificationsMutation.mutate()}
                                        className="text-[10px] text-rose-600 hover:text-rose-800 font-black uppercase tracking-widest flex items-center gap-1 bg-rose-50 px-2 py-1 rounded-md"
                                    >
                                        <Trash2 size={10} /> Clear
                                    </button>
                                )}
                            </div>
                        </div>
                        
                        <div className="max-h-[70vh] overflow-y-auto">
                            {notifications.length === 0 ? (
                                <div className="p-6 text-center text-gray-500 text-sm">
                                    No notifications right now.
                                </div>
                            ) : (
                                notifications.map(notif => (
                                    <div 
                                        key={notif._id}
                                        onClick={() => {
                                            if (!notif.isRead) markAsReadMutation.mutate(notif._id);
                                            // Optional: route to specific detail view if needed
                                        }}
                                        className={`p-4 border-b border-gray-50 flex gap-3 hover:bg-gray-50 cursor-pointer transition-colors ${!notif.isRead ? 'bg-blue-50/30' : ''}`}
                                    >
                                        <div className={`p-2 rounded-full shrink-0 h-min ${!notif.isRead ? 'bg-blue-100' : 'bg-gray-100'}`}>
                                            <Bell size={16} className={!notif.isRead ? 'text-blue-600' : 'text-gray-500'} />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <h4 className={`text-sm tracking-tight ${!notif.isRead ? 'font-bold text-gray-900' : 'font-medium text-gray-700'}`}>
                                                {notif.title}
                                            </h4>
                                            <p className="text-xs text-gray-500 mt-1 line-clamp-2 leading-relaxed">
                                                {notif.message}
                                            </p>
                                            <span className="text-[10px] uppercase font-bold text-gray-400 mt-2 block tracking-wider">
                                                {new Date(notif.createdAt).toLocaleDateString()}
                                            </span>
                                        </div>
                                        {!notif.isRead && (
                                            <div className="w-2 h-2 rounded-full bg-blue-500 shrink-0 mt-2 shadow-sm"></div>
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
