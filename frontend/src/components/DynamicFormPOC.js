import React, { useState, useEffect } from 'react';
import stringSimilarity from 'string-similarity';
import {
    TextField,
    MenuItem,
    Grid,
    Container,
    Paper,
    Box,
    Typography,
} from '@mui/material';

const fuzzyMatch = (input, options, threshold = 0.6) => {
    const matches = stringSimilarity.findBestMatch(input?.toLowerCase(), options.map(option => option?.toLowerCase()));
    const bestMatches = matches.ratings.filter(rating => rating.rating >= threshold);
    
    bestMatches.sort((a, b) => b.rating - a.rating);

    return bestMatches.map(match => options[matches.ratings.indexOf(match)]);
};

const JsonDynamicFormPOC = () => {
    const storedUserDetails = JSON.parse(localStorage.getItem("user_details")) || {};
    const user_details = { ...storedUserDetails };

    const [locationData, setLocationData] = useState([]);
    const [doctorData, setDoctorData] = useState([]);
    const [selectedLocation, setSelectedLocation] = useState(user_details.hospital_location || '');
    const [filteredDoctors, setFilteredDoctors] = useState([]);
    const [selectedDoctor, setSelectedDoctor] = useState(user_details.doctor_name || '');
    const [locationError, setLocationError] = useState('');
    const [doctorError, setDoctorError] = useState('');
    const [matchedData, setMatchedData] = useState({
        location_found: false,
        doctor_name_found_in_location: false,
        doctor_name_found_elsewhere: false,
        suggested_locations: [],
        suggested_doctors: [],
        founded_data: [],
        message: "",
    });

    useEffect(() => {
        const fetchData = async () => {
            try {
                const response = await fetch('https://api-1-vsa-dev.azurewebsites.net/db/filterdata', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        query_name: 'filterdoctors',
                        input: '',
                    }),
                });
                const data = await response.json();

                const uniqueLocations = [...new Map(data.map(item => [item.locationid, item])).values()]; 
                setLocationData(uniqueLocations);
                setDoctorData(data);

                if (user_details.hospital_location || user_details.doctor_name) {
                    handleFuzzyMatch(user_details, uniqueLocations, data);
                }
            } catch (error) {
                console.error("Error fetching doctor and location data:", error);
            }
        };

        fetchData();
    }, []); 

    const updateLocalStorage = (key, value) => {
        const updatedUserDetails = {
            ...JSON.parse(localStorage.getItem("user_details")),
            [key]: value,
        };
        localStorage.setItem("user_details", JSON.stringify(updatedUserDetails));
    };

    const handleLocationChange = (e) => {
        const location = e.target.value;
        setSelectedLocation(location);
        updateLocalStorage("hospital_location", location);
        setLocationError('');

        const selectedLocationData = locationData.find(loc => loc.location === location);
        if (selectedLocationData) {
            const doctorsInLocation = doctorData.filter(doc => doc.locationid === selectedLocationData.locationid);
            setFilteredDoctors(doctorsInLocation);
            setDoctorError('');
        } else {
            setFilteredDoctors([]);
        }
    };

    const handleDoctorChange = (e) => {
        setSelectedDoctor(e.target.value);
        updateLocalStorage("doctor_name", e.target.value);
        setDoctorError('');
    };

    const handleFuzzyMatch = (userDetails, locationData, doctorData) => {
        const { hospital_location, doctor_name } = userDetails;

        const suggestedLocations = fuzzyMatch(hospital_location, locationData.map(loc => loc.location));
        const locationFound = suggestedLocations.length > 0 ? suggestedLocations[0] : null;

        let doctorFoundInLocation = false;
        let doctorFoundElsewhere = false;
        let suggestedDoctors = [];

        setSelectedLocation(locationFound);

        updateLocalStorage("hospital_location", locationFound);

        if (locationFound) {
            const selectedLocationData = locationData.find(loc => loc.location === locationFound);

            const doctorsInLocation = doctorData.filter(doc => doc.locationid === selectedLocationData.locationid);
            const doctorNames = doctorsInLocation.map(doc => doc.doctorname);
            const matchedDoctorsInLocation = fuzzyMatch(doctor_name, doctorNames);

            if (selectedLocationData) {
                const doctorsInLocation = doctorData.filter(doc => doc.locationid === selectedLocationData.locationid);
                setFilteredDoctors(doctorsInLocation);
            } else {
                setFilteredDoctors([]);
            }

            if (matchedDoctorsInLocation.length > 0) {
                doctorFoundInLocation = true;
                const doctorRecord = doctorsInLocation.find(doc => doc.doctorname.trim() === matchedDoctorsInLocation[0]);

                setSelectedLocation(locationFound);
                setSelectedDoctor(matchedDoctorsInLocation[0]);

                updateLocalStorage("hospital_location", locationFound);
                updateLocalStorage("doctor_name", matchedDoctorsInLocation[0]);

                let matchedrecord = {
                    location_found: true,
                    doctor_name_found_in_location: true,
                    doctor_name_found_elsewhere: false,
                    suggested_locations: [],
                    suggested_doctors: [],
                    founded_data: [
                        {
                            locationid: doctorRecord.locationid,
                            doctorid: doctorRecord.doctorid,
                            specialityid: doctorRecord.specialityid,
                            hospitalcityid: null,
                        },
                    ],
                    message: "Doctor found in the selected location!",
                };
                updateLocalStorage("matched_data", matchedrecord);
                setMatchedData(matchedrecord);
            } else {
                setDoctorError(`The doctor "${userDetails.doctor_name}" is not available at the selected location.`);
            }
        } else {
            setLocationError(`The location "${userDetails.hospital_location}" is not found.`);
            setFilteredDoctors([]);
        }
    };

    return (
        <Container maxWidth="md">
            <Paper elevation={3} sx={{ p: 3 }}>
                <Grid container spacing={2}>
                    <Grid item xs={12}>
                        {/* Location Dropdown */}
                        <TextField
                            id="locationSelect"
                            select
                            fullWidth
                            required
                            size="small"
                            label="Select Location"
                            value={selectedLocation || ''}
                            onChange={handleLocationChange}
                            error={!!locationError}
                            helperText={locationError || ''}
                        >
                            <MenuItem value="">
                                -- Select Location --
                            </MenuItem>
                            {locationData.map((loc) => (
                                <MenuItem key={loc.locationid} value={loc.location}>
                                    {loc.location}
                                </MenuItem>
                            ))}
                        </TextField>
                    </Grid>

                    {/* Doctor Dropdown (Filtered by Location) */}
                    <Grid item xs={12}>
                        <TextField
                            id="doctorSelect"
                            select
                            fullWidth
                            required
                            size="small"
                            label="Select Doctor"
                            value={selectedDoctor || ''}
                            onChange={handleDoctorChange}
                            error={!!doctorError}
                            helperText={doctorError || ''}
                        >
                            <MenuItem value="">
                                -- Select Doctor --
                            </MenuItem>
                            {filteredDoctors.map((doc) => (
                                <MenuItem key={doc.doctorid} value={doc.doctorname}>
                                    {doc.doctorname}
                                </MenuItem>
                            ))}
                        </TextField>
                    </Grid>
                </Grid>
            </Paper>
        </Container>
    );
};

export default JsonDynamicFormPOC;
