import React, { useState, useEffect, useRef } from 'react';
import { Send, Smile, User } from 'lucide-react';

interface Message {
  id: number;
  user_name: string;
  color: string;
  text: string;
}

interface ChatProps {
  userProfile: { name: string; avatar: string };
  roomId: string | null;
  socket: WebSocket | null;
}

const Chat: React.FC<ChatProps> = ({ userProfile, roomId, socket }) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const fetchMessages = async () => {
    if (!roomId) return;
    try {
      const response = await fetch(`http://localhost:8000/rooms/${roomId}/messages`);
      const data = await response.json();
      setMessages(data);
    } catch (err) {
      console.error("Failed to fetch messages:", err);
    }
  };

  useEffect(() => {
    if (roomId) {
      fetchMessages();
    }
  }, [roomId]);

  // Handle incoming WS messages
  useEffect(() => {
    if (!socket) return;

    const handleMessage = (event: MessageEvent) => {
      const data = JSON.parse(event.data);
      if (data.type === 'chat') {
        const newMessage: Message = {
          id: data.id,
          user_name: data.user_name,
          color: data.color,
          text: data.text
        };
        setMessages(prev => {
          if (prev.some(m => m.id === newMessage.id)) return prev;
          return [...prev, newMessage];
        });
      }
    };

    socket.addEventListener('message', handleMessage);
    return () => socket.removeEventListener('message', handleMessage);
  }, [socket]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim() || !roomId) return;
    
    const text = inputValue.trim();
    setInputValue("");

    if (socket && socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify({
        type: 'chat',
        text: text,
        color: "#theme-accent"
      }));
    } else {
      // Fallback
      try {
        await fetch(`http://localhost:8000/rooms/${roomId}/messages`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            user_name: userProfile.name,
            text: text,
            color: "#theme-accent"
          })
        });
        // fetchMessages() is no longer needed here as WS will broadcast it back
      } catch (err) {
        console.error("Failed to send message:", err);
      }
    }
  };

  return (
    <div className="flex flex-col h-full bg-[#0F0F0F] border-l border-white/10">
      <div className="p-4 border-b border-white/10 flex justify-between items-center bg-[#0F0F0F]">
        <h3 className="font-semibold text-white/90 text-sm uppercase tracking-wider">Stream Chat</h3>
        <button className="text-white/50 hover:text-white transition-colors">
          <User size={18} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3 scrollbar-thin scrollbar-thumb-white/20 scrollbar-track-transparent">
        {messages.map((msg) => (
          <div key={msg.id} className="text-sm break-words animate-in fade-in slide-in-from-left-2 duration-300">
            <span style={{ color: msg.color }} className="font-bold cursor-pointer hover:underline mr-2">
              {msg.user_name || "Guest"}:
            </span>
            <span className="text-white/80">{msg.text}</span>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      <div className="p-4 bg-[#0F0F0F] border-t border-white/10">
        <form onSubmit={handleSend} className="relative">
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder="Send a message..."
            className="w-full bg-[#1F1F1F] text-white rounded-lg pl-4 pr-12 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-theme-accent/50 border border-transparent focus:border-theme-accent/50 transition-all placeholder:text-white/30"
          />
          <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
            <button type="button" className="p-1.5 text-white/40 hover:text-white transition-colors">
              <Smile size={18} />
            </button>
            <button 
              type="submit" 
              disabled={!inputValue.trim()}
              className="p-1.5 text-theme-accent hover:text-theme-accent/80 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Send size={18} />
            </button>
          </div>
        </form>
        <div className="mt-2 flex justify-between items-center text-xs text-white/40">
           <span>0/200</span>
           <button className="hover:text-theme-accent transition-colors">Chat Rules</button>
        </div>
      </div>
    </div>
  );
};

export default Chat;
