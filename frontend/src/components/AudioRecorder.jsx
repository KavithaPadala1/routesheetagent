import React, { useState, useRef } from "react";
import { Icon } from '@iconify/react';
import './AudioRecorder.css'; // Ensure you create and import this CSS file

const AudioRecorder = ({ onStop, setIsRecording, deleteButton, onDelete }) => {
  const [recording, setRecording] = useState(false);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);

  const startRecording = async () => {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

    mediaRecorderRef.current = new MediaRecorder(stream);
    mediaRecorderRef.current.ondataavailable = (event) => {
      audioChunksRef.current.push(event.data);
    };
    mediaRecorderRef.current.onstop = () => {
      const audioBlob = new Blob(audioChunksRef.current, { type: "audio/wav" });
      onStop(audioBlob);
      audioChunksRef.current = [];
    };

    mediaRecorderRef.current.start();
    setRecording(true);
    setIsRecording(true);
    onDelete(false); 
  };

  const stopRecording = () => {
    mediaRecorderRef.current.stop();
    setRecording(false);
    setIsRecording(false); 
    onDelete(true); 
  };

  const deleteRecording = () => {
    audioChunksRef.current = []; 
    setIsRecording(false); 
    onDelete(false); 
  };

  return (
    <div className="audio-recorder">
      {recording ? (
        <button className="icon-button stop-button" onClick={stopRecording}>
          <Icon icon={'carbon:stop-filled'} style={{ fontSize: 24 }} />
        </button>
      ) : (
        <button className="icon-button mic-button" onClick={startRecording}>
          <Icon icon={'fluent:mic-24-filled'} style={{ fontSize: 24 }} />
        </button>
      )}
    </div>
  );
};

export default AudioRecorder;
