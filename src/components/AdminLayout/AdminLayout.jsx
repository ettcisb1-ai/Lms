import React, { useState, useCallback } from 'react';
import { Outlet, useNavigate, Navigate } from 'react-router-dom';
import Sidebar from '../Sidebar/Sidebar';
import Header from '../Header/Header';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import './AdminLayout.css';

// Global tab state — pages read this on mount
export const PendingTabContext = React.createContext({ tab: null, route: null });

const AdminLayout = () => {
  const token = localStorage.getItem('lms_token');
  const role = localStorage.getItem('lms_user_role');

  if (!token) {
    return <Navigate to="/login" replace />;
  }

  if (role !== 'admin') {
    return <Navigate to="/dashboard" replace />;
  }

  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [pendingTab, setPendingTab] = useState({ tab: null, route: null });
  const navigate = useNavigate();

  const handleTabChange = useCallback((route, tab) => {
    setPendingTab({ route, tab });
    navigate(route);
  }, [navigate]);

  const clearPendingTab = useCallback(() => {
    setPendingTab({ tab: null, route: null });
  }, []);

  return (
    <PendingTabContext.Provider value={{ ...pendingTab, clearPendingTab }}>
      <div className={`admin-layout ${isSidebarCollapsed ? 'collapsed' : ''}`}>
        <Sidebar isCollapsed={isSidebarCollapsed} onTabChange={handleTabChange} />

        <main className="admin-main">
          <button className="sidebar-toggle" onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}>
            {isSidebarCollapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
          </button>
          <Header />

          <div className="admin-content">
            <Outlet />
          </div>
        </main>
      </div>
    </PendingTabContext.Provider>
  );
};

export default AdminLayout;