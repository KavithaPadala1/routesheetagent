import React, { useState, useEffect, useRef } from 'react';
import './AudioPlayerStyled.css';
import { Icon } from '@iconify/react';

const AudioPlayer = ({ src }) => {
    const [isPlaying, setIsPlaying] = useState(false);
    const [isMuted, setIsMuted] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);
    const audioRef = useRef(null);

    useEffect(() => {
        const audio = audioRef.current;

        const updateTime = () => {
            if (audio.currentTime && !isNaN(audio.currentTime)) {
                setCurrentTime(audio.currentTime);
            }
        };
        const updateDuration = () => {
            if (audio.duration && !isNaN(audio.duration)) {
                setDuration(audio.duration);
            }
        };

        audio.addEventListener('loadedmetadata', updateDuration);
        audio.addEventListener('timeupdate', updateTime);
        audio.addEventListener('ended', () => setIsPlaying(false));

        return () => {
            audio.removeEventListener('loadedmetadata', updateDuration);
            audio.removeEventListener('timeupdate', updateTime);
        };
    }, []);


    const togglePlayPause = () => {
        const audio = audioRef.current;
        if (audio.paused) {
            audio.play();
            setIsPlaying(true);
        } else {
            audio.pause();
            setIsPlaying(false);
        }
    };

    const toggleSound = () => {
        const audio = audioRef.current;
        audio.muted = !audio.muted;
        setIsMuted(audio.muted);
    };

    const changeSeek = (e) => {
        const audio = audioRef.current;
        audio.currentTime = (audio.duration / 100) * e.target.value;
    };

    const formattedTime = (time) => {
        if (!time || isNaN(time) || !isFinite(time)) {
            return "0:00";
        }
        const minutes = Math.floor(time / 60);
        const seconds = Math.floor(time % 60);
        return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
    };


    return (
        <div className="audio-player">
            <audio ref={audioRef} src={src} preload="auto"></audio>
            <div className="controls">
                <button onClick={togglePlayPause} className="player-button">
                    {isPlaying ? (
                        <span><Icon icon="f7:pause-fill" height={16} width={16} color='#ffffff' /></span>
                    ) : (
                        <span><Icon icon="solar:play-bold" height={16} width={16} color='#ffffff' /></span>
                    )}
                </button>
                <div className="time-display">

                    {formattedTime(currentTime)} {isPlaying ? `${'/' + formattedTime(audioRef.current.duration)}` : ''}
                </div>

                <input
                    type="range"
                    className="timeline"
                    value={(Math.round(audioRef.current?.currentTime) / Math.round(audioRef.current?.duration)) * 100 || 0}
                    onChange={changeSeek}
                    style={{ backgroundSize: `${(Math.round(audioRef.current?.currentTime) / Math.round(audioRef.current?.duration)) * 100 || 0}% 100%` }}
                />
                <button onClick={toggleSound} className="sound-button">
                    {isMuted ? (
                        <span><Icon icon="fluent:speaker-mute-24-filled" height={16} width={16} color='#ffffff' /></span>
                    ) : (
                        <span><Icon icon="ant-design:sound-filled" height={16} width={16} color='#ffffff' /></span>
                    )}
                </button>
            </div>
        </div>
    );
};

export default AudioPlayer;
