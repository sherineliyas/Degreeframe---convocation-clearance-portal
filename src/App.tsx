import { useState, useEffect } from 'react';
import { StudentPortal } from './components/StudentPortal';
import { FacultyPortal } from './components/FacultyPortal';
import { CoePortal } from './components/CoePortal';
import { SuperAdminPortal } from './components/SuperAdminPortal';
import { Navbar } from './components/Navbar';
import { parseHash, PortalRoute } from './utils/router';

export default function App() {
  const [activePortal, setActivePortalState] = useState<PortalRoute>(() => parseHash().portal);

  // Sync state with hash changes
  useEffect(() => {
    const handleHashChange = () => {
      const route = parseHash();
      setActivePortalState(route.portal);
    };

    // Default to /#/student if no hash or root hash is provided
    if (!window.location.hash || window.location.hash === '#' || window.location.hash === '#/') {
      window.location.hash = '#/student';
    } else {
      handleHashChange();
    }

    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 flex flex-col font-sans selection:bg-blue-100 selection:text-blue-900">
      {/* Top Navbar */}
      <Navbar activePortal={activePortal} />

      {/* Main Portal View */}
      <main className="flex-1 max-w-5xl w-full mx-auto px-4 sm:px-6 py-6 sm:py-8">
        {activePortal === 'superadmin' ? (
          <SuperAdminPortal />
        ) : activePortal === 'coe' ? (
          <CoePortal />
        ) : activePortal === 'faculty' ? (
          <FacultyPortal />
        ) : (
          <StudentPortal />
        )}
      </main>

      {/* Clean Footer */}
      <footer className="mt-auto border-t border-slate-200 bg-white py-4 text-center text-xs text-slate-500">
        <div className="max-w-5xl mx-auto px-4 text-center">
          <span>
            © DegreeFrame Convocation Photo Clearance Portal • Hindustan Institute of Technology & Science (HITS)
          </span>
        </div>
      </footer>
    </div>
  );
}
