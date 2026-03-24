import React, { useState, useEffect, useCallback } from 'react';
import { useForm, Controller } from 'react-hook-form';
import {
    TextField,
    MenuItem,
    Select,
    Grid,
    Container,
    Paper,
    Button,
    Stepper,
    Step,
    StepLabel,
    Box,
    CircularProgress,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogContentText,
} from '@mui/material';
import { styled } from '@mui/system';
import Cookies from 'js-cookie';
import dayjs from 'dayjs';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterMoment } from '@mui/x-date-pickers/AdapterMoment';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { TimePicker } from '@mui/x-date-pickers/TimePicker';
import { Icon } from '@iconify/react';
import moment from 'moment-timezone';
import stringSimilarity from 'string-similarity';

const steps = ['Patient Details', 'Doctor Details & Confirm'];

const StyledPaper = styled(Paper)(({ theme }) => ({
    padding: '15px',
    marginTop: '20px',
    backgroundColor: '#f9f9f9',
    borderRadius: '10px',
    boxShadow: '0 4px 10px rgba(0, 0, 0, 0.1)',
}));

const fuzzyMatch = (input, options, threshold = 0.6) => {
    const matches = stringSimilarity.findBestMatch(input?.toLowerCase(), options.map(option => option?.toLowerCase()));
    const bestMatches = matches.ratings.filter(rating => rating.rating >= threshold);

    bestMatches.sort((a, b) => b.rating - a.rating);

    return bestMatches.map(match => options[matches.ratings.indexOf(match)]);
};


const JsonDynamicForm = () => {
    const storedUserDetails = JSON.parse(localStorage.getItem("user_details")) || {};
    const { matched_data = {} } = storedUserDetails;
    const user_details = { ...storedUserDetails };
    const matched_data_local = { ...matched_data };

    const { control, handleSubmit, setValue, watch, formState: { errors }, trigger } = useForm({
        defaultValues: user_details,
    });

    const [activeStep, setActiveStep] = useState(0);
    const [doctorData, setDoctorData] = useState([]);
    const [selectedLocation, setSelectedLocation] = useState(user_details.hospital_location || null);
    const [selectedDoctor, setSelectedDoctor] = useState(user_details.doctor_name || null);
    const [locationData, setLocationData] = useState([]);
    const [initialized, setInitialized] = useState(false);
    const [loading, setLoading] = useState(false);
    const [fetching, setFetching] = useState(false);
    const [success, setSuccess] = useState(false);
    const [locationError, setLocationError] = useState('');
    const [doctorError, setDoctorError] = useState('');
    const [dataFetched, setDataFetched] = useState(false);
    const [filteredDoctors, setFilteredDoctors] = useState([]);

    const [matchedData, setMatchedData] = useState({
        location_found: true,
        doctor_name_found_in_location: true,
        doctor_name_found_elsewhere: true,
        suggested_locations: [],
        suggested_doctors: [],
        founded_data: [],
        message: "",
    });

    console.log(locationData, doctorData)

    useEffect(() => {
        if (dataFetched && (selectedDoctor || selectedLocation)) {
            handleFuzzyMatch();
        }
    }, [dataFetched, selectedDoctor, selectedLocation]);

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

    const handleLocationChange = (e) => {
        const location = e.target.value;
        setSelectedLocation(location);
    
        const selectedLocationData = locationData.find(loc => loc.location === location);
    
        if (selectedLocationData) {
            updateLocalStorage("hospital_location", location);
    
            const doctorsInLocation = doctorData.filter(doc => doc.locationid === selectedLocationData.locationid);
            setFilteredDoctors(doctorsInLocation);
    
            const updatedMatchedData = {
                ...matchedData,
                founded_data: [
                    {
                        ...matchedData.founded_data[0],
                        locationid: selectedLocationData.locationid
                    }
                ],
            };
            setLocationError('');
            updateLocalStorage("matched_data", updatedMatchedData);
            setMatchedData(updatedMatchedData);
    
            setDoctorError('');
        } else {
            setFilteredDoctors([]);
            setLocationError(`The location "${location}" is not found.`);
        }
    };
    
    const handleDoctorChange = (e) => {
        const doctorName = e.target.value;
        setSelectedDoctor(doctorName);
    
        // Find the selected doctor record
        const selectedDoctorRecord = doctorData.find(doc => doc.doctorname === doctorName);
    
        if (selectedDoctorRecord) {
            updateLocalStorage("doctor_name", doctorName);
    
            const updatedMatchedData = {
                ...matchedData,
                founded_data: [
                    {
                        ...matchedData.founded_data[0],
                        doctorid: selectedDoctorRecord.doctorid,
                        specialityid: selectedDoctorRecord.specialityid,
                    }
                ],
            };
            updateLocalStorage("matched_data", updatedMatchedData);
            setMatchedData(updatedMatchedData);
    
            setDoctorError('');
        } else {
            setDoctorError(`The doctor "${doctorName}" is not available at the selected location.`);
        }
    };
    
    const handleFuzzyMatch = (userDetails, locationData, doctorData) => {
        const { hospital_location, doctor_name } = userDetails;

        const locationPatterns = {
            "ecity": "Apollo Precicare Ecity",
            "hsr": "Apollo Precicare HSR",
            "bannerghatta": "Bangalore - Main Bannerghatta Road",
            "bannerghata": "Bangalore - Main Bannerghatta Road",
            "bannerghetta": "Bangalore - Main Bannerghatta Road",
            "bannarghatta": "Bangalore - Main Bannerghatta Road",
            "banarghatta": "Bangalore - Main Bannerghatta Road",
            "banarghata": "Bangalore - Main Bannerghatta Road"
        };
    
        let matchedLocation = Object.keys(locationPatterns).find(pattern =>
            hospital_location.toLowerCase().includes(pattern)
        );
    
        let locationFound = matchedLocation
            ? locationPatterns[matchedLocation]
            : fuzzyMatch(hospital_location, locationData.map(loc => loc.location))[0];
    
        setSelectedLocation(locationFound);
    
        updateLocalStorage("hospital_location", locationFound);
    
        
        // const suggestedLocations = fuzzyMatch(hospital_location, locationData.map(loc => loc.location));
        // const locationFound = suggestedLocations.length > 0 ? suggestedLocations[0] : null;

        let doctorFoundInLocation = false;
        let doctorFoundElsewhere = false;
        let suggestedDoctors = [];

        // setSelectedLocation(locationFound);

        // updateLocalStorage("hospital_location", locationFound);

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
                    doctor_name_found_elsewhere: true,
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
    // useEffect(() => {
    //     const fetchData = async () => {
    //         if (dataFetched) return;

    //         try {
    //             setFetching(true);
    //             const response = await fetch('https://api-1-vsa-dev.azurewebsites.net/db/filterdata', {
    //                 method: 'POST',
    //                 headers: {
    //                     'Content-Type': 'application/json',
    //                 },
    //                 body: JSON.stringify({
    //                     query_name: 'filterdoctors',
    //                     input: '',
    //                 }),
    //             });
    //             const data = await response.json();

    //             const uniqueLocations = [...new Map(data.map(item => [item.locationid, item])).values()];
    //             setLocationData(uniqueLocations);
    //             setDoctorData(data);

    //             if (matched_data_local.founded_data?.[0]?.locationid) {
    //                 setValue('hospital_location', matched_data_local.founded_data[0].locationid);
    //                 setValue('doctor_name', matched_data_local.founded_data[0].doctorid);

    //                 const doctorsForLocation = data.filter(doc => doc.locationid === matched_data_local.founded_data[0].locationid);
    //                 setFilteredDoctors(doctorsForLocation);
    //             }

    //             setInitialized(true);
    //             setDataFetched(true);
    //         } catch (error) {
    //             console.error('Error fetching data:', error);
    //         } finally {
    //             setFetching(false);
    //         }
    //     };

    //     if (!initialized) {
    //         fetchData();
    //     }
    // }, [initialized, setValue, matched_data_local, dataFetched]);

    // useEffect(() => {
    //     const input = watch("hospital_location");
    //     if (input && typeof input === 'string') {
    //         const matchedLocations = fuzzyMatch(input, locationData.map(loc => loc.location));
    //         setFilteredLocations(matchedLocations);
    //     } else {
    //         setFilteredLocations(locationData.map(loc => loc.location));
    //     }
    // }, [locationData, watch("hospital_location")]);


    // useEffect(() => {
    //     if (selectedLocation && initialized) {
    //         const doctorsForLocation = doctorData.filter(doc => doc.locationid === selectedLocation);
    //         setFilteredDoctors(doctorsForLocation);

    //         const input = watch("doctor_name");
    //         if (input && typeof input === 'string') {
    //             const doctorNames = doctorsForLocation.map(doc => doc.doctorname);
    //             const matchedDoctors = fuzzyMatch(input, doctorNames);
    //             setFilteredDoctors(matchedDoctors);
    //         }

    //         if (!doctorsForLocation.some(doc => doc.doctorid === selectedDoctor)) {
    //             setValue('doctor_name', null);
    //             setValue('doctor_speciality', null);
    //         }
    //     }
    // }, [selectedLocation, doctorData, setValue, initialized, selectedDoctor, watch("doctor_name")]);

    useEffect(() => {
        if (user_details.appointment_date) {
            setValue('appointment_date', user_details.appointment_date);
        }
        if (user_details.appointment_time) {
            setValue('appointment_time', user_details.appointment_time);
        }
        if (user_details.patient_date_of_birth) {
            setValue('patient_date_of_birth', user_details.patient_date_of_birth);
        }
    }, [user_details, setValue]);


    const updateLocalStorage = (key, value) => {
        const updatedUserDetails = {
            ...JSON.parse(localStorage.getItem("user_details")),
            [key]: value,
        };
        localStorage.setItem("user_details", JSON.stringify(updatedUserDetails));
    };

    const handleFieldChange = (key, value) => {
        const trimmedValue = typeof value === 'string' ? value.trim() : value;
        setValue(key, trimmedValue);
        updateLocalStorage(key, trimmedValue);
    };

    const updateMatchedData = (data) => {
        const selectedDoctorRecord = doctorData.find(doc => doc.s === data.doctor_name && doc.locationid === data.hospital_location);

        if (selectedDoctorRecord) {
            const updatedFoundedData = [{
                locationid: selectedDoctorRecord.locationid,
                doctorid: selectedDoctorRecord.doctorid,
                specialityid: selectedDoctorRecord.specialityid,
                hospitalcityid: selectedDoctorRecord.hospitalcityid || null,
            }];

            const updatedMatchedData = {
                ...matched_data_local,
                founded_data: updatedFoundedData,
            };

            const updatedUserDetails = {
                ...data,
                hospital_location: locationData.find(loc => loc.locationid === selectedDoctorRecord.locationid)?.location || data.hospital_location,
                doctor_name: `${selectedDoctorRecord.title} ${selectedDoctorRecord.doctorname}`,
                doctor_speciality: selectedDoctorRecord.specialityname,
            };

            localStorage.setItem("user_details", JSON.stringify({
                ...updatedUserDetails,
                matched_data: updatedMatchedData,
            }));

            console.log("Updated localStorage with new doctor details:", updatedUserDetails);
        } else {
            console.error("Selected doctor record not found.");
        }
    };

    function deleteCookies() {
        Cookies.remove('session_id', { path: '/appointments' });
        Cookies.remove('token', { path: '/appointments' });
    }

    const handleNext = async () => {
        if (activeStep === 0) {
            const isStepValid = await trigger(['patient_name', 'patient_email']);
            if (!isStepValid) return;
        }

        setActiveStep((prevActiveStep) => prevActiveStep + 1);
    };
    const handleBack = () => setActiveStep((prevActiveStep) => prevActiveStep - 1);

    const onSubmit = async (data) => {
        setLoading(true);
        console.log("sta", data)

        try {
            updateMatchedData(data);

            const formattedData = {
                ...data,
                matched_data: matched_data_local,
                appointment_date: data.appointment_date,
                appointment_time: data.appointment_time,
                patient_date_of_birth: data.patient_date_of_birth,
            };
            console.log(">>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>")
            console.log(data, formattedData)

            const response = await fetch('https://api-1-vsa-dev.azurewebsites.net/appointments/create-lead', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    matched_data: matched_data_local,
                    user_details: formattedData,
                }),
            });

            if (response.ok) {
                deleteCookies();
                setLoading(false);
                setSuccess(true);
                setTimeout(() => {
                    alert("Thank you for your information. Your appointment request has been successfully created. Our customer care specialists will get in touch with you shortly.");
                    sessionStorage.removeItem("chatbotMessages");
                    localStorage.clear();
                    window.location.reload();
                }, 3000);
            } else {
                setLoading(false);
                console.error('Failed to create lead:', response.statusText);
            }
        } catch (error) {
            setLoading(false);
            console.error('Error:', error);
        }
    };

    const renderInputField = (key, value) => {
        const inputFieldStyle = {
            backgroundColor: '#fff',
            borderRadius: '8px',
        };


        const validationRules = {};

        if (key === 'patient_name') {
            validationRules.required = "Name is required";
            validationRules.minLength = {
                value: 3,
                message: "Name must be at least 3 characters long",
            };
        }

        if (key === 'patient_email') {
            validationRules.pattern = {
                value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
                message: "Invalid email address",
            };
        }


        if (key === 'patient_gender') {
            return (
                <Controller
                    name={key}
                    control={control}
                    render={({ field }) => (
                        <Select
                            {...field}
                            fullWidth
                            label="Gender"
                            size="small"
                            variant="outlined"
                            style={inputFieldStyle}
                            value={(field.value || '').toLowerCase() === 'male' ? 'male' : 'female'}
                            onChange={(e) => {
                                setValue('patient_gender', e.target.value);
                                handleFieldChange('patient_gender', e.target.value);
                            }}
                        >
                            <MenuItem value="male">Male</MenuItem>
                            <MenuItem value="female">Female</MenuItem>
                        </Select>
                    )}
                />
            );
        }

        if (value === null) {
            return (
                <Controller
                    name={key}
                    control={control}
                    render={({ field }) => (
                        <TextField
                            {...field}
                            fullWidth
                            label={key.replace('_', ' ')}
                            type="text"
                            size="small"
                            variant="outlined"
                            style={inputFieldStyle}
                            onChange={(e) => handleFieldChange(key, e.target.value)}
                        />
                    )}
                />
            );
        }

        const valueType = typeof value;

        switch (valueType) {
            case 'string':
            case 'number':
                return (
                    <Controller
                        name={key}
                        control={control}
                        rules={validationRules}
                        render={({ field }) => (
                            <TextField
                                {...field}
                                fullWidth
                                label={key.replace('_', ' ')}
                                type={valueType === 'number' ? 'number' : 'text'}
                                size="small"
                                variant="outlined"
                                style={inputFieldStyle}
                                error={!!errors[key]}
                                helperText={errors[key] ? errors[key].message : ''}
                                onChange={(e) => handleFieldChange(key, e.target.value)}
                                disabled={key === "phone_number"}
                            />
                        )}
                    />
                );
            default:
                return null;
        }
    };

    const renderDoctorAndLocationFields = () => (
        <Grid container spacing={2} mb={2} sx={{ mb: 2 }}>
            <Grid item xs={12} sm={6}>
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
                    variant="outlined"
                    sx={{
                        "& .MuiInputBase-root": {
                            borderRadius: "8px",
                        },
                        "& .MuiOutlinedInput-input": {
                            padding: "8px 12px",
                        },
                        "& .MuiFormLabel-root": {
                            fontSize: "0.9rem",
                        },
                    }}
                >
                    <MenuItem value="" sx={{
                        minHeight: "30px",
                        padding: "4px 8px",
                        fontSize: "0.9rem",
                    }}>
                        -- Select Location --
                    </MenuItem>
                    {locationData.map((loc) => (
                        <MenuItem
                            key={loc.locationid}
                            value={loc.location}
                            sx={{
                                minHeight: "30px",
                                padding: "4px 8px",
                                fontSize: "0.9rem",
                            }}
                        >
                            {loc.location}
                        </MenuItem>
                    ))}
                </TextField>
            </Grid>

            <Grid item xs={12} sm={6}>
                <TextField
                    id="doctorSelect"
                    select
                    fullWidth
                    required
                    size="small"
                    label="Select Doctor"
                    value={selectedDoctor || ''}
                    disabled={!selectedLocation}
                    onChange={handleDoctorChange}
                    error={!!doctorError}
                    helperText={doctorError || ''}
                    variant="outlined"
                    sx={{
                        "& .MuiInputBase-root": {
                            borderRadius: "8px",
                        },
                        "& .MuiOutlinedInput-input": {
                            padding: "8px 12px",
                        },
                        "& .MuiFormLabel-root": {
                            fontSize: "0.9rem",
                        },
                    }}
                >
                    <MenuItem value="" sx={{
                        minHeight: "30px",
                        padding: "4px 8px",
                        fontSize: "0.9rem",
                    }}>
                        -- Select Doctor --
                    </MenuItem>
                    {filteredDoctors.map((doc) => (
                        <MenuItem
                            key={doc.doctorid}
                            value={doc.doctorname}
                            sx={{
                                padding: "0px 0px",
                                minHeight: "30px",
                                fontSize: "0.9rem",
                            }}
                        >
                            {doc.doctorname}
                        </MenuItem>
                    ))}
                </TextField>
            </Grid>
        </Grid>
    );



    const renderDateAndTimePickers = () => (
        <Grid container spacing={2}>
            <Grid item xs={12} sm={6}>
                <Controller
                    name="appointment_date"
                    control={control}
                    rules={{ required: "Appointment date is required" }}
                    render={({ field }) => (
                        <TextField
                            label="Appointment Date"
                            type="date"
                            {...field}
                            value={field.value || ''}
                            onChange={(e) => handleFieldChange('appointment_date', e.target.value)}
                            fullWidth
                            size="small"
                            variant="outlined"
                            error={!!errors.appointment_date}
                            helperText={errors.appointment_date ? errors.appointment_date.message : ''}
                            InputProps={{
                                inputProps: {
                                    min: moment().format('YYYY-MM-DD'),
                                },
                            }}
                            sx={{
                                '& .MuiInputBase-root': {
                                    fontFamily: 'Trebuchet MS',
                                },
                                '& .MuiOutlinedInput-root': {
                                    '& fieldset': {
                                        borderRadius: '8px',
                                    },
                                },
                            }}
                        />
                    )}
                />
            </Grid>
            <Grid item xs={12} sm={6}>
                <Controller
                    name="appointment_time"
                    control={control}
                    rules={{ required: "Appointment time is required" }}
                    render={({ field }) => (
                        <TextField
                            label="Appointment Time"
                            type="time"
                            {...field}
                            value={field.value || ''}
                            onChange={(e) => handleFieldChange('appointment_time', e.target.value)}
                            fullWidth
                            size="small"
                            variant="outlined"
                            error={!!errors.appointment_time}
                            helperText={errors.appointment_time ? errors.appointment_time.message : ''}
                            sx={{
                                '& .MuiInputBase-root': {
                                    fontFamily: 'Trebuchet MS',
                                },
                                '& .MuiOutlinedInput-root': {
                                    '& fieldset': {
                                        borderRadius: '8px',
                                    },
                                },
                            }}
                        />
                    )}
                />
            </Grid>
        </Grid>
    );

    const renderDOBPicker = () => (
        <Grid item xs={12}>
            <Controller
                name="patient_date_of_birth"
                control={control}
                render={({ field }) => (
                    <TextField
                        label="Date of Birth"
                        type="date"
                        {...field}
                        value={field.value || ''}
                        onChange={(e) => handleFieldChange('patient_date_of_birth', e.target.value)}
                        fullWidth
                        size="small"
                        variant="outlined"
                        sx={{
                            '& .MuiInputBase-root': {
                                fontFamily: 'Trebuchet MS',
                            },
                            '& .MuiOutlinedInput-root': {
                                '& fieldset': {
                                    borderRadius: '8px',
                                },
                            },
                        }}
                    />
                )}
            />
        </Grid>
    );


    const getStepContent = (step) => {
        if (!user_details || typeof user_details !== 'object') {
            return 'Invalid step data';
        }

        if (loading) {
            return (
                <Box display="flex" justifyContent="center" alignItems="center" flexDirection="column" mt={4}>
                    <CircularProgress size={50} />
                    <Box mt={2}>
                        Creating your appointment request...
                    </Box>
                </Box>
            );
        }

        switch (step) {
            case 0:
                const patientFields = Object.entries(user_details)
                    .filter(([key]) => key.startsWith('patient_name') || key.startsWith('patient_gender') || key.startsWith('patient_date_of_birth') || key.startsWith('patient_email') || key.startsWith('patient_comments') || key.startsWith('phone_number'));

                if (patientFields.length === 0) {
                    return 'No patient data available';
                }

                return (
                    <Grid container spacing={2}>
                        {patientFields.map(([key, value]) => (
                            <Grid item xs={12} sm={6} key={key}>
                                {key === 'patient_date_of_birth' ? renderDOBPicker() : renderInputField(key, value)}
                            </Grid>
                        ))}
                    </Grid>
                );
            case 1:
                const patientMandatoryFields = Object.entries(user_details)
                    .filter(([key]) => key.startsWith('patient_name') || key.startsWith('phone_number'));

                return (
                    <>
                        <Grid container spacing={2} mb={2}>
                            {patientMandatoryFields.map(([key, value]) => (
                                <Grid item xs={12} sm={6} key={key}>
                                    {renderInputField(key, value)}
                                </Grid>
                            ))}
                        </Grid>
                        {fetching && (
                            <Box display="flex" justifyContent="center" mb={2}>
                                <CircularProgress size={24} />
                                <Box ml={2}>Loading doctor and location data...</Box>
                            </Box>
                        )}
                        {renderDoctorAndLocationFields()}
                        {renderDateAndTimePickers()}
                    </>
                );
            default:
                return 'Unknown step';
        }
    };

    return (
        <div>
            <Container maxWidth="md">
                <StyledPaper>
                    <Stepper activeStep={activeStep} alternativeLabel sx={{ marginBottom: '15px' }}>
                        {steps.map((label) => (
                            <Step key={label}>
                                <StepLabel>{label}</StepLabel>
                            </Step>
                        ))}
                    </Stepper>
                    <Box>
                        <form onSubmit={handleSubmit(onSubmit)}>
                            {getStepContent(activeStep)}
                            {activeStep < steps.length && (
                                <Box style={{ display: 'flex', justifyContent: 'space-between', marginTop: 12 }}>
                                    <Button
                                        disabled={activeStep === 0}
                                        onClick={handleBack}
                                        variant="outlined"
                                        color="primary"
                                    >
                                        Back
                                    </Button>
                                    {activeStep < steps.length - 1 ? <Button
                                        onClick={handleNext}
                                        variant="contained"
                                        color="primary"
                                        style={{ backgroundColor: '#3f51b5', color: '#ffffff' }}
                                    >
                                        Next
                                    </Button> : <Box style={{ display: 'flex', justifyContent: 'center', marginTop: 12 }}>
                                        <Button
                                            type="submit"
                                            variant="contained"
                                            color="primary"
                                            style={{ backgroundColor: '#3f51b5', color: '#ffffff' }}
                                            disabled={loading || success}
                                        >
                                            {loading ? <CircularProgress size={24} color="inherit" /> : 'Confirm'}
                                        </Button>
                                    </Box>}
                                </Box>
                            )}
                        </form>
                    </Box>
                </StyledPaper>
            </Container>

            {/* Success Dialog */}
            <Dialog
                open={success}
                // onClose={() => setSuccess(false)}
                aria-labelledby="appointment-success-title"
                aria-describedby="appointment-success-description"
            >
                <DialogTitle id="appointment-success-title">
                    <Box display="flex" justifyContent="center">
                        <Icon icon="icon-park-solid:success" width={40} height={40} style={{ color: 'green' }} />
                    </Box>
                </DialogTitle>
                <DialogContent>
                    <DialogContentText id="appointment-success-description" align="center" >
                        Appointment request created successfully!
                    </DialogContentText>
                </DialogContent>
            </Dialog>
        </div>
    );
};

export default JsonDynamicForm;
