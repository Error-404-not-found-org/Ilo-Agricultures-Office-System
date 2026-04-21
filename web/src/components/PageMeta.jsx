import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

const getTitleForPath = (path) => {
  // Technician Routes
  if (path.startsWith('/technician/dashboard')) return 'Dashboard | Tech Portal';
  if (path.startsWith('/technician/farmers')) return 'Farmers Directory | Tech Portal';
  if (path.startsWith('/technician/animals')) return 'Livestock Registry | Tech Portal';
  if (path.startsWith('/technician/inseminations')) return 'Inseminations | Tech Portal';
  if (path.startsWith('/technician/health')) return 'Health & Vaccines | Tech Portal';
  if (path.startsWith('/technician/walk-in')) return 'Walk-in Registration | Tech Portal';
  if (path.startsWith('/technician/profile')) return 'My Profile | Tech Portal';
  
  // Admin Routes
  if (path.startsWith('/dashboard')) return 'Admin Dashboard | Iloilo Agri';
  if (path.startsWith('/technicians')) return 'Technicians | Admin';
  if (path.startsWith('/livestock')) return 'Livestock | Admin';
  if (path.startsWith('/inseminations')) return 'AI Records | Admin';
  if (path.startsWith('/users')) return 'User Management | Admin';
  if (path.startsWith('/settings')) return 'Settings | Admin';

  // Default
  if (path === '/') return 'Welcome | Iloilo Agriculture';

  return 'Iloilo Agriculture System';
};

export default function PageMeta() {
  const location = useLocation();

  useEffect(() => {
    // Update Document Title
    document.title = getTitleForPath(location.pathname);

    // Update Browser Favicon using the logo.png from the public folder
    let link = document.querySelector("link[rel~='icon']");
    if (!link) {
      link = document.createElement('link');
      link.rel = 'icon';
      document.head.appendChild(link);
    }
    
    // Only update if it's not already pointing to logo.png to prevent unnecessary reloading
    const newIcon = '/logo.png';
    if (!link.href.endsWith(newIcon)) {
      link.href = newIcon;
    }

  }, [location.pathname]);

  return null;
}
