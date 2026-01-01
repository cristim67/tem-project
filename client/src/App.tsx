import { useState, useEffect } from 'react';
import VideoPlayer from './components/VideoPlayer';
import Chat from './components/Chat';
import { Search, Cast, Plus, Users, ArrowLeft, MoreHorizontal, Settings } from 'lucide-react';
import { useAudioActivity } from './hooks/useAudioActivity';

interface RoomParticipant {
  id: string;
  name: string;
  role: 'host' | 'guest';
  is_muted: boolean;
  is_video_off: boolean;
  is_speaking?: boolean;
  avatar: string;
}

interface Room {
  id: number;
  room_id: string;
  title: string;
  host_name: string;
  host_avatar: string;
  viewers: string;
  thumbnail: string;
  participants: RoomParticipant[];
}

interface WSMessage {
  type: 'chat' | 'media_state' | 'participant_list' | 'audio_activity' | 'room_closed';
  [key: string]: any;
}

function App() {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [streamSettings, setStreamSettings] = useState({ quality: '1080p', fps: 60 });
  const [searchTerm, setSearchTerm] = useState("");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [newRoomData, setNewRoomData] = useState({ title: "" });
  const [userProfile, setUserProfile] = useState<{name: string, avatar: string}>(() => {
    const saved = localStorage.getItem('streamflow_user');
    return saved ? JSON.parse(saved) : { 
      name: `User_${Math.floor(Math.random() * 999)}`, 
      avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${Math.random()}` 
    };
  });

  useEffect(() => {
    localStorage.setItem('streamflow_user', JSON.stringify(userProfile));
  }, [userProfile]);

  const fetchRooms = async () => {
    try {
      const response = await fetch('http://localhost:8000/rooms');
      const data = await response.json();
      setRooms(data);
    } catch (error) {
      console.error("Failed to fetch rooms:", error);
    } finally {
      // Loading state removed
    }
  };

  useEffect(() => {
    fetchRooms();
    const interval = setInterval(fetchRooms, 10000); // General lobby poll
    return () => clearInterval(interval);
  }, []);

  // Dedicated poll for active room details (faster) - REMOVED for WS
  const [socket, setSocket] = useState<WebSocket | null>(null);

  useEffect(() => {
    if (!selectedRoomId) {
      if (socket) {
        socket.close();
        setSocket(null);
      }
      return;
    }
    
    const ws = new WebSocket(`ws://localhost:8000/ws/${selectedRoomId}/${userProfile.name}`);
    
    ws.onmessage = (event) => {
      const message: WSMessage = JSON.parse(event.data);
      
      if (message.type === 'chat') {
        // Trigger a refresh or local update for chat
        // (Chat component will handle its own fetching or we can pipe it here)
        // For now, let's keep it simple and let components poll or trigger updates
      } else if (message.type === 'media_state') {
        setRooms(prev => prev.map(r => {
          if (r.room_id === selectedRoomId) {
            return {
              ...r,
              participants: r.participants.map(p => {
                if (p.name === message.user_name) {
                  return {
                    ...p,
                    is_muted: message.is_muted ?? p.is_muted,
                    is_video_off: message.is_video_off ?? p.is_video_off
                  };
                }
                return p;
              })
            };
          }
          return r;
        }));
      } else if (message.type === 'audio_activity') {
        setRooms(prev => prev.map(r => {
          if (r.room_id === selectedRoomId) {
            return {
              ...r,
              participants: r.participants.map(p => {
                if (p.name === message.user_name) {
                  return { ...p, is_speaking: message.is_speaking };
                }
                return p;
              })
            };
          }
          return r;
        }));
      } else if (message.type === 'participant_list') {
        setRooms(prev => prev.map(r => {
          if (r.room_id === selectedRoomId) {
            return {
              ...r,
              participants: message.participants
            };
          }
          return r;
        }));
      } else if (message.type === 'room_closed') {
        setSelectedRoomId(null);
        // Refresh rooms list to show it's gone
        fetch('http://localhost:8000/rooms')
          .then(res => res.json())
          .then(data => setRooms(data));
      } else if (message.type === 'ping') {
        ws.send(JSON.stringify({ type: 'pong' }));
      }
    };

    setSocket(ws);
    return () => {
      ws.close();
    };
  }, [selectedRoomId, userProfile.name]);

  // Handle local stream capture
  useEffect(() => {
    let stream: MediaStream | null = null;
    
    const startStreaming = async () => {
      const activeRoom = rooms.find(r => r.room_id === selectedRoomId);
      if (!activeRoom) return;
      
      const myParticipant = activeRoom.participants.find(p => p.name === userProfile.name);
      
      // Hardware Off Logic: Request stream if video is NOT explicitly off OR audio is NOT explicitly muted
      // This applies to both Host and Guests now.
      const shouldHaveStream = myParticipant && (!myParticipant.is_video_off || !myParticipant.is_muted);

      if (selectedRoomId && shouldHaveStream) {
        if (!localStream) {
          try {
            stream = await navigator.mediaDevices.getUserMedia({
              video: true,
              audio: true
            });
            setLocalStream(stream);
          } catch (err) {
            console.error("Failed to get local stream:", err);
          }
        }
      } else {
        // Turn off tracks if we don't need a stream anymore
        if (localStream) {
          localStream.getTracks().forEach(track => track.stop());
          setLocalStream(null);
        }
      }
    };

    startStreaming();

    return () => {
      // Just stop on unmount/selectedRoomId change
    };
  }, [selectedRoomId, rooms]); // Add rooms to re-trigger on participant state change

  // Implementation of distributed frame streaming (browser -> server)
  useEffect(() => {
    const activeRoom = rooms.find(r => r.room_id === selectedRoomId);
    if (!selectedRoomId || !activeRoom || !localStream) return;

    const video = document.createElement('video');
    video.srcObject = localStream;
    video.play();

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    
    let isSending = false;
    let lastSendTime = 0;
    let animationFrame: number;

    const captureFrame = () => {
      const now = Date.now();
      const interval = 1000 / streamSettings.fps;
      
      if (!isSending && ctx && video.readyState >= 2 && socket && socket.readyState === WebSocket.OPEN && (now - lastSendTime > interval)) {
        isSending = true;
        lastSendTime = now;

        let targetWidth = 320;
        if (streamSettings.quality === '720p') targetWidth = 1280;
        else if (streamSettings.quality === '1080p') targetWidth = 1920;

        const targetHeight = (video.videoHeight / video.videoWidth) * targetWidth;
        canvas.width = targetWidth;
        canvas.height = targetHeight;
        ctx.drawImage(video, 0, 0, targetWidth, targetHeight);
        
        // Use higher quality for higher resolutions
        const quality = streamSettings.quality === '360p' ? 0.4 : 0.6;
        const dataUrl = canvas.toDataURL('image/jpeg', quality);
        
        socket.send(JSON.stringify({
          type: 'video_frame',
          data: dataUrl
        }));
        
        isSending = false;
      }
      animationFrame = requestAnimationFrame(captureFrame);
    };

    animationFrame = requestAnimationFrame(captureFrame);

    return () => {
      cancelAnimationFrame(animationFrame);
      video.pause();
      video.srcObject = null;
    };
  }, [selectedRoomId, localStream, socket, rooms, streamSettings]);

  // Audio Activity Sync (Local -> Server)
  const isSpeaking = useAudioActivity(
    localStream || undefined, 
    rooms.find(r => r.room_id === selectedRoomId)?.participants.find(p => p.name === userProfile.name)?.is_muted || false
  );

  useEffect(() => {
    if (socket && socket.readyState === WebSocket.OPEN && selectedRoomId) {
      socket.send(JSON.stringify({
        type: 'audio_activity',
        is_speaking: isSpeaking
      }));
    }
  }, [isSpeaking, socket, selectedRoomId]);

  const handleCreateRoom = async () => {
    if (!newRoomData.title) return;
    
    try {
      const response = await fetch('http://localhost:8000/rooms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: newRoomData.title,
          host_name: userProfile.name
        })
      });
      const newRoom = await response.json();
      setRooms([...rooms, newRoom]);
      setSelectedRoomId(newRoom.room_id);
      setShowCreateModal(false);
      setNewRoomData({ title: "" });
    } catch (error) {
      console.error("Failed to create room:", error);
    }
  };

  const activeRoom = rooms.find(r => r.room_id === selectedRoomId);

  return (
    <div className="h-screen bg-[#050505] text-white flex flex-col font-sans overflow-hidden">
      
      {/* Navbar */}
      <nav className="h-16 bg-[#0F0F0F] border-b border-white/10 flex items-center justify-between px-6 z-20 flex-shrink-0">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2 cursor-pointer" onClick={() => setSelectedRoomId(null)}>
            <div className="bg-theme-accent p-1.5 rounded-lg shadow-lg shadow-theme-accent/20">
               <Cast size={20} className="text-white" />
            </div>
            <span className="text-xl font-bold tracking-tight">Stream<span className="text-theme-accent">Flow</span></span>
          </div>
          <div className="hidden lg:flex items-center gap-6 text-sm font-medium text-white/60">
            <button onClick={() => setSelectedRoomId(null)} className={`${!selectedRoomId ? 'text-white border-b-2 border-theme-accent' : 'hover:text-white'} py-5 transition-all text-sm`}>Lobby</button>
          </div>
        </div>

        <div className="flex-1 max-w-md mx-8 hidden sm:block">
          <div className="relative group">
            <input 
              type="text" 
              placeholder="Search rooms..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-[#1A1A1A] border border-white/5 focus:border-theme-accent/50 text-white rounded-full pl-10 pr-4 py-2 text-sm focus:outline-none transition-all"
            />
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/30" size={16} />
          </div>
        </div>

        <div className="flex items-center gap-4">
          <button 
            onClick={() => setShowCreateModal(true)}
            className="hidden sm:flex items-center gap-2 bg-theme-accent hover:bg-theme-accent/90 text-white px-5 py-2 rounded-full text-sm font-bold transition-all transform hover:scale-105 shadow-xl shadow-theme-accent/30"
          >
            <Plus size={18} />
            <span>New Room</span>
          </button>
          
          <div className="w-9 h-9 rounded-full bg-gradient-to-r from-theme-accent to-purple-500 p-0.5 cursor-pointer hover:scale-105 transition-transform"
               onClick={() => setShowProfileModal(true)}>
             <div className="w-full h-full rounded-full overflow-hidden border-2 border-[#0F0F0F]">
               <img src={userProfile.avatar} alt="User" />
             </div>
          </div>
        </div>
      </nav>

      {/* View Logic */}
      <div className="flex-1 overflow-y-auto">
        <main className="max-w-[1600px] mx-auto p-4 md:p-6 lg:p-8">
          {activeRoom ? (
            /* ROOM DETAIL VIEW */
            <div className="animate-in fade-in duration-500 slide-in-from-bottom-4">
              <div className="flex items-center gap-4 mb-8">
                <button 
                  onClick={() => setSelectedRoomId(null)}
                  className="p-2 hover:bg-white/10 rounded-full text-white/60 hover:text-white transition-all transform hover:-translate-x-1"
                >
                  <ArrowLeft size={24} />
                </button>
                <div className="flex-1 min-w-0">
                  <h1 className="text-2xl font-bold truncate">{activeRoom.title}</h1>
                  <div className="flex items-center gap-2 text-white/40 text-sm mt-1">
                    <span className="text-theme-accent font-medium">{activeRoom.host_name}'s Room</span>
                    <span>•</span>
                    <span className="bg-red-500/10 text-red-500 px-2 py-0.5 rounded text-[10px] font-bold">LIVE</span>
                  </div>
                </div>
                <div className="flex gap-2">
                   <button className="p-2.5 bg-white/5 hover:bg-white/10 rounded-xl text-white/60 transition-colors border border-white/5">
                     <Settings size={20} />
                   </button>
                   <button className="p-2.5 bg-white/5 hover:bg-white/10 rounded-xl text-white/60 transition-colors border border-white/5">
                     <MoreHorizontal size={20} />
                   </button>
                </div>
              </div>

              <div className="flex flex-col xl:flex-row gap-8">
                <div className="flex-1 min-w-0">
                  <VideoPlayer 
                    participants={activeRoom.participants.map(p => {
                      if (p.name === userProfile.name && localStream) {
                        return { ...p, stream: localStream };
                      }
                      return p;
                    })} 
                    hostName={userProfile.name}
                    roomId={selectedRoomId!}
                    onLeave={async () => {
                      const activeRoom = rooms.find(r => r.room_id === selectedRoomId);
                      const isHost = activeRoom && userProfile.name === activeRoom.host_name;
                      
                      if (isHost && selectedRoomId) {
                        try {
                          await fetch(`http://localhost:8000/rooms/${selectedRoomId}/close`, {
                            method: 'POST'
                          });
                        } catch (err) {
                          console.error("Failed to deactivate room:", err);
                        }
                      }
                      setSelectedRoomId(null);
                    }}
                    onToggleAudio={async (muted) => {
                      localStream?.getAudioTracks().forEach(track => track.enabled = !muted);
                      if (socket && socket.readyState === WebSocket.OPEN) {
                        socket.send(JSON.stringify({
                          type: 'media_toggle',
                          is_muted: muted
                        }));
                      }
                    }}
                    onToggleVideo={async (videoOff) => {
                      if (socket && socket.readyState === WebSocket.OPEN) {
                        socket.send(JSON.stringify({
                          type: 'media_toggle',
                          is_video_off: videoOff
                        }));
                      }
                    }}
                    settings={streamSettings}
                    onUpdateSettings={setStreamSettings}
                  />
                </div>

                {/* Chat Container */}
                <div className="w-full xl:w-[400px] h-[600px] xl:h-[700px] bg-[#0F0F0F] rounded-3xl overflow-hidden border border-white/10 shadow-2xl sticky top-8">
                  <Chat userProfile={userProfile} roomId={selectedRoomId} socket={socket} />
                </div>
              </div>
            </div>
          ) : (
            /* LOBBY / BROWSE VIEW */
            <div className="animate-in fade-in duration-500">
              <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12">
                <div>
                  <h1 className="text-4xl font-black tracking-tight mb-2">Active Rooms</h1>
                  <p className="text-white/40 text-lg">Join a discussion or start your own guest session.</p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
                {rooms
                  .filter(r => r.title.toLowerCase().includes(searchTerm.toLowerCase()))
                  .map((room) => (
                  <div 
                    key={room.id} 
                    onClick={() => setSelectedRoomId(room.room_id)}
                    className="group cursor-pointer bg-[#0F0F0F] border border-white/5 rounded-3xl overflow-hidden hover:border-theme-accent/30 hover:shadow-2xl hover:shadow-theme-accent/5 transition-all"
                  >
                    <div className="relative aspect-video overflow-hidden">
                      <img 
                        src={`https://picsum.photos/seed/${room.room_id}/800/450`} 
                        alt={room.title} 
                        className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110 opacity-60" 
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-transparent"></div>
                      <div className="absolute top-3 left-3 flex gap-2">
                        <span className="bg-red-600 text-white text-[9px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider animate-pulse">LIVE</span>
                        <span className="bg-black/60 backdrop-blur-md text-white text-[9px] font-bold px-1.5 py-0.5 rounded flex items-center gap-1 uppercase tracking-wider">
                          <Users size={10} /> {room.participants.length}
                        </span>
                      </div>
                      
                      <div className="absolute bottom-3 left-3 right-3 flex justify-between items-center translate-y-2 opacity-0 group-hover:translate-y-0 group-hover:opacity-100 transition-all">
                         <div className="flex -space-x-2">
                           <img src={room.host_avatar} className="w-6 h-6 rounded-full ring-2 ring-black" alt="" />
                           {room.participants.filter(p => p.role === 'guest').map((g, idx) => (
                             <img key={idx} src={g.avatar} className="w-6 h-6 rounded-full ring-2 ring-black" alt="" />
                           ))}
                         </div>
                         <span className="text-[10px] font-bold text-white/60 bg-white/10 px-2 py-0.5 rounded-full backdrop-blur-sm">View Room</span>
                      </div>
                    </div>
                    
                    <div className="p-5">
                       <h3 className="text-base font-bold text-white mb-2 line-clamp-2 leading-snug group-hover:text-theme-accent transition-colors">
                        {room.title}
                      </h3>
                      <div className="flex items-center gap-2 mb-4">
                        <div className="w-6 h-6 rounded-full overflow-hidden border border-white/10">
                           <img src={room.host_avatar} alt="" />
                        </div>
                        <span className="text-xs text-white/50">{room.host_name}</span>
                      </div>
                      <div className="flex items-center justify-end pt-4 border-t border-white/5">
                        <div className="flex gap-2">
                          <div className="w-1.5 h-1.5 rounded-full bg-theme-accent"></div>
                          <div className="w-1.5 h-1.5 rounded-full bg-theme-accent/40"></div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </main>
      </div>
      {/* CREATE ROOM MODAL */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowCreateModal(false)}></div>
          <div className="relative bg-[#1A1A1A] w-full max-w-md rounded-3xl p-8 border border-white/10 shadow-2xl animate-in zoom-in-95 duration-200">
            <h2 className="text-2xl font-black mb-6">Create New Room</h2>
            <div className="space-y-4">
              <div>
                <label className="text-xs font-bold text-white/40 uppercase mb-2 block">Room Title</label>
                <input 
                  type="text" 
                  value={newRoomData.title}
                  onChange={(e) => setNewRoomData({...newRoomData, title: e.target.value})}
                  placeholder="e.g. My Amazing Stream"
                  className="w-full bg-[#0A0A0A] border border-white/5 rounded-xl px-4 py-3 text-sm focus:border-theme-accent outline-none transition-all"
                />
              </div>
              <div className="pt-6">
                <button 
                  onClick={handleCreateRoom}
                  disabled={!newRoomData.title}
                  className="w-full bg-theme-accent hover:bg-theme-accent/80 disabled:opacity-50 disabled:cursor-not-allowed text-white py-3 rounded-xl font-bold transition-all shadow-lg shadow-theme-accent/20"
                >
                  Start Streaming
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* PROFILE MODAL */}
      {showProfileModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowProfileModal(false)}></div>
          <div className="relative bg-[#1A1A1A] w-full max-w-md rounded-3xl p-8 border border-white/10 shadow-2xl animate-in zoom-in-95 duration-200">
            <h2 className="text-2xl font-black mb-6">Edit Profile</h2>
            <div className="flex flex-col items-center gap-6">
              <div className="w-24 h-24 rounded-full bg-gradient-to-r from-theme-accent to-purple-500 p-1 relative">
                <img src={userProfile.avatar} className="w-full h-full rounded-full border-4 border-[#1A1A1A]" alt="" />
                <button 
                  onClick={() => setUserProfile({...userProfile, avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${Date.now()}`})}
                  className="absolute bottom-0 right-0 bg-theme-accent p-2 rounded-full shadow-lg border-2 border-[#1A1A1A] hover:scale-110 transition-all text-white"
                >
                  <Settings size={14} />
                </button>
              </div>
              <div className="w-full">
                <label className="text-xs font-bold text-white/40 uppercase mb-2 block">Display Name</label>
                <input 
                  type="text" 
                  value={userProfile.name}
                  onChange={(e) => setUserProfile({...userProfile, name: e.target.value})}
                  className="w-full bg-[#0A0A0A] border border-white/5 rounded-xl px-4 py-3 text-sm focus:border-theme-accent outline-none transition-all"
                />
              </div>
              <button 
                onClick={() => setShowProfileModal(false)}
                className="w-full bg-white/5 hover:bg-white/10 text-white py-3 rounded-xl font-bold transition-all"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
