import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

const getTitleForPath = (path) => {
  // Technician Routes
  if (path.startsWith('/technician/dashboard')) return 'Overview | Technician Portal';
  if (path.startsWith('/technician/farmers')) return 'Farmers | Technician Portal';
  if (path.startsWith('/technician/animals')) return 'Animals | Technician Portal';
  if (path.startsWith('/technician/requests')) return 'Service Requests | Technician Portal';
  if (path.startsWith('/technician/schedule')) return 'Schedule | Technician Portal';
  if (path.startsWith('/technician/ledger')) return 'Breeding and Pregnancy Records | Technician Portal';
  if (path.startsWith('/technician/inseminations')) return 'AI Services | Technician Portal';
  if (path.startsWith('/technician/newborns')) return 'Calving Records | Technician Portal';
  if (path.startsWith('/technician/health-map')) return 'Map and Locations | Technician Portal';
  if (path.startsWith('/technician/health')) return 'Health Records | Technician Portal';
  if (path.startsWith('/technician/field-notes')) return 'Notes and Photos | Technician Portal';
  if (path.startsWith('/technician/reports')) return 'Reports and Exports | Technician Portal';
  if (path.startsWith('/technician/analytics')) return 'My Performance | Technician Portal';
  if (path.startsWith('/technician/moowie')) return 'Ask Moowie | Technician Portal';
  if (path.startsWith('/technician/settings')) return 'Settings | Technician Portal';
  if (path.startsWith('/technician/walk-in')) return 'Add AI Service Record | Technician Portal';
  if (path.startsWith('/technician/profile')) return 'My Profile | Tech Portal';
  
  // Admin Routes
  if (path.startsWith('/admin/dashboard')) return 'Admin Dashboard | Iloilo Agri';
  if (path.startsWith('/admin/technicians')) return 'Technicians | Admin';
  if (path.startsWith('/admin/livestock')) return 'Livestock | Admin';
  if (path.startsWith('/admin/inseminations')) return 'AI Records | Admin';
  if (path.startsWith('/admin/users')) return 'User Management | Admin';
  if (path.startsWith('/admin/settings')) return 'Settings | Admin';
  if (path.startsWith('/admin/reports')) return 'Reports | Admin';

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
