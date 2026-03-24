import React, { useState, useRef, useEffect } from "react";
import "./AMA-ChatBotUI.css";
import { Icon } from "@iconify/react";
import config from "./botconfiguration.json";
import AudioPlayer from "./components/AudioPlayerStyled";
import VerificationDialogInline from "./components/VerificationDialogInline";
import CallbackDialog from "./components/CallbackDialog";
import DoctorSearch from "./components/DoctorSearch";
import CallbackDialogAppointment from "./components/CallbackDialogAppointment";
import Cookies from "js-cookie";
import JsonDynamicForm from "./components/DynamicForm";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  IconButton,
  Typography,
  Divider,
} from "@mui/material";
import { height, styled } from "@mui/system";
import { Menu, MenuItem } from "@mui/material";

const CHAT_API_URL = process.env.REACT_APP_CHAT_API_URL;
console.log(CHAT_API_URL);
const OTP_SEND_URL = process.env.REACT_APP_OTP_SEND_URL;
const OTP_VERIFY_URL = process.env.REACT_APP_OTP_VERIFY_URL;
const PROCESS_TEXT_URL = process.env.REACT_APP_PROCESS_TEXT_URL;
const BOOK_APPOINTMENT_URL = process.env.REACT_APP_BOOK_APPOINTMENT_URL;

const StyledDialog = styled(Dialog)(({ theme }) => ({
  "& .MuiDialog-paper": {
    borderRadius: "15px",
    padding: "2px",
    background: "linear-gradient(145deg, #f3f3f3, #e1e1e1)",
  },
}));

const StyledDialogTitle = styled(DialogTitle)(({ theme }) => ({
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  paddingRight: theme.spacing(2),
}));

const StyledCloseButton = styled(IconButton)(({ theme }) => ({
  color: "black",
}));

const StyledButton = styled(Button)(({ theme }) => ({
  backgroundColor: "#3f51b5",
  color: "#ffffff",
  "&:hover": {
    backgroundColor: "#283593",
  },
}));

const StyledMenu = styled(Menu)(({ theme }) => ({
  "& .MuiPaper-root": {
    borderRadius: "10px 10px 10px 0px",
    backgroundColor: "#f5f5f5",
    boxShadow: "0px 3px 5px rgba(0, 0, 0, 0.2)",
    minWidth: 200,
  },
}));

const StyledMenuItem = styled(MenuItem)(({ theme }) => ({
  fontWeight: 500,
  fontSize: "16px",
  borderRadius: 8,
  color: "#333",
  "&:hover": {
    backgroundColor: "#3f51b5",
    color: "#fff",
  },
  "& .MuiSvgIcon-root": {
    marginRight: theme.spacing(1.5),
    color: "#3f51b5",
  },
}));

const AMAChatBotUI = ({ onSendMessage }) => {
  const initialMessages =
    JSON.parse(sessionStorage.getItem("chatbotMessages")) ||
    config.initialMessages;
  const [messages, setMessages] = useState(initialMessages);
  const [input, setInput] = useState("");
  const [playingAudio, setPlayingAudio] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isInputDisabled, setIsInputDisabled] = useState(false);
  const [isOtpStep, setIsOtpStep] = useState(
    localStorage.getItem("isOtpStep") === "true"
  );
  const [isVerified, setIsVerified] = useState(true);
  const [error, setError] = useState("");
  const [timer, setTimer] = useState(parseInt(180));
  const [isTimerActive, setIsTimerActive] = useState(
    localStorage.getItem("isTimerActive") === "true"
  );
  const [otpHitCount, setOtpHitCount] = useState(
    parseInt(localStorage.getItem("otpHitCount")) || 0
  );
  const [isVerificationDialogVisible, setIsVerificationDialogVisible] =
    useState(false);
  const [requestCallbackOpen, setRequestCallbackOpen] = useState(false);
  const [terminate, setTerminate] = useState(false);
  const [doctorSearchSelections, setDoctorSearchSelections] = useState({
    location: "",
    speciality: "",
    doctor: "",
  });
  const [isTerminateDialogOpen, setIsTerminateDialogOpen] = useState(false);
  const [isAppointmentPopupOpen, setIsAppointmentPopupOpen] = useState(false);
  const [anchorEl, setAnchorEl] = useState(null);
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  useEffect(() => {
    // Clear all session storage data on page load (refresh)
    sessionStorage.clear();
  }, []);

  const handleMenuOpen = (event) => {
    setAnchorEl(event.currentTarget);
    setIsMenuOpen(true);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
    setIsMenuOpen(false);
  };

  const handleMenuOption = (option) => {
    if (
      option === "Book Appointment" ||
      option === "Ask Apollo Cancer Centres"
    ) {
      sessionStorage.removeItem("chatbotMessages");
      setMessages([]);
      handleSend(option);
    } else if (option === "Request Callback") {
      handleRequestCallbackOpen();
    }
    handleMenuClose();
  };

  const handleTermination = () => {
    const timer = setTimeout(() => {
      localStorage.setItem("isShowForm", true);
      setTerminate(true);
      setIsTerminateDialogOpen(true);
    }, 2000);

    return () => clearTimeout(timer);
  };

  const handleCloseTerminateDialog = () => {
    setIsTerminateDialogOpen(false);
  };

  const handleRequestCallbackOpen = () => {
    console.log("entered");
    setRequestCallbackOpen(!requestCallbackOpen);
  };

  const handleRequestCallbackClose = () => {
    setRequestCallbackOpen(false);
  };

  const chatboxRef = useRef(null);
  const audioRef = useRef(null);

  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty("--primary-color", config.colors.primaryColor);
    root.style.setProperty("--secondary-color", config.colors.secondaryColor);
    root.style.setProperty("--white-color", config.colors.whiteColor);
    root.style.setProperty("--black-color", config.colors.blackColor);
    root.style.setProperty("--grey-color", config.colors.greyColor);
    root.style.setProperty("--error-bg-color", config.colors.errorBgColor);
    root.style.setProperty("--error-text-color", config.colors.errorTextColor);
  }, []);

  useEffect(() => {
    setIsInputDisabled(isLoading || !isVerified);
  }, [isLoading, isVerified]);

  useEffect(() => {
    sessionStorage.setItem("chatbotMessages", JSON.stringify(messages));
  }, [messages]);

  useEffect(() => {
    const checkSession = setInterval(() => {
      const now = Date.now();
      const storedMessages = sessionStorage.getItem("chatbotMessages");

      if (storedMessages) {
        const parsedMessages = JSON.parse(storedMessages);
        if (parsedMessages.length > 0) {
          const lastMessage = parsedMessages.slice(-1)[0];
          const lastMessageTime = new Date(lastMessage.timestamp).getTime();

          if (now - lastMessageTime > 1800000) {
            sessionStorage.removeItem("chatbotMessages");
            localStorage.removeItem("phone");
            localStorage.removeItem("name");
            localStorage.removeItem("isOtpStep");
            localStorage.removeItem("timer");
            localStorage.removeItem("API_URL");
            localStorage.removeItem("isVerified");
            localStorage.removeItem("isTimerActive");
            localStorage.removeItem("user_details");
            localStorage.removeItem("isInputFieldDisabled");
            localStorage.removeItem("otpHitCount");
            localStorage.removeItem("isShowForm");
            localStorage.removeItem("isUserDetailsSent");
            console.log("Session expired and data removed");
            window.location.reload();
            setMessages(config.initialMessages);
          }
        }
      }
    }, 20000);

    return () => clearInterval(checkSession);
  }, []);

  useEffect(() => {
    if (isTimerActive) {
      const timerId = setTimeout(() => {
        setIsVerificationDialogVisible(true);
      }, 5000);
      return () => clearTimeout(timerId);
    } else {
      setIsVerificationDialogVisible(false);
    }
  }, [isTimerActive]);

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  useEffect(() => {
    let timerInterval;
    if (isTimerActive && timer > 0) {
      timerInterval = setInterval(() => {
        setTimer((prevTimer) => {
          const newTimer = prevTimer - 1;
          localStorage.setItem("timer", newTimer);
          return newTimer;
        });
      }, 1000);
    } else if (timer === 0) {
      clearInterval(timerInterval);
      setIsOtpStep(false);
      setIsTimerActive(false);
      setTimer(60);
      setMessages((prevMessages) => [
        ...prevMessages,
        createChatMessage(
          "OTP timed out. Please enter your details again.",
          "incoming",
          "text"
        ),
      ]);
      localStorage.setItem("isOtpStep", "false");
      localStorage.setItem("isTimerActive", "false");
      localStorage.setItem("isVerified", "false");
    }
    return () => clearInterval(timerInterval);
  }, [isTimerActive, timer]);

  const scrollToBottom = () => {
    if (chatboxRef.current) {
      chatboxRef.current.scrollTop = chatboxRef.current.scrollHeight;
    }
  };

  const createChatMessage = (
    text,
    type,
    format,
    options = [],
    references = [],
    disabled = false,
    actions = [],
    containsAppointment = false
  ) => ({
    text,
    type,
    format,
    options,
    references,
    disabled,
    actions,
    containsAppointment,
    timestamp: new Date().toISOString(),
  });

  const updateChatApiUrl = (message) => {
    if (message.includes("Ask Apollo Cancer Centres")) {
      localStorage.setItem("API_URL", PROCESS_TEXT_URL);
    } else if (message.includes("Book Appointment")) {
      localStorage.setItem("API_URL", BOOK_APPOINTMENT_URL);
    }
  };

  // useEffect(() => {
  //   const clearLocalStorage = (event) => {
  //     if (event.persisted || event.type === 'unload') {
  //       sessionStorage.removeItem("chatbotMessages")
  //       localStorage.removeItem("phone");
  //       localStorage.removeItem("name");
  //       localStorage.removeItem("isOtpStep");
  //       localStorage.removeItem("timer");
  //       localStorage.removeItem("API_URL");
  //       localStorage.removeItem("isVerified");
  //       localStorage.removeItem("isTimerActive");
  //       localStorage.removeItem("user_details");
  //       localStorage.removeItem("otpHitCount");
  //       localStorage.removeItem("isUserDetailsSent");
  //       localStorage.removeItem("isInputFieldDisabled");
  //       console.log('Local storage cleared on session close.');
  //     }
  //   };

  //   window.addEventListener('unload', clearLocalStorage);

  //   return () => {
  //     window.removeEventListener('unload', clearLocalStorage);
  //   };
  // }, []);

  const sendMessageToAPI = async (message, newSession, isAudio = false) => {
    if (onSendMessage) {
      try {
        setIsLoading(true);
        const data = await onSendMessage(message);
        setIsLoading(false);
        return data;
      } catch (error) {
        setIsLoading(false);
        return { response: "Oops! Something went wrong." };
      }
    }
    const ENDPOINT_URL = localStorage.getItem("API_URL") || CHAT_API_URL;

    let userMessageTextDetails = "";
    if (
      isVerified &&
      ENDPOINT_URL.includes("appointments/get-response") &&
      localStorage.getItem("isUserDetailsSent") !== "true"
    ) {
      userMessageTextDetails = `patient name is ${localStorage.getItem(
        "name"
      )} and phone number is ${localStorage.getItem("phone")}.`;
      localStorage.setItem("isUserDetailsSent", "true");
    }

    const formData = new URLSearchParams();
    formData.append("query", message + userMessageTextDetails);
    formData.append("user_token", "MSZDRURFTU8wNDE4JkNFREVNTw==");
    formData.append("session_id", localStorage.getItem("session_id") || "null");
    formData.append("token", localStorage.getItem("token") || "null");

    try {
      setIsLoading(true);
      const response = await fetch(
        "https://gasopsbackend.azurewebsites.net/ask",
        {
          method: "POST",
          headers: {
            accept: "application/json",
            "Content-Type": "application/x-www-form-urlencoded",
          },
          credentials: "include",
          body: formData.toString(),
        }
      );

      // const data = {
      //   "response": "BPCL stands for Bharat Petroleum Corporation Limited. It is an Indian government-owned oil and gas corporation headquartered in Mumbai, Maharashtra. BPCL operates two large refineries in the country, one in Mumbai and the other in Kochi. The company is involved in the refining of crude oil, production of petroleum products, and marketing of these products. BPCL is one of the largest companies in India and plays a significant role in the country's energy sector.",
      //   "references": [
      //     "https://azpii.blob.core.windows.net/bpcldata/26-07-2024_N (1).txt",
      //     "https://azpii.blob.core.windows.net/bpcldata/13-07-2024_N12.txt",
      //     "https://azpii.blob.core.windows.net/bpcldata/20-07-2024_E.txt",
      //     "https://azpii.blob.core.windows.net/bpcldata/20-07-2024_N.txt",
      //     "https://azpii.blob.core.windows.net/bpcldata/27-07-2024_N12.txt",
      //     "https://azpii.blob.core.windows.net/bpcldata/09-07-2024_D.txt",
      //     "https://azpii.blob.core.windows.net/bpcldata/31-07-2024_N.txt",
      //     "https://azpii.blob.core.windows.net/bpcldata/06-07-2024_D.txt",
      //     "https://azpii.blob.core.windows.net/bpcldata/12-07-2024_N.txt",
      //     "https://azpii.blob.core.windows.net/bpcldata/03-07-2024_D.txt",
      //     "https://azpii.blob.core.windows.net/bpcldata/28-07-2024_D.txt",
      //     "https://azpii.blob.core.windows.net/bpcldata/31-07-2024_D.txt",
      //     "https://azpii.blob.core.windows.net/bpcldata/26-07-2024_N.txt",
      //     "https://azpii.blob.core.windows.net/bpcldata/30-07-2024_D.txt",
      //     "https://azpii.blob.core.windows.net/bpcldata/25-07-2024_D.txt"
      //   ],
      //   "timestamp": "2025-02-04T06:51:05.559197",
      //   "context": [
      //     {
      //       "role": "user",
      //       "content": "what is bpcl",
      //       "timestamp": "2025-02-04T06:51:05.559197"
      //     },
      //     {
      //       "role": "assistant",
      //       "content": "BPCL stands for Bharat Petroleum Corporation Limited. It is an Indian government-owned oil and gas corporation headquartered in Mumbai, Maharashtra. BPCL operates two large refineries in the country, one in Mumbai and the other in Kochi. The company is involved in the refining of crude oil, production of petroleum products, and marketing of these products. BPCL is one of the largest companies in India and plays a significant role in the country's energy sector.",
      //       "timestamp": "2025-02-04T06:51:05.559197"
      //     }
      //   ],
      //   "user_details": {
      //     "session_id": "d73f1074-e42c-412f-9854-133d2ebb8665",
      //     "token": "39b82cc7-3552-4e52-85da-1b6ea03db523"
      //   }
      // }
      console.log("response", response);
      const data = await response.json();
      console.log("data", data);
      setIsLoading(false);

      localStorage.setItem("session_id", data.user_details.session_id);
      localStorage.setItem("token", data.user_details.token);

      if (
        ENDPOINT_URL.includes("appointments/get-response") &&
        data.user_details
      ) {
        localStorage.setItem("user_details", JSON.stringify(data.user_details));
      }

      if (data && data.terminate === "kill") {
        localStorage.setItem("isInputFieldDisabled", true);
      }

      return data;
    } catch (error) {
      console.error("Error:", error);
      setIsLoading(false);
      return "Oops! Something went wrong.";
    }
  };

  const handleDoctorSearchSend = async ({ query, selectedValue, id }) => {
    const formattedMessage = `Selected ${query.replace(
      "validate",
      ""
    )} is '${selectedValue}'`;

    const variables = {
      location: query === "validatelocation" ? selectedValue : "",
      speciality: query === "validatespeciality" ? selectedValue : "",
      doctor: query === "validatedoctor" ? selectedValue : "",
      id,
    };

    console.log(formattedMessage);
    await sendMessageToAPI(formattedMessage, false);
  };

  function deleteCookies() {
    Cookies.remove("session_id", { path: "/appointments" });
    Cookies.remove("token", { path: "/appointments" });
  }

  const handleSend = async (message = null) => {
    if (!isVerified) {
      setError("Please verify yourself first.");
      return;
    }

    if (message === null && !input.trim()) return;

    const containsAppointment = (message || input)
      .toLowerCase()
      .includes("appointment");

    if (containsAppointment) {
      setIsAppointmentPopupOpen(true);
    }

    setMessages((prevMessages) => {
      const lastMessageIndex = prevMessages.length - 1;
      if (prevMessages[lastMessageIndex]?.options) {
        prevMessages[lastMessageIndex].disabled = true;
      }
      return [...prevMessages];
    });

    const userMessage = createChatMessage(
      message || input.trim(),
      "outgoing",
      "text",
      [],
      [],
      true,
      []
    );

    setMessages((prevMessages) => [...prevMessages, userMessage]);
    setInput("");

    setTimeout(scrollToBottom, 0);

    let newSession =
      !sessionStorage.getItem("chatbotMessages") || messages.length <= 2;

    updateChatApiUrl(userMessage.text);

    setIsLoading(true);
    const botResponse = await sendMessageToAPI(userMessage.text, newSession);
    setIsLoading(false);

    let botResponseText = botResponse.answer || botResponse.response;
    let botResponseCustomMessage = botResponse.custom_response;
    let botResponseReferences =
      botResponse?.references?.length > 4
        ? botResponse?.references.slice(0, 1)
        : botResponse?.references;
    let botResponseOptions = botResponse.options;
    let botResponseFormat = botResponse.format;
    let appendRequestCallback = [
      {
        id: "requestcallback",
        text: "Request a callback",
        question: "x",
        answer: "x",
        function: () => {
          console.log("entered");
          setRequestCallbackOpen(!requestCallbackOpen);
        },
      },
    ];
    setMessages((prevMessages) => [
      ...prevMessages,
      createChatMessage(
        botResponseText,
        "incoming",
        botResponseFormat || "text",
        botResponseOptions || [],
        botResponseReferences,
        false,
        botResponseOptions?.length > 0
          ? appendRequestCallback
          : localStorage.getItem("API_URL")?.includes("/process_text")
          ? appendRequestCallback
          : [],
        localStorage.getItem("API_URL")?.includes("/process_text")
          ? containsAppointment
          : false
      ),
    ]);

    if (botResponse.terminate && botResponse.terminate === "editdetails") {
      handleTermination();
    }

    if (botResponse.terminate && botResponse.terminate === "kill") {
      setIsInputDisabled(true);

      setTimeout(() => {
        deleteCookies();
        sessionStorage.removeItem("chatbotMessages");
        localStorage.removeItem("phone");
        localStorage.removeItem("name");
        localStorage.removeItem("isOtpStep");
        localStorage.removeItem("timer");
        localStorage.removeItem("API_URL");
        localStorage.removeItem("isVerified");
        localStorage.removeItem("isTimerActive");
        localStorage.removeItem("user_details");
        localStorage.removeItem("isShowForm");
        localStorage.removeItem("otpHitCount");
        localStorage.removeItem("isUserDetailsSent");
        localStorage.removeItem("isInputFieldDisabled");
        console.log("Session expired and data removed");
        alert(
          "Thank you for your information. Your appointment request has been successfully created. Our customer care specialists will get in touch with you shortly."
        );
        window.location.reload();
        setMessages(config.initialMessages);
      }, 6000);
    }
  };

  console.log("mxkslncsmd", isInputDisabled);

  const handleUserDetailsSubmit = async (name, phone) => {
    localStorage.setItem("phone", phone);
    localStorage.setItem("name", name);
    setIsLoading(true);
    try {
      const response = await fetch(OTP_SEND_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ phone_number: phone }),
      });
      if (response.ok) {
        setIsOtpStep(true);
        setIsTimerActive(true);
        setError("");
        setOtpHitCount((prevCount) => {
          const newCount = prevCount + 1;
          localStorage.setItem("otpHitCount", newCount);
          return newCount;
        });
        localStorage.setItem("isOtpStep", "true");
        localStorage.setItem("isTimerActive", "true");
      } else {
        setError("Failed to send OTP. Please try again.");
      }
    } catch (error) {
      console.error("Error sending OTP:", error);
      setError("An error occurred. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleOtpSubmit = async (otp) => {
    setIsLoading(true);
    try {
      const response = await fetch(OTP_VERIFY_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          phone_number: localStorage.getItem("phone"),
          entered_otp: otp,
        }),
      });
      if (response.ok) {
        setMessages((prevMessages) => [
          ...prevMessages,
          createChatMessage(
            "Your verification is successful. Choose from one of the given options below to continue the conversation",
            "incoming",
            "text",
            ["Ask Apollo Cancer Centres", "Book Appointment"],
            [],
            false,
            [
              {
                id: "requestcallback",
                text: "Request a Callback",
                question: "",
                answer: "",
              },
            ]
          ),
        ]);
        setIsOtpStep(false);
        setIsVerified(true);
        localStorage.setItem("isOtpStep", "false");
        localStorage.setItem("isVerified", "true");
        setIsTimerActive(false);
        localStorage.setItem("isTimerActive", "false");
        setError("");
      } else {
        setError("OTP verification failed. Please try again.");
      }
    } catch (error) {
      console.error("Error verifying OTP:", error);
      setError("An error occurred. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendOtp = () => {
    handleUserDetailsSubmit(
      localStorage.getItem("name"),
      localStorage.getItem("phone"),
      true
    );
  };

  const handleInputChange = (e) => {
    setInput(e.target.value);

    setAnchorEl(e.currentTarget);
    if (e.target.value === "/") {
      setIsMenuOpen(true);
    } else {
      setIsMenuOpen(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const renderLinks = (text) => {
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    if (!Array.isArray(text)) {
      console.log("Expected an array but got:", typeof text);
      return [];
    }
    return text.map((part, index) =>
      part.match(urlRegex) ? (
        <span
          key={index}
          className="chip"
          style={{ backgroundColor: "#0363b5" }}
        >
          <Icon icon={"ph:globe-bold"} className="chip-icon" />
          <a href={part} target="_blank" rel="noopener noreferrer">
            {part.substring(0, 30) + "…"}
          </a>
        </span>
      ) : null
    );
  };

  // Helper: Check if value is array of objects with same keys
  const isTableData = (data) => {
    if (!Array.isArray(data) || data.length === 0) return false;
    if (typeof data[0] !== "object" || Array.isArray(data[0])) return false;
    const keys = Object.keys(data[0]);
    return data.every(
      (row) => typeof row === "object" && !Array.isArray(row) && Object.keys(row).length === keys.length && Object.keys(row).every((k) => keys.includes(k))
    );
  };

  // Helper: Render table from array of objects
  const renderTable = (data) => {
    if (!isTableData(data)) return null;
    const headers = Object.keys(data[0]);
    return (
      <div className="chat-table-container" style={{overflowX: 'auto', margin: '10px 0'}}>
        <table className="chat-table" style={{borderCollapse: 'collapse', width: '100%'}}>
          <thead>
            <tr>
              {headers.map((header) => (
                <th key={header} style={{border: '1px solid #ccc', padding: '6px', background: '#f5f5f5'}}>{header}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.map((row, idx) => (
              <tr key={idx}>
                {headers.map((header) => (
                  <td key={header} style={{border: '1px solid #ccc', padding: '6px'}}>{row[header]}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  // Helper: Render basic markdown formatting for text
  const renderMarkdownText = (text) => {
    if (!text) return '';
    
    // Convert markdown headers
    const lines = text.split('\n').map(line => {
      // Handle ### headers
      if (line.trim().startsWith('### ')) {
        return `<h3 style="font-size: 1.1em; font-weight: 600; margin: 8px 0 6px 0; color: #2c3e50;">${line.replace('### ', '')}</h3>`;
      }
      // Handle ## headers  
      if (line.trim().startsWith('## ')) {
        return `<h2 style="font-size: 1.2em; font-weight: 600; margin: 10px 0 6px 0; color: #2c3e50;">${line.replace('## ', '')}</h2>`;
      }
      // Handle # headers
      if (line.trim().startsWith('# ')) {
        return `<h1 style="font-size: 1.3em; font-weight: 600; margin: 12px 0 8px 0; color: #2c3e50;">${line.replace('# ', '')}</h1>`;
      }
      // Handle bold text **text**
      line = line.replace(/\*\*(.*?)\*\*/g, '<strong style="color: #2c3e50; font-weight: 600;">$1</strong>');
      // Handle italic text *text*
      line = line.replace(/\*(.*?)\*/g, '<em>$1</em>');
      // Handle horizontal rules
      if (line.trim() === '---') {
        return '<hr style="border: none; border-top: 1px solid #ddd; margin: 8px 0;" />';
      }
      return line;
    });
    
    return lines.join('\n');
  };  // Helper: Parse all markdown tables from text
  const parseAllMarkdownTables = (text) => {
    // Check if text is a valid string
    if (typeof text !== 'string' || !text) {
      return null;
    }

    const lines = text.split('\n');
    const tables = [];
    let currentTableStart = -1;
    let currentTableEnd = -1;
    let inTable = false;
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      
      if (line.includes('|') && line.split('|').length > 2) {
        if (!inTable) {
          inTable = true;
          currentTableStart = i;
        }
        currentTableEnd = i;
      } else if (inTable && (line === '' || !line.includes('|'))) {
        // End of current table
        if (currentTableStart !== -1 && currentTableEnd !== -1) {
          const tableText = lines.slice(currentTableStart, currentTableEnd + 1);
          const rows = tableText
            .filter(line => {
              const trimmed = line.trim();
              // Skip empty lines
              if (!trimmed) return false;
              
              // Skip lines that don't contain pipes
              if (!trimmed.includes('|')) return false;
              
              // Skip separator lines - COMPREHENSIVE REGEX for all separator patterns
              if (/^\s*\|[\s\-:]+(\|[\s\-:]*)*\|\s*$/.test(trimmed)) return false;
              
              // Must have at least 1 meaningful cell (changed from 2 to 1 for single column tables)
              const cells = trimmed.split('|').map(cell => cell.trim()).filter(cell => cell !== '');
              return cells.length >= 1;
            })
            .map(line => 
              line.split('|')
                .map(cell => cell.trim())
                .filter((cell, index, arr) => index !== 0 && index !== arr.length - 1)
            );

          if (rows.length >= 2) {
            tables.push({
              startLine: currentTableStart,
              endLine: currentTableEnd,
              tableData: rows
            });
          }
        }
        inTable = false;
        currentTableStart = -1;
        currentTableEnd = -1;
      }
    }
    
    // Handle case where table is at the end of text
    if (inTable && currentTableStart !== -1) {
      const tableText = lines.slice(currentTableStart, currentTableEnd + 1);
      const rows = tableText
        .filter(line => {
          const trimmed = line.trim();
          // Skip empty lines
          if (!trimmed) return false;
          
          // Skip lines that don't contain pipes
          if (!trimmed.includes('|')) return false;
          
          // Skip separator lines - COMPREHENSIVE REGEX for all separator patterns
          if (/^\s*\|[\s\-:]+(\|[\s\-:]*)*\|\s*$/.test(trimmed)) return false;
          
          // Must have at least 1 meaningful cell (changed from 2 to 1 for single column tables)
          const cells = trimmed.split('|').map(cell => cell.trim()).filter(cell => cell !== '');
          return cells.length >= 1;
        })
        .map(line => 
          line.split('|')
            .map(cell => cell.trim())
            .filter((cell, index, arr) => index !== 0 && index !== arr.length - 1)
        );

      if (rows.length >= 2) {
        tables.push({
          startLine: currentTableStart,
          endLine: currentTableEnd,
          tableData: rows
        });
      }
    }

    if (tables.length === 0) return null;

    // Build segments with text and tables
    const segments = [];
    let lastEnd = -1;

    tables.forEach((table, index) => {
      // Add text before this table
      const textBefore = lines.slice(lastEnd + 1, table.startLine).join('\n').trim();
      if (textBefore) {
        segments.push({ type: 'text', content: textBefore });
      }
      
      // Add the table
      segments.push({ type: 'table', content: table.tableData });
      lastEnd = table.endLine;
    });

    // Add any remaining text after the last table
    const textAfter = lines.slice(lastEnd + 1).join('\n').trim();
    if (textAfter) {
      segments.push({ type: 'text', content: textAfter });
    }

    return segments;
  };

  // Helper: Render HTML table from parsed markdown table
  const renderMarkdownTable = (rows) => {
    if (!rows || rows.length < 1) return null;
    
    const headers = rows[0];
    const dataRows = rows.slice(1);
    
    return (
      <div className="chat-table-container" style={{overflowX: 'auto', margin: '8px 0', display: 'flex', justifyContent: 'flex-start'}}>
        <table className="chat-table" style={{
          borderCollapse: 'collapse', 
          width: 'auto', 
          maxWidth: '600px',
          minWidth: '300px',
          border: '1px solid #ccc',
          fontSize: '14px',
          fontFamily: 'Font Awesome 6 Free'
        }}>
          <thead>
            <tr>
              {headers.map((header, idx) => (
                <th key={idx} style={{
                  border: '1px solid #ccc', 
                  padding: '6px 8px', 
                  background: '#f5f5f5',
                  fontWeight: '600',
                  textAlign: 'left',
                  fontSize: '14px',
                  color: '#333',
                  whiteSpace: 'nowrap',
                  minWidth: '80px',
                  fontFamily: 'Font Awesome 6 Free'
                }}>
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {dataRows.map((row, rowIdx) => (
              <tr key={rowIdx} style={{background: '#fff'}}>
                {row.map((cell, cellIdx) => (
                  <td key={cellIdx} style={{
                    border: '1px solid #ccc', 
                    padding: '6px 8px',
                    textAlign: 'left',
                    fontSize: '14px',
                    color: '#333',
                    lineHeight: '1.3',
                    whiteSpace: 'nowrap',
                    fontFamily: 'Font Awesome 6 Free'
                  }}>
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  // Helper: Safely parse JSON if possible, even if embedded in text
  const tryParseJson = (value) => {
    if (typeof value === "string") {
      // Try to extract the first JSON array from the string
      const match = value.match(/(\[\s*{[\s\S]*?}\s*\])/);
      if (match) {
        try {
          return JSON.parse(match[1]);
        } catch {
          return value;
        }
      }
      // Fallback: try to parse if the whole string is a JSON array
      if (value.trim().startsWith("[") && value.trim().endsWith("]")) {
        try {
          return JSON.parse(value);
        } catch {
          return value;
        }
      }
    }
    return value;
  };

  return (
    <div className="chatbot-container ama-chatbot">
      <div className="chatbot">
        <header
          className="chatbot-header"
          style={{
            height: "120px",
            background: "linear-gradient(to bottom, #03296d, #0363b5)",
          }}
        >
          <div style={{ width: "300px", height: "60px" }}>
            <div
              style={{
                backgroundColor: "#ffffff",
                borderBottomRightRadius: 60,
              }}
            >
              <div>
                <img
                  src="https://oams.gasopsiq.com/Content/img/OAMSLogo.svg"
                  alt="Chatbot Icon"
                  style={{ width: "140px", height: "90px" }}
                />
              </div>

              <div>
                {/* <h2 style={{ marginLeft: 10, color:'white' }}>{config.chatbotHeader.title}</h2> */}
              </div>
            </div>
          </div>
        </header>

        <ul className="chatbox" ref={chatboxRef}>
          {messages.map((msg, index) => (
            <li key={index} className={`chat ${msg.type}`}>
              {console.log(msg)}
              {msg.type === "incoming" && (
                <>
                  <div>
                    <Icon
                      icon={config.icons.botIcon.name}
                      style={{
                        ...config.icons.botIcon.style,
                      }}
                    />
                  </div>
                  <div>
                    <div className="message-container">
                      {msg?.text?.length >= 1 ? (
                        (() => {
                          // Ensure msg.text is a string before processing
                          const textContent = typeof msg.text === 'string' ? msg.text : String(msg.text || '');
                          
                          const parsed = tryParseJson(textContent);
                          
                          // First check if it's already structured table data (JSON array)
                          if (isTableData(parsed)) {
                            return renderTable(parsed);
                          }
                          
                          // Then check if the text contains markdown tables
                          const markdownSegments = parseAllMarkdownTables(textContent);
                          if (markdownSegments) {
                            return (
                              <div style={{maxWidth: '650px', width: 'fit-content'}}>
                                {markdownSegments.map((segment, index) => {
                                  if (segment.type === 'text') {
                                    return (
                                      <div 
                                        key={index} 
                                        style={{
                                          marginBottom: '6px',
                                          lineHeight: '1.4',
                                          fontSize: '14px',
                                          maxWidth: '600px',
                                          width: 'fit-content',
                                          fontFamily: 'Font Awesome 6 Free',
                                          fontWeight: '500',
                                          textAlign: 'left'
                                        }}
                                        dangerouslySetInnerHTML={{
                                          __html: renderMarkdownText(segment.content)
                                        }}
                                      />
                                    );
                                  } else if (segment.type === 'table') {
                                    return (
                                      <div key={index} style={{margin: '4px 0'}}>
                                        {renderMarkdownTable(segment.content)}
                                      </div>
                                    );
                                  }
                                  return null;
                                })}
                              </div>
                            );
                          }
                          
                          // Default text rendering
                          return (
                            <div style={{maxWidth: '600px', width: 'fit-content'}}>
                              <p style={{fontSize: '14px', lineHeight: '1.4', margin: '0', fontFamily: 'Font Awesome 6 Free', fontWeight: '500', textAlign: 'left'}}>
                                {msg?.text}
                                {msg?.containsAppointment &&
                                  isAppointmentPopupOpen &&
                                  localStorage.getItem("API_URL")?.includes(
                                    "/process_text"
                                  ) && (
                                  <div className="appointment-popup">
                                    <div>Would you like to book an appointment? </div>
                                    <div className="appointment-popup-actions">
                                      <button
                                        onClick={() => {
                                          localStorage.setItem("isUserDetailsSent", false);
                                          localStorage.setItem("API_URL", BOOK_APPOINTMENT_URL);
                                          setIsAppointmentPopupOpen(false);
                                          handleSend("Book Appointment");
                                        }}
                                        className="confirm-button"
                                      >
                                        Yes
                                      </button>
                                      <button
                                        onClick={() => setIsAppointmentPopupOpen(false)}
                                        className="cancel-button"
                                      >
                                        No
                                      </button>
                                    </div>
                                  </div>
                                )}
                              </p>
                            </div>
                          );
                        })()
                      ) : (
                        <p></p>
                      )}
                    </div>
                    {msg.options && msg.options.length > 0 && (
                      <div className="options">
                        {msg.options.map((option, i) => (
                          <button
                            key={i}
                            onClick={() => handleSend(option)}
                            disabled={msg.disabled}
                            style={{ color: "black" }}
                          >
                            {option}
                          </button>
                        ))}
                      </div>
                    )}
                    {index > 0 &&
                      isVerified &&
                      msg.actions &&
                      msg.actions.length > 0 && (
                        <div className="actions">
                          {msg.actions?.map((option, i) => (
                            <button
                              key={i}
                              onClick={handleRequestCallbackOpen}
                              disabled={msg.disabled}
                              style={{ color: "black", alignItems: "center" }}
                            >
                              <Icon
                                icon="ic:round-call"
                                width={15}
                                height={15}
                              />
                              <>{option.text}</>
                            </button>
                          ))}
                        </div>
                      )}
                    {index > 1 ? (
                      msg?.references?.length >= 1 ? (
                        <p
                          style={{
                            padding: 0,
                            backgroundColor: "white",
                            color: "#000000",
                          }}
                        >
                          {renderLinks(msg?.references)}
                        </p>
                      ) : (
                        <>{renderLinks(msg?.references)}</>
                      )
                    ) : (
                      <></>
                    )}
                  </div>
                </>
              )}
              <div>
                {msg.type === "outgoing" && msg.format === "text" && (
                  <div className="message-container outgoing">
                    <p style={{ backgroundColor: "#0363b5", fontFamily: 'Font Awesome 6 Free' }}>{msg.text}</p>
                    <Icon
                      icon={config.icons.userIcon.name}
                      style={config.icons.userIcon.style}
                    />
                  </div>
                )}
                {msg.type === "outgoing" && msg.format === "audio" && (
                  <div className="message-container outgoing">
                    <p>
                      <AudioPlayer
                        ref={audioRef}
                        className="styled-audio"
                        src={msg.audioSrc}
                        controls
                      />
                    </p>
                    <Icon
                      icon={config.icons.userIcon.name}
                      style={config.icons.userIcon.style}
                    />
                  </div>
                )}
                {msg.format.includes("validate") && isVerified && (
                  <div
                    className="message-container outgoing"
                    style={{ width: "700px" }}
                  >
                    {console.log("response", msg.format.includes("validate"))}
                    <p>
                      <DoctorSearch
                        query={msg.format}
                        onSaveSelections={(selections) =>
                          setDoctorSearchSelections((prev) => ({
                            ...prev,
                            ...selections,
                          }))
                        }
                        onSend={handleDoctorSearchSend}
                      />
                      <Icon
                        icon={config.icons.userIcon.name}
                        style={config.icons.userIcon.style}
                      />
                    </p>
                  </div>
                )}
                {msg.type === "outgoing" && !isVerified && (
                  <div className="message-container outgoing">
                    <p>
                      <VerificationDialogInline
                        open={!isVerified || isOtpStep}
                        onClose={() => setIsVerificationDialogVisible(false)}
                        onSubmitDetails={handleUserDetailsSubmit}
                        onVerifyOtp={handleOtpSubmit}
                        onResendOtp={handleResendOtp}
                        isOtpStep={isOtpStep}
                        timer={timer}
                        otpHitCount={otpHitCount}
                        error={error}
                      />
                    </p>
                    <Icon
                      icon={config.icons.userIcon.name}
                      style={config.icons.userIcon.style}
                    />
                  </div>
                )}
              </div>
            </li>
          ))}
          {isLoading && (
            <li className="chat loading-indicator flex items-center space-x-2">
              <Icon
                icon={config.icons.botIcon.name}
                style={{
                  ...config.icons.botIcon.style,
                }}
              />
              <img
                src={"/messageloader.svg"}
                alt="Loader"
                className="chat-icon-loader"
              />
            </li>
          )}
        </ul>
        {requestCallbackOpen &&
          (localStorage
            .getItem("API_URL")
            ?.includes("appointments/get-response") ? (
            <CallbackDialogAppointment
              answer={messages[messages.length - 1]}
              question={messages[messages.length - 2]}
              open={requestCallbackOpen}
              onClose={handleRequestCallbackClose}
            />
          ) : localStorage.getItem("API_URL")?.includes("/process_text") ? (
            <CallbackDialog
              answer={messages[messages.length - 1]}
              question={messages[messages.length - 2]}
              open={requestCallbackOpen}
              onClose={handleRequestCallbackClose}
            />
          ) : (
            <CallbackDialog
              answer={messages[messages.length - 1]}
              question={messages[messages.length - 2]}
              open={requestCallbackOpen}
              onClose={handleRequestCallbackClose}
            />
          ))}
        {console.log("nclanc", isInputDisabled)}
        <div
          className={`chat-input ${
            messages[messages.length - 1].options.length > 0 ||
            isInputDisabled ||
            localStorage.getItem("isInputFieldDisabled")
              ? "disabled"
              : ""
          }`}
        >
          {/* <IconButton onClick={handleMenuOpen}>
            <Icon icon="fe:app-menu" width={28} height={28} />
          </IconButton> */}
          <input
            value={input}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder="Enter a message..."
            spellCheck="false"
            required
            disabled={
              messages[messages.length - 1].options.length > 0 ||
              isInputDisabled ||
              localStorage.getItem("isInputFieldDisabled")
            }
          />
          <button
            className="send-btn"
            // onClick={() => handleSend(input)}
            // disabled={!input.trim() || isLoading}
            style={{ backgroundColor: "#0363b5" }}
          >
            +
          </button>
          <button
            className="send-btn"
            onClick={() => handleSend(input)}
            disabled={!input.trim() || isLoading}
            style={{ backgroundColor: "#0363b5" }}
          >
            <Icon
              icon={config.icons.sendButtonIcon.name}
              style={config.icons.sendButtonIcon.style}
            />
          </button>
        </div>
      </div>

      <StyledDialog
        open={localStorage.getItem("isShowForm")}
        // onClose={handleCloseTerminateDialog}
      >
        <StyledDialogTitle>
          Confirm Details
          {/* <StyledCloseButton aria-label="close" onClick={handleCloseTerminateDialog}>
            <Icon icon="ion:close" />
          </StyledCloseButton> */}
        </StyledDialogTitle>
        <DialogContent>
          <JsonDynamicForm />
        </DialogContent>
      </StyledDialog>
      {/* <StyledMenu
        anchorEl={anchorEl}
        open={isMenuOpen}
        onClose={handleMenuClose}
        getContentAnchorEl={null} 
        anchorOrigin={{
          vertical: 'top',   
        }}
        transformOrigin={{
          vertical: 'bottom',      
        }}
        PaperProps={{
          style: {
            marginBottom: '0px',
          },
        }}
      >
        {(!localStorage.getItem('API_URL') || !localStorage.getItem('API_URL').includes('appointments/get-response')) && (
          <>
            <StyledMenuItem onClick={() => handleMenuOption('Book Appointment')}>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <div style={{ width: '100%' }}>
                  <Icon icon="ion:calendar" width="20px" height="20px" /> Book Appointment
                </div>
                <div style={{ width: '100%', fontSize: '0.5rem' }}>
                  Select to switch context to Book Appointment,
                </div>
              </div>
            </StyledMenuItem>
            <Divider />
          </>
        )}

        {(!localStorage.getItem('API_URL') || !localStorage.getItem('API_URL').includes('/process_text')) && (
          <>
            <StyledMenuItem onClick={() => handleMenuOption('Ask Apollo Cancer Centres')}>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <div style={{ width: '100%'}}>
                  <Icon icon="hugeicons:bot"  width="14px" height="14px" /> Ask Apollo Cancer Centres
                </div>
                <div style={{ width: '100%', fontSize: '0.5rem' }}>
                  Select to switch context to Ask Apollo Bot
                </div>
              </div>
            </StyledMenuItem>
            <Divider />
          </>
        )}

        <StyledMenuItem onClick={() => handleMenuOption('Request Callback')}>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <div style={{ width: '100%' }}>
              <Icon icon="subway:call-1"  width="14px" height="14px"/> Request Callback
            </div>
            <div style={{ width: '100%', fontSize: '0.5rem' }}>
              Select to open Request Callback
            </div>
          </div>
        </StyledMenuItem>
      </StyledMenu> */}
    </div>
  );
};

export default AMAChatBotUI;



