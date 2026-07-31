import { Navigate } from 'react-router-dom';
import { useUser } from '@clerk/clerk-react';

import PublicNavbar from './landing/components/PublicNavbar';
import LandingHero from './landing/components/LandingHero';
import ValueStrip from './landing/components/ValueStrip';
import HowItWorks from './landing/components/HowItWorks';
import FarmerAppSection from './landing/components/FarmerAppSection';
import StaffPortalSection from './landing/components/StaffPortalSection';
import OtonCommunitySection from './landing/components/OtonCommunitySection';
import AppDownloadSection from './landing/components/AppDownloadSection';
import FinalCTA from './landing/components/FinalCTA';
import PublicFooter from './landing/components/PublicFooter';

export default function Landing() {
  const { isSignedIn, isLoaded, user } = useUser();

  if (isLoaded && isSignedIn) {
    const role = user?.publicMetadata?.role;
    if (role === 'admin') {
      return <Navigate to="/admin/dashboard" replace />;
    } else if (role === 'technician') {
      return <Navigate to="/technician/dashboard" replace />;
    } else if (role === 'farmer') {
      // Farmers do not have a web portal dashboard; redirect them to the app download page
      return <Navigate to="/download-app" replace />;
    }
  }

  return (
    <div className="font-['Outfit'] min-h-screen flex flex-col bg-[#FAF9F5] text-slate-900 antialiased selection:bg-[#EDF3E8] selection:text-[#074033]">
      <PublicNavbar />
      <main className="flex-1">
        <LandingHero />
        <ValueStrip />
        <HowItWorks />
        <FarmerAppSection />
        <StaffPortalSection />
        <OtonCommunitySection />
        <AppDownloadSection />
        <FinalCTA />
      </main>
      <PublicFooter />
    </div>
  );
}
