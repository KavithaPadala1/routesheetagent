import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  TextField,
  Button,
  Box,
  Typography,
  Divider,
  List,
  ListItem,
} from '@mui/material';
import { Icon } from '@iconify/react';
import { styled } from '@mui/system';
import { grey } from '@mui/material/colors';

const DescriptionContainer = styled(Box)(({ theme }) => ({
  display: 'flex',
  flexDirection: 'column',
  marginTop: theme.spacing(1),
  position: 'relative',
  font: 'inherit',
}));

const StyledInputAdornment = styled(Box)(({ theme }) => ({
  padding: theme.spacing(1),
  backgroundColor: 'lightgray',
  borderRadius: '10px',
  marginBottom: theme.spacing(1),
  width: '100%',
}));

const CustomDialogContent = styled(DialogContent)(({ theme }) => ({
  backgroundColor: '#efede7',
  '&::-webkit-scrollbar': {
    width: '0px',
  },
  '&::-webkit-scrollbar-thumb': {
    backgroundColor: grey[500],
    borderRadius: '10px',
    border: `3px solid ${grey[200]}`,
  },
  '&::-webkit-scrollbar-track': {
    backgroundColor: grey[200],
    borderRadius: '10px',
  },
}));

const CallbackDialogAppointment = ({ open, onClose }) => {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const storedName = localStorage.getItem('name');
    const storedPhone = localStorage.getItem('phone');
    if (storedName) setName(storedName);
    if (storedPhone) setPhone(storedPhone);
  }, []);

  const handleRequestCallback = async () => {
    setLoading(true);
    const data = {
      "Patient_first_Name": name,
      "Patient_last_Name": "",
      "Mobile_Phone": phone,
      "User_Patient_comments": `User Details - ${localStorage.getItem("user_details")} Comments - ${description}`,
    };

    try {
      const response = await fetch('https://api-1-vsa-dev.azurewebsites.net/requestcallback/create-webcallback-lead', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });
      let responseresult = await response.json();

      if (response.ok) {
        alert("Thank you for your information. Your appointment request has been successfully created. Our customer care specialists will get in touch with you shortly.");
        onClose();
        sessionStorage.removeItem("chatbotMessages");
        localStorage.removeItem("phone")
        localStorage.removeItem("name")
        localStorage.removeItem("isOtpStep")
        localStorage.removeItem("timer")
        localStorage.removeItem("API_URL")
        localStorage.removeItem("user_details")
        localStorage.removeItem("isVerified")
        localStorage.removeItem("otpHitCount")
        localStorage.removeItem("isShowForm")
        localStorage.removeItem("isUserDetailsSent")
        localStorage.removeItem("isInputFieldDisabled")
        window.location.reload();
      } else {
        alert('Failed to request a callback. Please try again.');
      }
    } catch (error) {
      alert('Failed to request a callback. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleDescriptionChange = (e) => {
    setDescription(e.target.value);
  };

  const userDetails = JSON.parse(localStorage.getItem("user_details") || '{}');
  const filteredUserDetails = Object.fromEntries(
    Object.entries(userDetails).filter(([key]) => key !== 'matched_data')
    .filter(([key]) => key !== 'session_id')
    .filter(([key]) => key !== 'token')
  );

  return (
    <Dialog open={open} onClose={onClose} style={{ borderRadius: '20px' }}>
      <DialogTitle sx={{ fontWeight: 'bold', fontSize: '1.5rem', fontFamily: 'inherit', backgroundColor: '#efede7' }}>
        Request a Callback
        <Icon icon="maki:cross" onClick={onClose} width="25px" height="25px" style={{ position: 'absolute', right: 16, top: 16, color: 'gray', cursor: 'pointer' }} />
      </DialogTitle>
      <CustomDialogContent>
        <DialogContentText sx={{ fontFamily: 'inherit' }}>
          Fill out the form below to request a callback.
        </DialogContentText>
        <Box component="form" sx={{ mt: 1, fontFamily: 'inherit' }}>
          <TextField
            fullWidth
            label="Name"
            value={name}
            margin="normal"
            size="small"
            sx={{ fontFamily: 'inherit', backgroundColor: '#efede7', borderRadius: 1 }}
            InputProps={{
              readOnly: true,
            }}
          />
          <TextField
            fullWidth
            label="Phone"
            value={phone}
            margin="normal"
            size="small"
            sx={{ fontFamily: 'inherit', backgroundColor: '#efede7', borderRadius: 1 }}
            InputProps={{
              readOnly: true,
            }}
          />
            <DescriptionContainer>
            {localStorage.getItem("user_details") ?

            <StyledInputAdornment >
              <List>
                {Object.entries(filteredUserDetails).map(([key, value]) => (
                  <ListItem key={key} sx={{ display: 'flex', alignItems: 'flex-start', paddingLeft: '0px', paddingBottom: '2px' }}>
                    <Icon icon="ph:dot-duotone" style={{ marginRight: '4px', fontSize: '1rem', color: '#555' }} />
                    <Typography variant="body2" sx={{ fontFamily: 'inherit', fontWeight: 'bolder', whiteSpace: 'pre-wrap', fontSize: '0.8rem' }}>
                      {`${key}: `}
                      <Typography component="span" sx={{ fontFamily: 'inherit', fontWeight: 'normal', wordWrap: 'break-word', fontSize: '0.8rem'  }}>
                        {value === null ? 'N/A' : value}
                      </Typography>
                    </Typography>
                  </ListItem>
                ))}
              </List>
            </StyledInputAdornment> : <></>}
            <Divider />
            <TextField
              fullWidth
              label="Description"
              value={description}
              size="small"
              onChange={handleDescriptionChange}
              margin="normal"
              sx={{ fontFamily: 'inherit', borderRadius: 2 }}
              multiline
              rows={3}
            />
          </DescriptionContainer>
        </Box>
      </CustomDialogContent>
      <DialogActions sx={{ backgroundColor: '#efede7' }}>
        <Button onClick={onClose} color="primary" sx={{ fontWeight: 'bold', fontFamily: 'inherit' }}>
          Cancel
        </Button>
        <Button
          onClick={handleRequestCallback}
          color="primary"
          sx={{ fontWeight: 'bold', borderRadius: '12px', fontFamily: 'inherit' }}
          variant="contained"
          disabled={loading}
        >
          {loading ? <><p>Requesting</p> <Icon icon="eos-icons:bubble-loading" width={15} height={15} color='#2065D1' /></> : 'Request a Callback'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default CallbackDialogAppointment;
