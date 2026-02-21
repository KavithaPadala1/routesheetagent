import React from 'react';
import './TimeSlots.css';

const timeSlots = [
  { startTime: "09:00", endTime: "09:15" },
  { startTime: "09:15", endTime: "09:30" },
  { startTime: "09:30", endTime: "09:45" },
  { startTime: "09:45", endTime: "10:00" },
  { startTime: "19:00", endTime: "19:15" },
  { startTime: "19:15", endTime: "19:30" },
  { startTime: "19:30", endTime: "19:45" },
  { startTime: "19:45", endTime: "20:00" }
];

const TimeSlots = () => {
  return (
    <div className="time-slots-container">
      {timeSlots.map((slot, index) => (
        <div key={index} className="time-slot">
          <div>{slot.startTime}</div>
        </div>
      ))}
    </div>
  );
}

export default TimeSlots;
