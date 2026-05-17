import React, { useState } from 'react';
import { 
    User, Shield, Bell, Database, Globe, 
    Save, Moon, Sun, Smartphone, Mail,
    Lock, LogOut, CheckCircle2, AlertCircle,
    ChevronRight, Cloud, HardDrive, RefreshCw,
    ShieldCheck, Zap, Info, Settings as SettingsIcon,
    Palette, BellRing, Monitor, Fingerprint
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useUser, useClerk } from '@clerk/clerk-react';
import { useToast } from '../contexts/ToastContext';

const inputClass = `w-full h-11 bg-base-200/50 border border-base-200 rounded-none px-4 pl-11 text-xs font-bold text-base-content placeholder:text-base-content/20 focus:border-emerald-500/30 focus:outline-none transition-all`;
const labelClass = `text-[9px] font-black text-base-content/30 uppercase tracking-[0.2em] ml-1 mb-2 block`;
const tabClass = (active) => `w-full flex items-center gap-3 px-6 py-4 rounded-none font-black text-[10px] uppercase tracking-widest transition-all border-b border-base-200 last:border-none ${active ? 'bg-[#074033] text-white shadow-xl shadow-emerald-950/20' : 'text-base-content/40 hover:bg-base-200 hover:text-base-content'}`;

const Settings = () => {
    const { user } = useUser();
    const { signOut } = useClerk();
    const toast = useToast();
    const [activeTab, setActiveTab] = useState('profile');
    const [saving, setSaving] = useState(false);

    const handleSave = () => {
        setSaving(true);
        setTimeout(() => {
            setSaving(false);
            toast.success("Settings synchronization successful.");
        }, 1200);
    };

    const tabs = [
        { id: 'profile', label: 'Identity Protocol', icon: User },
        { id: 'security', label: 'Security Firewall', icon: Shield },
        { id: 'appearance', label: 'Interface Design', icon: Palette },
        { id: 'notifications', label: 'Comms Relay', icon: BellRing },
        { id: 'system', label: 'Core Infrastructure', icon: Database },
    ];

    return (
        <div className="animate-fade-in space-y-8 pb-16">
            {/* HEADER */}
            <div className="bg-base-100 border border-base-300 rounded-none shadow-sm overflow-hidden">
                <div className="bg-linear-to-r from-[#074033] to-emerald-800 px-8 py-8 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                    <div>
                        <div className="flex items-center gap-3 mb-1">
                            <div className="w-8 h-8 bg-white/15 rounded-none flex items-center justify-center">
                                <SettingsIcon size={16} className="text-emerald-300" />
                            </div>
                            <span className="text-emerald-300 text-[10px] font-black uppercase tracking-[0.3em]">
                                Municipal System Config
                            </span>
                        </div>
                        <h1 className="text-3xl font-black text-white tracking-tight uppercase">
                            System Control Panel
                        </h1>
                        <p className="text-emerald-200/70 text-xs mt-1 font-medium">
                            Manage technical authorizations, identity protocols, and municipal data configurations.
                        </p>
                    </div>
                    
                    <button 
                        onClick={handleSave}
                        disabled={saving}
                        className="h-12 px-10 bg-white text-[#074033] rounded-none font-black uppercase tracking-widest text-[10px] shadow-2xl hover:bg-emerald-50 transition-all flex items-center gap-3 disabled:opacity-50"
                    >
                        {saving ? <RefreshCw className="animate-spin" size={14} /> : <Save size={14} />}
                        <span>{saving ? 'Syncing...' : 'Synchronize Changes'}</span>
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-[300px_1fr] gap-8">
                {/* NAVIGATION */}
                <div className="bg-base-100 border border-base-300 rounded-none shadow-sm overflow-hidden h-fit">
                    {tabs.map((tab) => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={tabClass(activeTab === tab.id)}
                        >
                            <tab.icon size={16} />
                            <span>{tab.label}</span>
                        </button>
                    ))}
                    
                    <div className="p-6 bg-rose-500/5 mt-4 border-t border-base-200">
                        <button 
                            onClick={() => signOut()}
                            className="w-full h-11 flex items-center justify-center gap-3 bg-base-200/50 hover:bg-rose-500 hover:text-white border border-base-300 rounded-none font-black text-[10px] uppercase tracking-widest text-rose-500 transition-all"
                        >
                            <LogOut size={16} />
                            <span>Terminate Session</span>
                        </button>
                    </div>
                </div>

                {/* CONTENT AREA */}
                <div className="bg-base-100 border border-base-300 rounded-none shadow-sm overflow-hidden min-h-[600px] flex flex-col">
                    <AnimatePresence mode="wait">
                        <motion.div 
                            key={activeTab}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            transition={{ duration: 0.15 }}
                            className="p-10 flex-1"
                        >
                            {activeTab === 'profile' && (
                                <div className="space-y-10">
                                    <div className="flex items-center gap-8 pb-10 border-b border-base-200">
                                        <div className="relative group">
                                            <div className="w-28 h-28 rounded-none bg-base-200 border-2 border-base-300 shadow-xl overflow-hidden relative">
                                                <img src={user?.imageUrl} alt="Avatar" className="w-full h-full object-cover grayscale-[0.3]" />
                                                <div className="absolute inset-0 bg-emerald-500/10 opacity-0 group-hover:opacity-100 transition-all" />
                                            </div>
                                            <button className="absolute -bottom-2 -right-2 w-8 h-8 bg-[#074033] text-white flex items-center justify-center rounded-none shadow-xl border border-white/10 hover:bg-emerald-800 transition-colors">
                                                <RefreshCw size={14} />
                                            </button>
                                        </div>
                                        <div>
                                            <h3 className="text-2xl font-black text-base-content uppercase tracking-tight">{user?.fullName}</h3>
                                            <p className="text-emerald-600 text-[10px] font-black uppercase tracking-[0.3em] mt-1">Authorized Personnel</p>
                                            <div className="flex gap-2 mt-4">
                                                <span className="px-3 py-1 bg-emerald-500/10 text-emerald-600 text-[8px] font-black rounded-none border border-emerald-500/20 uppercase tracking-widest">Digital ID: VERIFIED</span>
                                                <span className="px-3 py-1 bg-blue-500/10 text-blue-600 text-[8px] font-black rounded-none border border-blue-500/20 uppercase tracking-widest">Rank: Field Tech</span>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                        <div className="space-y-2">
                                            <label className={labelClass}>Authorized Identity</label>
                                            <div className="relative">
                                                <User className="absolute left-4 top-1/2 -translate-y-1/2 text-base-content/20" size={16} />
                                                <input className={inputClass} defaultValue={user?.fullName || ''} />
                                            </div>
                                        </div>
                                        <div className="space-y-2">
                                            <label className={labelClass}>Comm Relay (Email)</label>
                                            <div className="relative">
                                                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-base-content/20" size={16} />
                                                <input className={inputClass} defaultValue={user?.primaryEmailAddress?.emailAddress || ''} disabled />
                                            </div>
                                        </div>
                                        <div className="space-y-2">
                                            <label className={labelClass}>Field Contact</label>
                                            <div className="relative">
                                                <Smartphone className="absolute left-4 top-1/2 -translate-y-1/2 text-base-content/20" size={16} />
                                                <input className={inputClass} defaultValue={user?.primaryPhoneNumber?.phoneNumber || 'UNSET'} />
                                            </div>
                                        </div>
                                        <div className="space-y-2">
                                            <label className={labelClass}>Language Protocol</label>
                                            <div className="relative">
                                                <Globe className="absolute left-4 top-1/2 -translate-y-1/2 text-base-content/20" size={16} />
                                                <select className={`${inputClass} appearance-none`}>
                                                    <option>ENGLISH (PRIMARY)</option>
                                                    <option>HILIGAYNON (LOCAL)</option>
                                                    <option>TAGALOG (NATIONAL)</option>
                                                </select>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {activeTab === 'security' && (
                                <div className="space-y-10">
                                   <div className="bg-emerald-500/5 border border-emerald-500/10 p-6 flex items-start gap-4">
                                      <Shield className="text-emerald-600 shrink-0" size={20} />
                                      <div>
                                         <h4 className="text-[10px] font-black text-base-content uppercase tracking-widest">Active Security Protocol</h4>
                                         <p className="text-[9px] font-bold text-base-content/40 uppercase mt-1 leading-relaxed tracking-wider">
                                            Your account is secured with clerk-auth biometric hardware encryption and 256-bit SSL session management.
                                         </p>
                                      </div>
                                   </div>

                                   <div className="space-y-6">
                                      <div className="flex items-center justify-between p-6 bg-base-200/30 border border-base-200">
                                         <div>
                                            <h4 className="text-[11px] font-black text-base-content uppercase tracking-widest">Two-Factor Authentication</h4>
                                            <p className="text-[10px] font-medium text-base-content/30 mt-1 uppercase">Multi-layer personnel verification</p>
                                         </div>
                                         <div className="badge badge-success rounded-none text-[9px] font-black px-3 py-3 uppercase tracking-widest">ACTIVE</div>
                                      </div>

                                      <div className="flex items-center justify-between p-6 bg-base-200/30 border border-base-200">
                                         <div>
                                            <h4 className="text-[11px] font-black text-base-content uppercase tracking-widest">Hardware Security Keys</h4>
                                            <p className="text-[10px] font-medium text-base-content/30 mt-1 uppercase">Physical authorization tokens</p>
                                         </div>
                                         <button className="btn btn-sm btn-ghost rounded-none text-[9px] font-black uppercase tracking-widest border border-base-300">CONFIGURE</button>
                                      </div>
                                      
                                      <div className="flex items-center justify-between p-6 bg-base-200/30 border border-base-200">
                                         <div>
                                            <h4 className="text-[11px] font-black text-base-content uppercase tracking-widest">Session Management</h4>
                                            <p className="text-[10px] font-medium text-base-content/30 mt-1 uppercase">Monitor active field deployments</p>
                                         </div>
                                         <button className="btn btn-sm btn-ghost rounded-none text-[9px] font-black uppercase tracking-widest border border-base-300">VIEW LOGS</button>
                                      </div>
                                   </div>
                                </div>
                            )}

                            {activeTab === 'appearance' && (
                                <div className="space-y-10">
                                   <div className="grid grid-cols-2 gap-6">
                                      <button className="p-8 border-2 border-[#074033] bg-emerald-500/5 flex flex-col items-center gap-4 group transition-all">
                                         <Monitor size={32} className="text-[#074033]" />
                                         <span className="text-[10px] font-black uppercase tracking-widest">Mission Control (Dark)</span>
                                         <div className="w-4 h-4 bg-[#074033] rounded-none border border-white/20"></div>
                                      </button>
                                      <button className="p-8 border-2 border-base-200 bg-white flex flex-col items-center gap-4 group transition-all opacity-40 hover:opacity-100">
                                         <Sun size={32} className="text-base-content/40" />
                                         <span className="text-[10px] font-black uppercase tracking-widest text-base-content/40">Field Light (Legacy)</span>
                                         <div className="w-4 h-4 bg-white rounded-none border border-base-200"></div>
                                      </button>
                                   </div>

                                   <div className="space-y-4 pt-6 border-t border-base-200">
                                      <ToggleSetting title="High Contrast Mode" description="Enhance visibility for direct sunlight operations" enabled={false} />
                                      <ToggleSetting title="Animations Protocol" description="Enable fluid interface transitions" enabled={true} />
                                   </div>
                                </div>
                            )}

                            {activeTab === 'system' && (
                                <div className="space-y-8">
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                        <StatusCard label="Relay Status" value="Online" icon={Cloud} color="text-emerald-500" />
                                        <StatusCard label="Data Latency" value="12ms" icon={HardDrive} color="text-emerald-500" />
                                        <StatusCard label="Field Sync" value="Verified" icon={RefreshCw} color="text-emerald-500" />
                                    </div>

                                    <div className="space-y-4 pt-4 border-t border-base-200">
                                        <ToggleSetting 
                                            title="Real-Time Telemetry" 
                                            description="Stream live animal sensor data to dashboard" 
                                            enabled={true} 
                                        />
                                        <ToggleSetting 
                                            title="Auto-Report Generation" 
                                            description="Automatically compile mission logs after completion" 
                                            enabled={true} 
                                        />
                                        <ToggleSetting 
                                            title="Offline Caching" 
                                            description="Enable local storage for remote area operations" 
                                            enabled={false} 
                                        />
                                    </div>
                                </div>
                            )}
                        </motion.div>
                    </AnimatePresence>
                    
                    {/* FOOTER ADVISORY */}
                    <div className="px-10 py-6 bg-base-200/20 border-t border-base-200 flex items-center gap-4">
                       <Info size={16} className="text-emerald-600" />
                       <p className="text-[9px] font-bold text-base-content/40 uppercase tracking-widest">
                          Configuration changes require municipal sync authorization. Technical logs are recorded.
                       </p>
                    </div>
                </div>
            </div>
        </div>
    );
};

const StatusCard = ({ label, value, icon: Icon, color }) => (
    <div className="bg-base-200/30 p-6 rounded-none border border-base-200">
        <div className="w-10 h-10 rounded-none bg-base-100 flex items-center justify-center shadow-sm border border-base-200 mb-4">
            <Icon className={color} size={18} />
        </div>
        <p className="text-[9px] font-black text-base-content/30 uppercase tracking-widest">{label}</p>
        <p className="text-lg font-black text-base-content mt-1 uppercase tracking-tighter">{value}</p>
    </div>
);

const ToggleSetting = ({ title, description, enabled }) => {
    const [isOn, setIsOn] = useState(enabled);
    return (
        <div className="flex items-center justify-between p-6 bg-base-200/30 border border-base-200 rounded-none transition-all hover:bg-base-200/50">
            <div>
                <h4 className="text-[11px] font-black text-base-content uppercase tracking-widest">{title}</h4>
                <p className="text-[10px] font-medium text-base-content/40 mt-1 uppercase tracking-tight">{description}</p>
            </div>
            <button 
                onClick={() => setIsOn(!isOn)}
                className={`w-12 h-6 rounded-none transition-all relative ${isOn ? 'bg-emerald-600' : 'bg-base-300'}`}
            >
                <div className={`absolute top-1 w-4 h-4 bg-white rounded-none transition-all ${isOn ? 'right-1' : 'left-1'} shadow-md`} />
            </button>
        </div>
    );
};

export default Settings;
