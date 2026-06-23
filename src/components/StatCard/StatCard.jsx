import React from 'react';
import './StatCard.css';

const StatCard = ({ title, value, subtext, icon, trend, type = 'default' }) => {
  return (
    <div className="stat-card">
      <div className="stat-header">
        <div className={`stat-icon-wrapper ${type}`}>
          {icon}
        </div>
        {trend && (
          <div className="stat-trend">
            ^ {trend}
          </div>
        )}
      </div>
      <div className="stat-value">{value}</div>
      <div className="stat-title">{title}</div>
      {subtext && <div className="stat-subtext">{subtext}</div>}
    </div>
  );
};

export default StatCard;
