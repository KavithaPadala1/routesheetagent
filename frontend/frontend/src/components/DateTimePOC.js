import React, { useState } from 'react';
import { TextField, Button } from '@mui/material';
import { format } from 'date-fns';

function DateTimePickerPOC() {
  const [date, setDate] = useState('2024-09-11');
  const [time, setTime] = useState('10:50');
  const [result, setResult] = useState('');

  const handleDateChange = (event) => {
    setDate(event.target.value);
  };

  const handleTimeChange = (event) => {
    setTime(event.target.value);
  };

  const handleSubmit = () => {
    const formattedDateTime = `${date} ${time}`;
    setResult(formattedDateTime);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', width: '300px', margin: '0 auto' }}>
      <TextField
        label="Date"
        type="date"
        value={date}
        onChange={handleDateChange}
        InputLabelProps={{
          shrink: true,
        }}
      />
      <TextField
        label="Time"
        type="time"
        value={time}
        onChange={handleTimeChange}
        InputLabelProps={{
          shrink: true,
        }}
        inputProps={{
          step: 300, 
        }}
      />
      <Button variant="contained" onClick={handleSubmit}>
        Submit
      </Button>
      {result && (
        <div>
          <h3>Result:</h3>
          <p>{result}</p>
        </div>
      )}
    </div>
  );
}

export default DateTimePickerPOC;
