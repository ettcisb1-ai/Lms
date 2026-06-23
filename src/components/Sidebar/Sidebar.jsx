import React, { useState } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, Users, BookOpen, FileText, Settings, Bell,
  ChevronDown, Grid, CreditCard, BarChart3, UserCheck,
  BookCopy, FolderOpen, Tag,
  PieChart, LineChart, TrendingUp, PlayCircle, DollarSign,
  Download, BookMarked, Crosshair, BarChart2,
  BellRing, BellOff, Clock, Send
} from 'lucide-react';
import './Sidebar.css';

const NAV = [
  {
    section: 'OVERVIEW',
    items: [
      { label: 'Dashboard', icon: LayoutDashboard, to: '/admin/dashboard' },
    ]
  },
  {
    section: 'CONTENT',
    items: [
      {
        label: 'Courses', icon: BookOpen, children: [
          { label: 'All Courses', icon: BookCopy, to: '/admin/courses' },
          { label: 'Categories', icon: FolderOpen, to: '/admin/categories' },
          { label: 'Videos', icon: PlayCircle, to: '/admin/videos' },
        ]
      },
    ]
  },
  {
    section: 'MANAGEMENT',
    items: [
      {
        label: 'Users', icon: Users, children: [
          { label: 'All Users', icon: UserCheck, to: '/admin/users' },
          {
            label: 'Progress', icon: Crosshair, to: '/admin/progress', children: [
              { label: 'Dashboard Overview', icon: LayoutDashboard, to: '/admin/progress', tab: 'dashboard' },
              { label: 'Per-User Progress', icon: Users, to: '/admin/progress', tab: 'user' },
              { label: 'Per-Course Progress', icon: BookOpen, to: '/admin/progress', tab: 'course' },
              // { label: 'Reports & Exports', icon: Download, to: '/admin/progress', tab: 'reports' },
            ]
          },
        ]
      },
      {
        label: 'Subscriptions', icon: CreditCard, children: [
          { label: 'Plans & Billing', icon: CreditCard, to: '/admin/subscriptions' },
        ]
      },
      {
        label: 'Notifications', icon: Bell, children: [
          { label: 'Broadcast', icon: Send, to: '/admin/notifications', tab: 'broadcast' },
          // { label: 'New Content Alerts', icon: BellRing, to: '/admin/notifications', tab: 'content' },
          // { label: 'Expiry Reminders', icon: Clock, to: '/admin/notifications', tab: 'expiry' },
          { label: 'History', icon: BellOff, to: '/admin/notifications', tab: 'history' },
        ]
      },
    ]
  },
  // {
  //   section: 'REPORTS',
  //   items: [
  //     {
  //       label: 'Analytics', icon: BarChart3, children: [
  //         { label: 'User Analytics', icon: PieChart, to: '/admin/analytics', tab: 'user' },
  //         { label: 'Course Analytics', icon: BookMarked, to: '/admin/analytics', tab: 'course' },
  //         { label: 'Revenue Analytics', icon: DollarSign, to: '/admin/analytics', tab: 'revenue' },
  //         { label: 'Video Analytics', icon: PlayCircle, to: '/admin/analytics', tab: 'video' },
  //       ]
  //     },
  //     { label: 'Reports', icon: FileText, to: '/admin/reports' },
  //   ]
  // },
  {
    section: 'SYSTEM',
    items: [
      { label: 'Settings', icon: Settings, to: '/admin/settings' },
    ]
  },
];

export const SidebarTabContext = React.createContext({});

const Sidebar = ({ isCollapsed, onTabChange }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [openItems, setOpenItems] = useState({
    'Users': true,
    'Subscriptions': false,
    'Notifications': false,
    'Analytics': false,
    'Courses': false,
    'Video Library': false,
    'Progress': false,
    'Plans & Billing': false,
  });

  const toggle = (label) => setOpenItems(prev => ({ ...prev, [label]: !prev[label] }));

  const handleTabLink = (item) => {
    navigate(item.to);
    if (item.tab && onTabChange) onTabChange(item.to, item.tab);
  };

  const renderItems = (items, depth = 0) => items.map(item => {
    const Icon = item.icon;
    const isOpen = openItems[item.label];

    // Tab-link leaf (no children, has tab)
    if (item.tab && !item.children) {
      return (
        <button
          key={item.label + item.tab}
          className={`nav-child-item depth-${depth}`}
          onClick={() => handleTabLink(item)}
          style={{ paddingLeft: depth > 1 ? `${(depth) * 16 + 14}px` : undefined }}
        >
          <span className="child-dot" />
          <Icon size={13} />
          {!isCollapsed && <span>{item.label}</span>}
        </button>
      );
    }

    // Plain NavLink leaf (no children, no tab)
    if (!item.children) {
      return (
        <NavLink
          key={item.label}
          to={item.to}
          end
          className={({ isActive }) =>
            depth === 0
              ? `nav-item ${isActive ? 'active' : ''}`
              : `nav-child-item depth-${depth} ${isActive ? 'active' : ''}`
          }
          style={depth > 1 ? { paddingLeft: `${depth * 16 + 14}px` } : undefined}
        >
          {depth > 0 && <span className="child-dot" />}
          <Icon size={depth === 0 ? 18 : 13} />
          {!isCollapsed && <span>{item.label}</span>}
        </NavLink>
      );
    }

    // Expandable parent
    const childActive = item.children?.some(c =>
      c.to === location.pathname || c.children?.some(cc => cc.to === location.pathname)
    );

    return (
      <div key={item.label}>
        <button
          className={`nav-item nav-parent ${childActive ? 'active' : ''} ${depth > 0 ? `nav-child-parent depth-${depth}` : ''}`}
          onClick={() => toggle(item.label)}
          style={depth > 0 ? { paddingLeft: `${depth * 14 + 10}px` } : undefined}
        >
          <Icon size={depth === 0 ? 18 : 14} />
          {!isCollapsed && (
            <>
              <span>{item.label}</span>
              <ChevronDown size={13} className={`nav-chevron ${isOpen ? 'open' : ''}`} />
            </>
          )}
        </button>

        {/* Animated wrapper — always rendered, height animated via CSS */}
        <div className={`nav-children-wrapper ${isOpen && !isCollapsed ? 'open' : ''}`}>
          <div className={`nav-children depth-${depth}`}>
            {renderItems(item.children, depth + 1)}
          </div>
        </div>
      </div>
    );
  });

  return (
    <aside className={`sidebar ${isCollapsed ? 'collapsed' : ''}`}>
      <div className="sidebar-logo">
        <div className="logo-icon">L</div>
        <div className="logo-text">
          <span className="brand-name">LMS Portal</span>
          <span className="brand-sub">DASHBOARD</span>
        </div>
      </div>

      <div className="sidebar-sections">
        {NAV.map(({ section, items }) => (
          <div key={section} className="sidebar-section">
            {!isCollapsed && <h3 className="section-title">{section}</h3>}
            <nav className="sidebar-nav">
              {renderItems(items, 0)}
            </nav>
          </div>
        ))}
      </div>

      <div className="sidebar-footer">
        <div className="user-profile">
          <div className="user-avatar">A</div>
          <div className="user-info">
            <span className="user-name">Admin</span>
            <span className="user-role">Administrator</span>
          </div>
          <button
            className="logout-btn"
            onClick={() => {
              if (window.confirm('Are you sure you want to logout?')) {
                localStorage.removeItem('lms_user_role');
                localStorage.removeItem('lms_token');
                localStorage.removeItem('lms_admin_profile');
                navigate('/login');
              }
            }}
            title="Logout"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
              <polyline points="16 17 21 12 16 7"></polyline>
              <line x1="21" y1="12" x2="9" y2="12"></line>
            </svg>
          </button>
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;