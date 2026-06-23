import React from 'react';
// import { Bell } from 'lucide-react';
import './Header.css';

const Header = () => {
  const currentDate = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });

  return (
    <header className="dashboard-header">
      <div className="dashboard-header-left">
        <h1 className="welcome-title">Welcome Admin!</h1>
        <p className="welcome-date">{currentDate}</p>
      </div>

      <div className="header-right">
        {/* <div className="bell-wrapper">
          <button className="notification-btn">
            <Bell size={18} />
          </button>
          <span className="bell-badge"></span>
        </div> */}
        {/* <div className="header-admin">
          <span className="admin-text">Admin</span>
        </div> */}
      </div>
    </header>
  );
};

export default Header;