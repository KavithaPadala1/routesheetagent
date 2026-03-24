import React, { useState, useEffect } from "react";
import { TextField, Autocomplete, Box, Typography, Button } from '@mui/material';

const DoctorSearch = ({ query, onSaveSelections, onSend }) => {
  const [data, setData] = useState([]);
  const [filteredData, setFilteredData] = useState([]);
  const [selectedValue, setSelectedValue] = useState('');

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await fetch('http://127.0.0.1:8000/db/filterdata', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            "query_name": "filterdoctors",
            "input": ""
          }),
        });
        const result = await response.json();
        setData(result);
      } catch (error) {
        console.error('Error fetching data:', error);
      }
    };

    fetchData();
  }, [query]);

  useEffect(() => {
    if (query === 'validatelocation') {
      setFilteredData([...new Set(data.map(doc => doc.location))]);
    } else if (query === 'validatespeciality') {
      setFilteredData([...new Set(data.map(doc => doc.specialityname))]);
    } else if (query === 'validatedoctor') {
      setFilteredData(data.map(doc => doc.doctorname));
    }
  }, [data, query]);

  const handleChange = (event, value) => {
    setSelectedValue(value);
    if (query === 'validatelocation') {
      onSaveSelections({ location: value });
    } else if (query === 'validatespeciality') {
      onSaveSelections({ speciality: value });
    } else if (query === 'validatedoctor') {
      onSaveSelections({ doctor: value });
    }
  };

  const handleSendClick = () => {
    const selectedOption = data.find(item => {
      if (query === 'validatelocation') {
        return item.location === selectedValue;
      } else if (query === 'validatespeciality') {
        return item.specialityname === selectedValue;
      } else if (query === 'validatedoctor') {
        return item.doctorname === selectedValue;
      }
      return null;
    });
    
    if (selectedOption) {
      const { locationid, doctorid, specialityid } = selectedOption;
      onSend({
        query,
        selectedValue,
        id: locationid || doctorid || specialityid
      });
    }
  };

  return (
    <Box sx={{ width: '100%', minWidth: "300px", margin: '0 auto', padding: 3, borderRadius: 2 }}>
      <Typography variant="h5" sx={{ marginBottom: 2, fontWeight: 'bold', fontFamily: 'inherit', textAlign: 'center', color: '#1976d2' }}>
        {`${query?.replace('validate', '')}`} Search
      </Typography>
      <Autocomplete
        value={selectedValue}
        onChange={handleChange}
        options={filteredData}
        renderInput={(params) => <TextField {...params} label={`Select ${query?.replace('validate', '')}`} variant="outlined" />}
        sx={{ marginBottom: 2 }}
        size='small'
        freeSolo
      />
      <Button
        variant="contained"
        color="primary"
        onClick={handleSendClick}
        disabled={!selectedValue}
        sx={{ marginTop: 2 }}
      >
        Send
      </Button>
    </Box>
  );
};

export default DoctorSearch;
