import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { ChatCircleDots, PaperPlaneRight, Microphone, MicrophoneSlash, X, Sparkle } from '@phosphor-icons/react';

const API_BASE = 'http://localhost:5000/api';

const Chatbot = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState([
    { text: "Hi! I'm InventAI's operations assistant 🧠. Ask me anything about stock thresholds, demand predictions, or pricing clearance!", isBot: true }
  ]);
  const [listening, setListening] = useState(false);
  const messagesEndRef = useRef(null);
  const recognitionRef = useRef(null);

  // Auto scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isOpen]);

  // Initialize Speech Recognition
  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      const rec = new SpeechRecognition();
      rec.continuous = false;
      rec.interimResults = false;
      rec.lang = 'en-US';

      rec.onstart = () => setListening(true);
      rec.onend = () => setListening(false);
      rec.onresult = (e) => {
        const transcript = e.results[0][0].transcript;
        setInput(transcript);
      };
      
      recognitionRef.current = rec;
    }
  }, []);

  const toggleSpeech = () => {
    if (!recognitionRef.current) {
      alert("Speech recognition is not supported in this browser. Please use Google Chrome.");
      return;
    }
    if (listening) {
      recognitionRef.current.stop();
    } else {
      recognitionRef.current.start();
    }
  };

  const handleSend = async (e) => {
    if (e) e.preventDefault();
    if (!input.trim()) return;

    const userText = input;
    setInput('');
    setMessages(prev => [...prev, { text: userText, isBot: false }]);

    try {
      const res = await axios.post(`${API_BASE}/chatbot/query`, { query: userText });
      setMessages(prev => [...prev, { text: res.data.reply, isBot: true }]);
    } catch (err) {
      console.error(err);
      setMessages(prev => [...prev, { text: "⚠️ Error contacting chatbot server. Please check that backend server is active.", isBot: true }]);
    }
  };

  return (
    <>
      {/* Floating Chat Circle */}
      <div className="ai-chatbot-toggle" onClick={() => setIsOpen(!isOpen)} title="InventAI Virtual Assistant">
        {isOpen ? <X weight="bold" /> : <ChatCircleDots weight="fill" />}
      </div>

      {/* Slide-in Assistant Panel */}
      {isOpen && (
        <div className="ai-chatbot-panel glass-card">
          {/* Header */}
          <div className="chatbot-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Sparkle size={20} className="text-accent-gradient" weight="fill" />
              <div>
                <h4 style={{ margin: 0, fontWeight: 700, fontSize: '0.95rem' }}>InventAI Intelligent Agent</h4>
                <p style={{ margin: 0, fontSize: '0.72rem', opacity: 0.85 }}>FastAPI & XGBoost Core</p>
              </div>
            </div>
          </div>

          {/* Messages Stream */}
          <div className="chatbot-messages">
            {messages.map((m, index) => (
              <div key={index} className={`chat-bubble ${m.isBot ? 'bot' : 'user'}`}>
                {m.text}
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>

          {/* Input Footer */}
          <form className="chatbot-footer" onSubmit={handleSend}>
            <button type="button" className={`mic-btn ${listening ? 'listening' : ''}`} onClick={toggleSpeech} title="Speak commands">
              {listening ? <Microphone weight="fill" /> : <MicrophoneSlash />}
            </button>
            
            <input 
              type="text" 
              className="chatbot-input" 
              placeholder="Ask which products are low..." 
              value={input}
              onChange={e => setInput(e.target.value)}
            />

            <button type="submit" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <PaperPlaneRight size={22} weight="fill" />
            </button>
          </form>
        </div>
      )}
    </>
  );
};

export default Chatbot;
