/**
 * Reset all pages to clean stubs except DashboardTechnician.jsx
 * Run with: node reset-pages.js
 */
import { writeFileSync, readdirSync } from 'fs';
import { join } from 'path';

const BASE = 'C:/Users/Acer/Documents/BreedSmart_FrontEnd2/web/src/pages';

// [folder, filename, display title]
const PAGES = [
  // public
  ['', 'FarmerDashboard.jsx', 'Farmer Dashboard'],
  // admin
  ['admin', 'Dashboard.jsx',        'Admin Dashboard'],
  ['admin', 'Technicians.jsx',       'Technicians'],
  ['admin', 'TechnicianProfile.jsx', 'Technician Profile'],
  ['admin', 'Livestock.jsx',         'Livestock'],
  ['admin', 'LivestockProfile.jsx',  'Livestock Profile'],
  ['admin', 'Inseminations.jsx',     'Inseminations'],
  ['admin', 'Users.jsx',             'Users'],
  ['admin', 'Settings.jsx',          'Settings'],
  ['admin', 'Reports.jsx',           'Reports'],
  // technician (skip DashboardTechnician)
  ['technician', 'Analytics.jsx',         'Analytics'],
  ['technician', 'Animals.jsx',           'Livestock Registry'],
  ['technician', 'BreedingLedger.jsx',    'Breeding Ledger'],
  ['technician', 'FarmerProfile.jsx',     'Farmer Profile'],
  ['technician', 'FarmersDirectory.jsx',  'Farmer Registry'],
  ['technician', 'FieldNotes.jsx',        'Field Notes'],
  ['technician', 'Health.jsx',            'Health Ledger'],
  ['technician', 'HealthMap.jsx',         'GIS Field Hub'],
  ['technician', 'Inseminations.jsx',     'Inseminations Log'],
  ['technician', 'Profile.jsx',           'My Profile'],
  ['technician', 'Reports.jsx',           'Field Reports'],
  ['technician', 'Requests.jsx',          'Task Requests'],
  ['technician', 'RouteOptimizer.jsx',    'Route Optimizer'],
  ['technician', 'Schedule.jsx',          'Daily Schedule'],
  ['technician', 'TestModalPage.jsx',     'Test Modal'],
  ['technician', 'WalkInInsemination.jsx','Walk-In AI'],
];

const stub = (title, folder, file) => {
  const fnName = file.replace('.jsx', '');
  return `const ${fnName} = () => (
  <div className="flex-1 flex flex-col h-screen overflow-y-auto bg-slate-50">
    <header className="bg-white border-b border-slate-200 px-8 h-16 flex items-center flex-shrink-0">
      <div>
        <h1 className="text-lg font-black text-slate-900 leading-none">${title}</h1>
        <p className="text-[11px] text-slate-400 mt-0.5 font-medium">This page is ready to be designed.</p>
      </div>
    </header>
    <main className="flex-1 p-8 flex items-center justify-center">
      <div className="text-center space-y-3">
        <div className="w-16 h-16 rounded-3xl bg-slate-100 flex items-center justify-center mx-auto text-2xl">📋</div>
        <h2 className="text-xl font-black text-slate-800">${title}</h2>
        <p className="text-sm text-slate-400 max-w-xs mx-auto">
          Start fresh — this page has no content yet. Build your design here.
        </p>
      </div>
    </main>
  </div>
);
export default ${fnName};
`;
};

let count = 0;
for (const [folder, file, title] of PAGES) {
  const dir  = folder ? join(BASE, folder) : BASE;
  const path = join(dir, file);
  writeFileSync(path, stub(title, folder, file), 'utf8');
  console.log(`✓ Reset: ${folder ? folder + '/' : ''}${file}`);
  count++;
}

console.log(`\nDone. ${count} pages reset to clean stubs.`);
