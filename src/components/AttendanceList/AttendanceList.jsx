import React from 'react';
import './AttendanceList.css';

const attendees = [
  { id: 1, name: 'Ali Nizami', initials: 'AN', status: 'Out', color: 'blue' },
  { id: 2, name: 'Adnan', initials: 'A', status: 'Out', color: 'purple' },
  { id: 3, name: 'Saad', initials: 'S', status: 'Out', color: 'pink' },
  { id: 4, name: 'Hadsan Ahmed', initials: 'HA', status: 'Out', color: 'yellow' },
  { id: 5, name: 'Babar Nisar', initials: 'BN', status: 'Out', color: 'green' },
  { id: 6, name: 'Uzair Ahmed', initials: 'UA', status: 'Out', color: 'red' },
];

const AttendanceList = () => {
  return (
    <div className="attendance-list-container">
      <div className="attendance-header">
        <div>
          <h3 className="attendance-title">Attendance Today</h3>
          <p className="attendance-subtitle">0 of 28 online</p>
        </div>
        <div className="live-badge">
          <span className="dot"></span> Live
        </div>
      </div>

      <div className="attendee-list">
        {attendees.map(user => (
          <div key={user.id} className="attendee-item">
            <div className={`attendee-avatar ${user.color}`}>
              {user.initials}
            </div>
            <div className="attendee-name">{user.name}</div>
            <div className="attendee-line">
              <div className="attendee-line-fill"></div>
            </div>
            <div className="attendee-status out">{user.status}</div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default AttendanceList;
