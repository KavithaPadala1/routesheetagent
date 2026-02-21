import React, { useState, useEffect } from 'react';
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
    fontFamily: 'Trebuchet MS',
}));

const fuzzyMatch = (input, options, threshold = 0.6) => {
    const matches = stringSimilarity.findBestMatch(input?.toLowerCase(), options.map(option => option?.toLowerCase()));
    const bestMatches = matches.ratings.filter(rating => rating.rating >= threshold);
    
    // Sort by highest similarity
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
    const [filteredDoctors, setFilteredDoctors] = useState([]);
    const [locationData, setLocationData] = useState([]);
    const [initialized, setInitialized] = useState(false);
    const [loading, setLoading] = useState(false);
    const [fetching, setFetching] = useState(false);
    const [success, setSuccess] = useState(false);
    const [dataFetched, setDataFetched] = useState(false);

    const selectedLocation = watch("hospital_location");
    const selectedDoctor = watch("doctor_name");

    useEffect(() => {
        const fetchData = async () => {
            if (dataFetched) return;

            try {
                setFetching(true);
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

                if (matched_data_local.founded_data?.[0]?.locationid) {
                    setValue('hospital_location', matched_data_local.founded_data[0].locationid);
                    setValue('doctor_name', matched_data_local.founded_data[0].doctorid);

                    const doctorsForLocation = data.filter(doc => doc.locationid === matched_data_local.founded_data[0].locationid);
                    setFilteredDoctors(doctorsForLocation);
                }

                setInitialized(true);
                setDataFetched(true);
            } catch (error) {
                console.error('Error fetching data:', error);
            } finally {
                setFetching(false);
            }
        };

        if (!initialized) {
            fetchData();
        }
    }, [initialized, setValue, matched_data_local, dataFetched]);

    useEffect(() => {
        if (selectedLocation && initialized) {
            const doctorsForLocation = doctorData.filter(doc => doc.locationid === selectedLocation);
            setFilteredDoctors(doctorsForLocation);

            if (!doctorsForLocation.some(doc => doc.doctorid === selectedDoctor)) {
                setValue('doctor_name', null);
                setValue('doctor_speciality', null);
            }
        }
    }, [selectedLocation, doctorData, setValue, initialized, selectedDoctor]);

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
        const selectedDoctorRecord = doctorData.find(doc => doc.doctorid === data.doctor_name && doc.locationid === data.hospital_location);

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
                appointment_date: data.appointment_date,
                appointment_time: data.appointment_time,
                patient_date_of_birth: data.patient_date_of_birth,
            };
            console.log(">>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>")
            console.log(matched_data_local, formattedData)

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
            fontFamily: 'Trebuchet MS',
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
            validationRules.required = "Email is required";
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
        <Grid container spacing={2} marginBottom={2}>
            <Grid item xs={12} sm={6}>
                <Controller
                    name="hospital_location"
                    control={control}
                    rules={{ required: "Location is required" }}
                    render={({ field }) => (
                        <TextField
                            {...field}
                            fullWidth
                            select
                            label="Location"
                            size="small"
                            variant="outlined"
                            value={field.value || ''}
                            onChange={(e) => {
                                const selectedLocation = locationData.find(loc => loc.locationid === e.target.value);
                                handleFieldChange('hospital_location', selectedLocation.locationid, {
                                    hospital_location: selectedLocation.location,
                                });

                                if (selectedLocation.locationid !== selectedLocation) {
                                    handleFieldChange('doctor_name', null, {
                                        doctor_name: '',
                                        doctor_speciality: '',
                                    });
                                }
                            }}
                            InputLabelProps={{ shrink: true }}
                            error={!!errors.hospital_location}
                            helperText={errors.hospital_location ? errors.hospital_location.message : ''}
                        >
                            {locationData.map((loc) => (
                                <MenuItem key={loc.locationid} value={loc.locationid}>
                                    {loc.location}
                                </MenuItem>
                            ))}
                        </TextField>
                    )}
                />
            </Grid>
            {selectedLocation && (
                <Grid item xs={12} sm={6}>
                    <Controller
                        name="doctor_name"
                        control={control}
                        rules={{ required: "Doctor name is required" }}
                        render={({ field }) => (
                            <TextField
                                {...field}
                                fullWidth
                                select
                                label="Doctor"
                                size="small"
                                variant="outlined"
                                InputLabelProps={{ shrink: true }}
                                error={!!errors.doctor_name}
                                helperText={errors.doctor_name ? errors.doctor_name.message : ''}
                                value={field.value || ''}
                                onChange={(e) => {
                                    const selectedDoctor = filteredDoctors.find(doc => doc.doctorid === e.target.value);
                                    handleFieldChange('doctor_name', selectedDoctor.doctorid, {
                                        doctor_name: `${selectedDoctor.doctorname}`,
                                        doctor_speciality: selectedDoctor.specialityname,
                                    });

                                    const updatedFoundedData = {
                                        locationid: selectedDoctor.locationid,
                                        doctorid: selectedDoctor.doctorid,
                                        specialityid: selectedDoctor.specialityid,
                                    };

                                    localStorage.setItem("user_details", JSON.stringify({
                                        ...user_details,
                                        matched_data: {
                                            ...matched_data_local,
                                            founded_data: [updatedFoundedData],
                                        },
                                    }));
                                }}
                            >
                                {filteredDoctors.map((doc) => (
                                    <MenuItem key={doc.doctorid} value={doc.doctorid}>
                                        {`${doc.doctorname}`}
                                    </MenuItem>
                                ))}
                            </TextField>
                        )}
                    />
                </Grid>
            )}
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
                    <Box mt={2} fontFamily="Trebuchet MS">
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
                                <Box ml={2} fontFamily="Trebuchet MS">Loading doctor and location data...</Box>
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
                    <Stepper activeStep={activeStep} alternativeLabel sx={{ marginBottom: '15px', fontFamily: 'Trebuchet MS' }}>
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
                                        style={{ fontFamily: 'Trebuchet MS' }}
                                    >
                                        Back
                                    </Button>
                                    {activeStep < steps.length - 1 ? <Button
                                        onClick={handleNext}
                                        variant="contained"
                                        color="primary"
                                        style={{ backgroundColor: '#3f51b5', color: '#ffffff', fontFamily: 'Trebuchet MS' }}
                                    >
                                        Next
                                    </Button> : <Box style={{ display: 'flex', justifyContent: 'center', marginTop: 12 }}>
                                        <Button
                                            type="submit"
                                            variant="contained"
                                            color="primary"
                                            style={{ backgroundColor: '#3f51b5', color: '#ffffff', fontFamily: 'Trebuchet MS' }}
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
                    <DialogContentText id="appointment-success-description" align="center" fontFamily="Trebuchet MS">
                        Appointment request created successfully!
                    </DialogContentText>
                </DialogContent>
            </Dialog>
        </div>
    );
};

export default JsonDynamicForm;
