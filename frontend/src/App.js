// import React, { useEffect } from 'react';
// import './App.css';
// import { Icon } from '@iconify/react';
// import AMAChatBotUI from './AMA-ChatBotUI';
// // import ChatBotUI from './ChatBotUI';
// import JsonDynamicForm from './components/DynamicForm';
// import JsonDynamicFormPOC from './components/DynamicFormPOC';

// const App = () => {
//   const toggleChatbot = () => {
//     document.body.classList.toggle('show-chatbot');
//   };

//   const jsonInput = {
//     firstName: "Alice",
//     lastName: "Smith",
//     age: 28,
//     isActive: true,
//     heightInCm: 165.5,
//     contactPreferences: ["Email", "SMS", "Phone"],
//     address: {
//       street: "123 Main St",
//       city: "Springfield",
//       state: "IL",
//       postalCode: "62704"
//     },
//     newsletterSubscribed: false,
//     favoriteColors: ["Red", "Blue", "Green"],
//     accountBalance: 2500.75,
//     membershipStatus: "Gold",
//     birthDate: "1995-03-15",
//     notifications: {
//       email: true,
//       sms: false,
//       push: true
//     }
//   };

//   // Helper to get previous messages from sessionStorage if available
//   const getPrevMessages = () => {
//     const stored = sessionStorage.getItem('chatbotMessages');
//     if (stored) {
//       try {
//         const arr = JSON.parse(stored);
//         // Map 'incoming' to 'assistant' and 'outgoing' to 'user', flatten content if array
//         const mapped = arr.map(msg => ({
//           role: msg.role
//             ? msg.role
//             : (msg.type === 'incoming' ? 'assistant' : (msg.type === 'outgoing' ? 'user' : 'user')),
//           content: Array.isArray(msg.text || msg.content) ? (msg.text || msg.content).join(' ') : (msg.text || msg.content)
//         }));
//         // Return only the last two messages
//         return mapped.slice(-2);
//       } catch {
//         return null;
//       }
//     }
//     return null;
//   };



//   useEffect(()=>{
//     window.onload = () => {
//       sessionStorage.removeItem('chatbotMessages'); // Clears only the chatbotMessages key
//     };
    
    
//   });

//   return (
//     <div className="App">
//       <button className="chatbot-toggler" onClick={toggleChatbot}>
//         <span className="material-symbols-rounded">
//           <Icon icon={'hugeicons:chat-bot'} style={{ fontSize: 40, color: 'blue' }} />
//         </span>
//         <span className="material-symbols-outlined">
//           <Icon icon={'hugeicons:chat-bot'} style={{ fontSize: 40, color: 'white' }} />
//         </span>
//       </button>
//       {/* <JsonDynamicForm /> */}
//       {/* <JsonDynamicFormPOC /> */}
//       {/* <DateTimePickerPOC /> */}
//       <AMAChatBotUI onSendMessage={sendMessageToBackend} />
//     </div>
//   );
// };

// export default App;





import React, { useEffect } from 'react';
import './App.css';
import { Icon } from '@iconify/react';
import AMAChatBotUI from './AMA-ChatBotUI';
// import ChatBotUI from './ChatBotUI';
import JsonDynamicForm from './components/DynamicForm';
import JsonDynamicFormPOC from './components/DynamicFormPOC';

const App = () => {
  const toggleChatbot = () => {
    document.body.classList.toggle('show-chatbot');
  };

  const jsonInput = {
    firstName: "Alice",
    lastName: "Smith",
    age: 28,
    isActive: true,
    heightInCm: 165.5,
    contactPreferences: ["Email", "SMS", "Phone"],
    address: {
      street: "123 Main St",
      city: "Springfield",
      state: "IL",
      postalCode: "62704"
    },
    newsletterSubscribed: false,
    favoriteColors: ["Red", "Blue", "Green"],
    accountBalance: 2500.75,
    membershipStatus: "Gold",
    birthDate: "1995-03-15",
    notifications: {
      email: true,
      sms: false,
      push: true
    }
  };

  // Helper to get previous messages from sessionStorage if available
  const getPrevMessages = () => {
    const stored = sessionStorage.getItem('chatbotMessages');
    if (stored) {
      try {
        const arr = JSON.parse(stored);
        // Map 'incoming' to 'assistant' and 'outgoing' to 'user', flatten content if array
        const mapped = arr.map(msg => ({
          role: msg.role
            ? msg.role
            : (msg.type === 'incoming' ? 'assistant' : (msg.type === 'outgoing' ? 'user' : 'user')),
          content: Array.isArray(msg.text || msg.content) ? (msg.text || msg.content).join(' ') : (msg.text || msg.content)
        }));
        // Return only the last two messages
        return mapped.slice(-4);
      } catch {
        return null;
      }
    }
    return null;
  };

  const sendMessageToBackend = async (message, session_id = null, prev_msgs = null) => {

    const token = "MSZDRURFTU9ORVcwMzE0JkNFREVNTyA=";  // cedemo token
    // const token = "MSZPQU1TXzMxX05FVyZPQU1TXzMx";  // oams token
    // const token = "MSZPTlIwMzE0MjAyMyZPTlJQUkQ="; // onrprd token
    // If prev_msgs not provided, try to get from sessionStorage
    const prevMessages = prev_msgs || getPrevMessages();
    const payload = {
      query: message,
      token: token,
      session_id: session_id,
      prev_msgs: prevMessages
    };
    // const response = await fetch("https://gasops-oq-e6f2evgmhfepbvhd.eastus-01.azurewebsites.net/ask", {   
    // const response = await fetch("https://gasops-oq-e6f2evgmhfepbvhd.eastus-01.azurewebsites.net/ask", {
    const response = await fetch("http://localhost:8000/ask", {
    // const response = await fetch("https://gasops-prod-routesheet-backend-fabric-ftd0hyh6hwfjhmbr.eastus-01.azurewebsites.net/ask", {

      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "encoded-string": token // Use dash, not underscore, for FastAPI header
      },
      body: JSON.stringify(payload)
    });
    if (!response.ok) {
      throw new Error("Network response was not ok");
    }
    return response.json();
  };

  useEffect(()=>{
    window.onload = () => {
      sessionStorage.removeItem('chatbotMessages'); // Clears only the chatbotMessages key
    };
    
    
  });

  return (
    <div className="App">
      <button className="chatbot-toggler" onClick={toggleChatbot}>
        <span className="material-symbols-rounded">
          <Icon icon={'hugeicons:chat-bot'} style={{ fontSize: 40, color: 'blue' }} />
        </span>
        <span className="material-symbols-outlined">
          <Icon icon={'hugeicons:chat-bot'} style={{ fontSize: 40, color: 'white' }} />
        </span>
      </button>
      {/* <JsonDynamicForm /> */}
      {/* <JsonDynamicFormPOC /> */}
      {/* <DateTimePickerPOC /> */}
      <AMAChatBotUI onSendMessage={sendMessageToBackend} />
    </div>
  );
};

export default App;
