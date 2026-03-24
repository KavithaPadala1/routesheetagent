import React, { useState, useEffect, useRef } from 'react';
import './OtpInput.css';
import { Icon } from '@iconify/react';
import config from '../botconfiguration.json';

const OtpInput = ({ length = 6, onChange = () => {}, timer, onOtpComplete }) => {
  const [otp, setOtp] = useState(new Array(length).fill(''));
  const [isValidating, setIsValidating] = useState(false);
  const [validationResult, setValidationResult] = useState(null);
  const inputs = useRef([]);

  const handleChange = (element, index) => {
    if (isNaN(element.value)) return;
    if (element.value === ' ') return;

    const newOtp = [...otp];
    newOtp[index] = element.value;
    setOtp(newOtp);

    onChange(newOtp.join(''));

    if (element.nextSibling && element.value) {
      element.nextSibling.focus();
    }
  };

  const handleBackspace = (element, index) => {
    if (element.previousSibling && !element.value) {
      element.previousSibling.focus();
    }
  };

  const handleEnterKey = (e) => {
    if (e.key === 'Enter') {
      const filledOtp = otp.join('');
      if (filledOtp.length === length) {
        onOtpComplete(filledOtp);
      }
    }
  };


  return (
    <div style={{ padding: '16px', maxWidth: '400px', margin: '0 auto', borderRadius: '10px'}}>
      <div className="otp-inputs" style={{ marginBottom: '10px' }}>
        {otp.map((data, index) => (
          <input
            key={index}
            type="text"
            inputMode="numeric"
            className="otp-input"
            value={data}
            maxLength="1"
            onChange={(e) => handleChange(e.target, index)}
            onKeyUp={(e) => e.key === 'Backspace' && handleBackspace(e.target, index)}
            onKeyDown={handleEnterKey}
            ref={(el) => (inputs.current[index] = el)}
          />
        ))}
      </div>
      {isValidating && <div style={{ fontSize: '0.7rem' }}>Validating...</div>}
      {validationResult && <div style={{ fontSize: '0.7rem' }}>{JSON.stringify(validationResult)}</div>}
      <div style={{ fontSize: '0.7rem', marginTop: '2px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span>OTP will be valid for {timer} seconds only.</span>
      </div>
    </div>
  );
};

export default OtpInput;
