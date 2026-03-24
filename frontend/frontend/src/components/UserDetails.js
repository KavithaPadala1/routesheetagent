import React, { useState } from 'react';

const UserDetails = ({ onSubmit, defaultName, defaultPhone, otpHitCount }) => {
  const [name, setName] = useState(defaultName || '');
  const [phone, setPhone] = useState(defaultPhone || '');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleNameChange = (e) => {
    setName(e.target.value);
  };

  const handlePhoneChange = (e) => {
    const phoneValue = e.target.value;
    if (phoneValue.length <= 10 && /^[0-9]*$/.test(phoneValue)) {
      setPhone(phoneValue);
      setError('');
    } else {
      setError('Phone number must be 10 digits and contain only numbers.');
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (phone.length !== 10) {
      setError('Phone number must be exactly 10 digits.');
      return;
    }
    setIsSubmitting(true);
    onSubmit(name, phone, false);
    setIsSubmitting(false);
  };

  const handleResend = () => {
    onSubmit(name, phone, true);
  };

  return (
    <div style={{ padding: '16px', maxWidth: '400px', margin: '0 auto', backgroundColor: '#F9B919', borderRadius: '10px', boxShadow: '0 4px 8px rgba(0, 0, 0, 0.1)' }}>
      <form onSubmit={handleSubmit}>
        <div style={{ marginBottom: '16px' }}>
          <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', color: '#333' }}>Name</label>
          <input
            type="text"
            value={name}
            onChange={handleNameChange}
            style={{
              marginTop: '8px',
              display: 'block',
              width: '100%',
              padding: '10px 12px',
              border: '2px solid #ccc',
              borderRadius: '5px',
              boxShadow: 'inset 0 1px 3px rgba(0, 0, 0, 0.1)',
              fontSize: '16px',
              transition: 'border-color 0.3s',
              outline: 'none',
            }}
            onFocus={(e) => e.target.style.borderColor = '#4A90E2'}
            onBlur={(e) => e.target.style.borderColor = '#ccc'}
          />
        </div>
        <div style={{ marginBottom: '16px' }}>
          <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', color: '#333' }}>Phone</label>
          <input
            type="text"
            value={phone}
            onChange={handlePhoneChange}
            style={{
              marginTop: '8px',
              display: 'block',
              width: '100%',
              padding: '10px 12px',
              border: '2px solid #ccc',
              borderRadius: '5px',
              boxShadow: 'inset 0 1px 3px rgba(0, 0, 0, 0.1)',
              fontSize: '16px',
              transition: 'border-color 0.3s',
              outline: 'none',
            }}
            onFocus={(e) => e.target.style.borderColor = '#4A90E2'}
            onBlur={(e) => e.target.style.borderColor = '#ccc'}
          />
          {error && <p style={{ marginTop: '8px', fontSize: '14px', color: 'red' }}>{error}</p>}
        </div>
        <button
          type="submit"
          disabled={isSubmitting}
          style={{
            marginTop: '16px',
            width: '100%',
            padding: '10px 0',
            backgroundColor: isSubmitting ? '#ccc' : '#4A90E2',
            color: 'white',
            border: 'none',
            borderRadius: '5px',
            fontSize: '16px',
            cursor: isSubmitting ? 'not-allowed' : 'pointer',
            transition: 'background-color 0.3s',
            outline: 'none',
          }}
        >
          {isSubmitting ? 'Submitting...' : otpHitCount > 0 ? 'Resend OTP' : 'Submit'}
        </button>
        {success && <p style={{ marginTop: '8px', fontSize: '14px', color: 'green' }}>{success}</p>}
      </form>
    </div>
  );
};

export default UserDetails;
