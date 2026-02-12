import React from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';
import { UserButton } from "@clerk/clerk-react";
import { 
    LayoutDashboard, 
    Users, 
    Tractor, 
    Syringe, 
    Settings as SettingsIcon,
    Menu
} from 'lucide-react';

const Layout = () => {
    const location = useLocation();

    const navItems = [
        { name: 'Dashboard', path: '/dashboard', icon: <LayoutDashboard size={24} /> },
        { name: 'Technicians', path: '/technicians', icon: <Users size={24} /> },
        { name: 'Livestock', path: '/livestock', icon: <Tractor size={24} /> },
        { name: 'Inseminations', path: '/inseminations', icon: <Syringe size={24} /> },
        { name: 'Users', path: '/users', icon: <Users size={24} /> },
        { name: 'Settings', path: '/settings', icon: <SettingsIcon size={24} /> },
    ];

    return (
        <div className="drawer lg:drawer-open font-['Outfit'] bg-[#F4F5F7]">
            <input id="my-drawer-2" type="checkbox" className="drawer-toggle" />
            <div className="drawer-content flex flex-col min-h-screen">
                {/* Navbar (Mobile) */}
                <div className="navbar bg-base-100 shadow-sm lg:hidden">
                    <div className="flex-none">
                        <label htmlFor="my-drawer-2" className="btn btn-square btn-ghost drawer-button">
                            <Menu size={24} />
                        </label>
                    </div>
                    <div className="flex-1">
                        <a className="btn btn-ghost text-xl font-bold">BreedSmart Portal</a>
                    </div>
                    <div className="flex-none">
                         <UserButton />
                    </div>
                </div>

                {/* Page Content */}
                <main className="p-6 lg:p-10">
                    <div className="hidden lg:flex justify-between items-center mb-8">
                        <h2 className="text-3xl font-bold text-[#1A1A1A]">
                            {navItems.find(item => item.path === location.pathname)?.name || 'Admin Panel'}
                        </h2>
                        <div className="flex items-center gap-4">
                            <UserButton showName />
                        </div>
                    </div>
                    <Outlet />
                </main>
            </div> 
            <div className="drawer-side z-20">
                <label htmlFor="my-drawer-2" aria-label="close sidebar" className="drawer-overlay"></label> 
                <div className="menu p-6 w-72 min-h-full bg-white text-base-content flex flex-col">
                    {/* Sidebar Header */}
                    <div className="mb-10 px-2 flex items-center gap-3">
                         <img src="/logo.png" alt="BreedSmart Logo" className="w-10 h-10 object-contain" />
                         <div className="text-xl font-bold tracking-tight text-[#1A1A1A]">BreedSmart Portal</div>
                    </div>
                    
                    {/* Navigation Items - Grouped roughly to match "Main Menu" vs "Others" idea */}
                    <div className="flex flex-col gap-1 mb-6">
                        <div className="px-4 mb-2 text-xs font-semibold text-gray-400 uppercase tracking-wider">Main Menu</div>
                        {navItems.slice(0, 4).map((item) => (
                            <Link 
                                key={item.path}
                                to={item.path} 
                                className={`flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-xl transition-all duration-200
                                    ${location.pathname === item.path 
                                        ? 'bg-[#074033] text-white shadow-md' 
                                        : 'text-gray-500 hover:text-[#074033] hover:bg-[#074033]/5'
                                    }`}
                            >
                                {React.cloneElement(item.icon, { size: 20 })}
                                {item.name}
                            </Link>
                        ))}
                    </div>

                    <div className="flex flex-col gap-1">
                        <div className="px-4 mb-2 text-xs font-semibold text-gray-400 uppercase tracking-wider">Others</div>
                        {navItems.slice(4).map((item) => (
                            <Link 
                                key={item.path}
                                to={item.path} 
                                className={`flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-xl transition-all duration-200
                                    ${location.pathname === item.path 
                                        ? 'bg-[#074033] text-white shadow-md' 
                                        : 'text-gray-500 hover:text-[#074033] hover:bg-[#074033]/5'
                                    }`}
                            >
                                {React.cloneElement(item.icon, { size: 20 })}
                                {item.name}
                            </Link>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Layout;
