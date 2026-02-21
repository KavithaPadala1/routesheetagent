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
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { TimePicker } from '@mui/x-date-pickers/TimePicker';
import { Icon } from '@iconify/react';

const steps = ['Patient Details', 'Doctor Details & Confirm'];

const StyledPaper = styled(Paper)(({ theme }) => ({
    padding: '15px',
    marginTop: '20px',
    backgroundColor: '#f9f9f9',
    borderRadius: '10px',
    boxShadow: '0 4px 10px rgba(0, 0, 0, 0.1)',
    fontFamily: 'Trebuchet MS',
}));

const JsonDynamicForm = () => {
    const storedUserDetails = JSON.parse(localStorage.getItem("user_details")) || {};
    const { matched_data = {} } = storedUserDetails;
    const user_details = { ...storedUserDetails };
    const matched_data_local = { ...matched_data };

    console.log(matched_data_local)

    const { control, handleSubmit, setValue, watch } = useForm({
        defaultValues: user_details,
    });
    const [activeStep, setActiveStep] = useState(0);
    const [doctorData, setDoctorData] = useState([]);
    const [filteredDoctors, setFilteredDoctors] = useState([]);
    const [locationData, setLocationData] = useState([]);
    const [initialized, setInitialized] = useState(false);
    const [loading, setLoading] = useState(false);
    const [success, setSuccess] = useState(false);
    const [dataFetched, setDataFetched] = useState(false);

    const selectedLocation = watch("hospital_location");
    const selectedDoctor = watch("doctor_name");
    console.log(selectedDoctor, selectedLocation)

    useEffect(() => {
        const fetchData = async () => {
            if (dataFetched) return; // Prevent fetching data if already fetched

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
            }
        };

        if (!initialized) {
            fetchData();
        }
    }, [initialized, setValue, matched_data_local, dataFetched]);

    useEffect(() => {
        if (selectedLocation && initialized) {
            const doctorsForLocation = doctorData.filter(doc => doc.locationid === selectedLocation);
            if (filteredDoctors.length !== doctorsForLocation.length) {
                setFilteredDoctors(doctorsForLocation);
            }

            if (!doctorsForLocation.some(doc => doc.doctorid === selectedDoctor)) {
                setValue('doctor_name', null);
                setValue('doctor_speciality', null);
            }
        }
    }, [selectedLocation, doctorData, setValue, initialized, selectedDoctor, filteredDoctors.length]);

    useEffect(() => {
        if (user_details.appointment_date) {
            setValue('appointment_date', dayjs(user_details.appointment_date, 'YYYY-MM-DD'));
        }
        if (user_details.appointment_time) {
            setValue('appointment_time', dayjs(user_details.appointment_time, 'HH:mm'));
        }
        if (user_details.patient_date_of_birth) {
            setValue('patient_date_of_birth', dayjs(user_details.patient_date_of_birth, 'YYYY-MM-DD'));
        }
    }, [user_details, setValue]);
    

    const updateLocalStorage = (key, value) => {
        let formattedValue = value;

        if (key === 'appointment_date' || key === 'patient_date_of_birth') {
            formattedValue = dayjs(value).format('YYYY-MM-DD');
        } else if (key === 'appointment_time') {
            formattedValue = dayjs(value).format('HH:mm');
        }

        const updatedUserDetails = {
            ...JSON.parse(localStorage.getItem("user_details")),
            [key]: formattedValue,
        };
        localStorage.setItem("user_details", JSON.stringify(updatedUserDetails));
    };

    const handleFieldChange = (key, value) => {
        setValue(key, value);
        updateLocalStorage(key, value);
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

    const handleNext = () => setActiveStep((prevActiveStep) => prevActiveStep + 1);
    const handleBack = () => setActiveStep((prevActiveStep) => prevActiveStep - 1);

    const onSubmit = async (data) => {
        setLoading(true);

        try {
            updateMatchedData(data);

            const formattedData = {
                ...data,
                appointment_date: dayjs(data.appointment_date).format('YYYY-MM-DD'),
                appointment_time: dayjs(data.appointment_time).format('HH:mm'),
                patient_date_of_birth: dayjs(data.patient_date_of_birth).format('YYYY-MM-DD'),
            };

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
                    localStorage.clear(); // Clear all localStorage items in one go
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
                render={({ field }) => (
                    <TextField
                        {...field}
                        fullWidth
                        label={key.replace('_', ' ')}
                        type={valueType === 'number' ? 'number' : 'text'}
                        size="small"
                        variant="outlined"
                        style={inputFieldStyle}
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
                    render={({ field }) => (
                        <Select
                            {...field}
                            fullWidth
                            label="Location"
                            size="small"
                            variant="outlined"
                            style={{ backgroundColor: '#fff', borderRadius: '8px', fontFamily: 'Trebuchet MS' }}
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
                        >
                            {locationData.map((loc) => (
                                <MenuItem key={loc.locationid} value={loc.locationid}>
                                    {loc.location}
                                </MenuItem>
                            ))}
                        </Select>
                    )}
                />
            </Grid>
            {selectedLocation && (
                <Grid item xs={12} sm={6}>
                    <Controller
                        name="doctor_name"
                        control={control}
                        render={({ field }) => (
                            <Select
                                {...field}
                                fullWidth
                                label="Doctor"
                                size="small"
                                variant="outlined"
                                style={{ backgroundColor: '#fff', borderRadius: '8px', fontFamily: 'Trebuchet MS' }}
                                value={field.value || ''}
                                onChange={(e) => {
                                    const selectedDoctor = filteredDoctors.find(doc => doc.doctorid === e.target.value);
                                    handleFieldChange('doctor_name', selectedDoctor.doctorid, {
                                        doctor_name: `${selectedDoctor.title} ${selectedDoctor.doctorname}`,
                                        doctor_speciality: selectedDoctor.specialityname,
                                    });

                                    // Update founded_data with necessary ids
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
                                        {`${doc.title} ${doc.doctorname}`}
                                    </MenuItem>
                                ))}
                            </Select>
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
                    render={({ field }) => (
                        <LocalizationProvider dateAdapter={AdapterDayjs}>
                            <DatePicker
                                label="Appointment Date"
                                {...field}
                                value={field.value && dayjs.isDayjs(field.value) ? field.value : null}
                                onChange={(newValue) => {
                                    setValue('appointment_date', newValue);
                                    handleFieldChange('appointment_date', newValue);
                                }}
                                minDate={dayjs()}  // Restrict to today and future dates
                                inputFormat="YYYY-MM-DD"
                                renderInput={(params) => (
                                    <TextField
                                        {...params}
                                        fullWidth
                                        size="small"
                                        variant="outlined"
                                        sx={{
                                            '& .MuiInputBase-root': {
                                                padding: '8px 12px',
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
                        </LocalizationProvider>
                    )}
                />
            </Grid>
            <Grid item xs={12} sm={6}>
                <Controller
                    name="appointment_time"
                    control={control}
                    render={({ field }) => (
                        <LocalizationProvider dateAdapter={AdapterDayjs}>
                            <TimePicker
                                label="Appointment Time"
                                {...field}
                                value={field.value && dayjs.isDayjs(field.value) ? field.value : null}
                                onChange={(newValue) => {
                                    setValue('appointment_time', newValue);
                                    handleFieldChange('appointment_time', newValue);
                                }}
                                renderInput={(params) => (
                                    <TextField
                                        {...params}
                                        fullWidth
                                        size="small"
                                        variant="outlined"
                                        sx={{
                                            '& .MuiInputBase-root': {
                                                padding: '8px 12px',
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
                        </LocalizationProvider>
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
                    <LocalizationProvider dateAdapter={AdapterDayjs}>
                        <DatePicker
                            label="Date of Birth"
                            {...field}
                            value={field.value && dayjs.isDayjs(field.value) ? field.value : null}
                            onChange={(newValue) => {
                                setValue('patient_date_of_birth', newValue);
                                handleFieldChange('patient_date_of_birth', newValue);
                            }}
                            inputFormat="YYYY-MM-DD"
                            renderInput={(params) => (
                                <TextField {...params} fullWidth size="small" variant="outlined" style={{ fontFamily: 'Trebuchet MS' }} />
                            )}
                        />
                    </LocalizationProvider>
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
                const patientBasicFields = Object.entries(user_details)
                    .filter(([key]) => key.startsWith('patient_name') || key.startsWith('phone_number'));

                if (patientBasicFields.length === 0) {
                    return 'No patient data available';
                }
                return (
                    <>
                        <Grid container spacing={2} marginBottom={2}>
                            {patientBasicFields.map(([key, value]) => (
                                <Grid item xs={12} sm={6} key={key}>
                                    {key === 'patient_date_of_birth' ? renderDOBPicker() : renderInputField(key, value)}
                                </Grid>
                            ))}
                        </Grid>
                        {renderDoctorAndLocationFields()}
                        {renderDateAndTimePickers()}

                        {success && (
                            <Box style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', marginTop: 20 }}>
                                <Icon icon="icon-park-solid:success" width={40} height={40} style={{ color: 'green' }} />
                                <Box marginLeft={2} fontFamily="Trebuchet MS">
                                    Appointment request created successfully!
                                </Box>
                            </Box>
                        )}
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
                onClose={() => setSuccess(false)}
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
