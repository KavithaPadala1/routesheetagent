import React, { useState } from 'react';
import { Button, TextField, Typography, Box } from '@mui/material';
import OtpInput from './OtpInput';

const VerificationDialogInline = ({
  open,
  onClose,
  onSubmitDetails,
  onVerifyOtp,
  onResendOtp,
  isOtpStep,
  timer,
  otpHitCount,
  error,
}) => {
  const [name, setName] = useState(localStorage.getItem('name') || '');
  const [phone, setPhone] = useState(localStorage.getItem('phone') || '');
  const [otp, setOtp] = useState('');
  const [nameError, setNameError] = useState('');
  const [phoneError, setPhoneError] = useState('');

  const handleDetailsSubmit = () => {
    let valid = true;
    if (!name) {
      setNameError('Name is required');
      valid = false;
    } else {
      setNameError('');
    }
    if (!/^\d{10}$/.test(phone)) {
      setPhoneError('Phone number must be 10 digits');
      valid = false;
    } else {
      setPhoneError('');
    }
    if (valid) {
      onSubmitDetails(name, phone);
    }
  };

  const handleResendOTP = () => {
    onResendOtp(name, phone);
  };

  const handleOtpSubmit = () => {
    onVerifyOtp(otp);
  };

  const handlePhoneChange = (e) => {
    const value = e.target.value;
    if (/^\d*$/.test(value)) {
      setPhone(value);
    }
  };

  const handleKeyDown = (e) => {
    console.log("hkOSAm")
    if (e.key === 'Enter') {
      e.preventDefault();
      if (isOtpStep) {
        handleOtpSubmit();
      } else {
        handleDetailsSubmit();
      }
    }
  };

  const handleOtpComplete = (filledOtp) => {
    console.log('OTP Entered:', filledOtp);
    onVerifyOtp(filledOtp);
  };


  if (!open) return null;

  return (
    <Box sx={{ padding: 1, borderRadius: 1 }}>
      <Box sx={{ textAlign: 'center', marginBottom: 1 }}>
        <Typography variant="h5" sx={{ fontWeight: 'bold' }}>
          Verification
        </Typography>
      </Box>
      {!isOtpStep ? (
        <>
          <TextField
            autoFocus
            margin="dense"
            label="Name"
            type="text"
            fullWidth
            variant="filled"
            value={name}
            size="small"
            onChange={(e) => setName(e.target.value)}
            onKeyDown={handleKeyDown}
            sx={{
              borderRadius: 2,
              backgroundColor: 'white',
              marginBottom: 1,
              '& .MuiOutlinedInput-root': {
                '& fieldset': {
                  borderColor: 'white',
                  borderRadius: '12px',
                },
                '&:hover fieldset': {
                  borderColor: 'white',
                },
                '&.Mui-focused fieldset': {
                  borderColor: 'white',
                },
              },
              '& .MuiInputLabel-root': {
                fontSize: '0.875rem',
              },
            }}
          />
          {nameError && <Typography style={{ fontSize: '0.875rem', color: 'red' }}>{nameError}</Typography>}
          <TextField
            margin="dense"
            label="Phone"
            type="tel"
            fullWidth
            variant="filled"
            value={phone}
            onChange={handlePhoneChange}
            onKeyDown={handleKeyDown}
            size="small"
            InputProps={{ inputProps: { maxLength: 10, pattern: "[0-9]*" } }}
            sx={{
              backgroundColor: 'white',
              borderRadius: 2,
              marginBottom: 0,
              '& .MuiOutlinedInput-root': {
                '& fieldset': {
                  borderColor: 'white',
                  borderRadius: '12px',
                },
                textWrap:'nowrap',
                '&:hover fieldset': {
                  borderColor: 'white',
                },
                '&.Mui-focused fieldset': {
                  borderColor: 'white',
                },
              },
              '& .MuiInputLabel-root': {
                fontSize: '0.875rem',
              },
            }}
          />
          {phoneError && <Typography style={{ fontSize: '0.875rem', color: 'red' }}>{phoneError}</Typography>}
          {error && <Typography style={{ fontSize: '0.875rem', color: 'red' }}>{error}</Typography>}
          <Box sx={{ display: 'flex', justifyContent: 'center', marginTop: 1 }}>
            <Button
              onClick={handleDetailsSubmit}
              variant="contained"
              sx={{
                color: 'white',
                backgroundColor: '#4a90e2',
                '&:hover': {
                  backgroundColor: '#4a90e2',
                },
                padding: '0.5rem 0.5rem',
                borderRadius: '12px',
                fontSize: '1rem',
                textTransform:'none'
              }}
            >
              {otpHitCount >= 1 ? 'Resend OTP' : 'Send OTP'}
            </Button>
          </Box>
        </>
      ) : (
        <Box sx={{ alignItems: 'center' }}>
          <Typography style={{ alignSelf: 'center', fontSize: '0.7rem' }}>
            OTP has been sent to +91-{localStorage.getItem('phone')}
          </Typography>
          <OtpInput
            value={otp}
            onChange={(value) => setOtp(value)}
            timer={timer}
            otpHitCount={otpHitCount}
            onKeyDown={handleKeyDown} 
            onResend={onResendOtp}
            onOtpComplete={handleOtpComplete}
            sx={{
              marginTop: 1,
              '& .MuiInputBase-root': {
                '& fieldset': {
                  borderColor: '#1976d2',
                  borderRadius: '12px',
                },
                '&:hover fieldset': {
                  borderColor: '#115293',
                },
                '&.Mui-focused fieldset': {
                  borderColor: '#0d47a1',
                },
              },
            }}
          />
          {error && (
            <Typography
              style={{ fontSize: '0.875rem', color: 'red' }}
            >
              {error}
            </Typography>
          )}
          <Box
            sx={{
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              marginTop: 1,
            }}
          >
            <Button
              onClick={handleOtpSubmit}
              variant="contained"
              size="small"
              sx={{
                backgroundColor: 'white',
                '&:hover': {
                  backgroundColor: '#4a90e2',
                },
                marginBottom: '10px',
                fontWeight: 'bold',
                color: 'black',
                padding: '0.5rem 0.5rem',
                borderRadius: '12px',
                fontSize: '0.8rem',
              }}
            >
              Verify OTP
            </Button>
            <Button
              onClick={handleResendOTP}
              variant="outlined"
              size="small"
              sx={{
                '&:hover': {
                  backgroundColor: '#4a90e2',
                },
                fontWeight: 'bold',
                color: 'black',
                padding: '0.5rem 0.5rem',
                borderRadius: '12px',
                fontSize: '0.8rem',
              }}
            >
              Resend OTP
            </Button>
          </Box>
        </Box>
      )}
    </Box>
  );
};

export default VerificationDialogInline;
