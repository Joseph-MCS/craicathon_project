import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';

// Interfaces
interface Message {
  id: string;
  sender: 'user' | 'ai';
  text: string;
  translation?: string;
}

interface GrammarCorrection {
  original: string;
  suggestion: string;
  explanation: string;
}

// Hooks (Inlined for single file, should be separate)
const useSpeechToText = (onTranscript: (text: string) => void) => {
  const [isListening, setIsListening] = useState(false);
  const [isSupported, setIsSupported] = useState(true);
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.lang = 'ga-IE'; // Irish Language
      recognitionRef.current.continuous = false;
      recognitionRef.current.interimResults = false;

      recognitionRef.current.onresult = (event: any) => {
        // console.log('Speech result:', event);
        const transcript = event.results[0][0].transcript;
        if (transcript) {
          onTranscript(transcript);
        }
        setIsListening(false);
      };

      recognitionRef.current.onerror = (event: any) => {
        console.error('Speech recognition error details:', event);
        if (event.error === 'no-speech') {
          // Ignore no-speech error, just stop listening
        } else {
          alert(`Error: ${event.error}`);
        }
        setIsListening(false);
      };

      recognitionRef.current.onend = () => {
        setIsListening(false);
      };
    } else {
      setIsSupported(false);
    }
  }, [onTranscript]);

  const startListening = () => {
    if (recognitionRef.current) {
      try {
        setIsListening(true);
        recognitionRef.current.start();
      } catch (e) {
        console.error("Failed to start recognition:", e);
        setIsListening(false);
      }
    } else {
      alert('Speech recognition not supported in this browser. Please use Chrome, Edge, or Safari, or type your message below.');
    }
  };

  const stopListening = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      setIsListening(false);
    }
  };

  return { isListening, isSupported, startListening, stopListening };
};

const useTextToSpeech = () => {
  const [isPlaying, setIsPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const speak = async (text: string) => {
    try {
      setIsPlaying(true);
      const response = await axios.post('http://localhost:3001/api/tts', { text });
      
      if (response.data.audioUrl) {
        if (audioRef.current) {
          audioRef.current.pause();
        }
        audioRef.current = new Audio(response.data.audioUrl);
        audioRef.current.onended = () => setIsPlaying(false);
        audioRef.current.play();
      }
    } catch (error) {
      console.error('TTS Error:', error);
      setIsPlaying(false);
    }
  };

  return { isPlaying, speak };
};

// Main Component
export default function ConversationInterface() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [corrections, setCorrections] = useState<GrammarCorrection[]>([]);
  const [inputText, setInputText] = useState('');
  const { isListening, isSupported, startListening, stopListening } = useSpeechToText(handleUserMessage);
  const { isPlaying, speak } = useTextToSpeech();

  async function handleUserMessage(text: string) {
    const newMessage: Message = { id: Date.now().toString(), sender: 'user', text };
    setMessages(prev => [...prev, newMessage]);

    // Check grammar
    try {
      const grammarRes = await axios.post('http://localhost:3001/api/grammar', { text });
      if (grammarRes.data.corrections.length > 0) {
        setCorrections(grammarRes.data.corrections);
      }
    } catch (e) { console.error(e); }

    // Get AI response
    try {
      const chatRes = await axios.post('http://localhost:3001/api/chat', { message: text, history: messages });
      const aiMessage: Message = { id: (Date.now() + 1).toString(), sender: 'ai', text: chatRes.data.reply };
      setMessages(prev => [...prev, aiMessage]);
      speak(chatRes.data.reply);
    } catch (e) { console.error(e); }
  }

  const handleTextSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputText.trim()) {
      handleUserMessage(inputText);
      setInputText('');
    }
  };

  return (
    <div className="conversation-container">
      <header>
        <h1>Craicathon - Learn Irish</h1>
      </header>
      
      <div className="main-content">
        <div className="chat-area">
          {messages.length === 0 && (
            <div className="empty-state">
              <p>Dia duit! Start a conversation in Irish.</p>
              {!isSupported && <p className="warning">⚠️ Speech recognition is not supported in this browser. Please use Chrome/Edge or type below.</p>}
            </div>
          )}
          {messages.map(msg => (
            <div key={msg.id} className={`message ${msg.sender}`}>
              <p>{msg.text}</p>
              {msg.translation && <small>{msg.translation}</small>}
            </div>
          ))}
        </div>

        <aside className="feedback-sidebar">
          <h3>Feedback</h3>
          {corrections.map((corr, idx) => (
            <div key={idx} className="correction">
              <span className="original strike">{corr.original}</span>
              <span className="suggestion">{corr.suggestion}</span>
              <p className="explanation">{corr.explanation}</p>
            </div>
          ))}
        </aside>
      </div>

      <div className="controls">
        {isSupported && (
          <button 
            onClick={isListening ? stopListening : startListening}
            className={isListening ? 'listening' : ''}
          >
            {isListening ? 'Listening...' : 'Speak Irish'}
          </button>
        )}
        
        <form onSubmit={handleTextSubmit} className="text-input-form">
          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder="Type Irish here..."
            disabled={isListening}
          />
          <button type="submit" disabled={!inputText.trim() || isListening}>
            Send
          </button>
        </form>
      </div>
    </div>
  );
}
