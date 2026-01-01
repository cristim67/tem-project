import React, { useEffect, useRef, useState } from 'react';
import { 
  Maximize2, Settings, 
  Users, Mic, MicOff, Video, VideoOff, Plus
} from 'lucide-react';

import { useAudioActivity } from '../hooks/useAudioActivity';

export interface Participant {
  id: string | number;
  name: string;
  role: 'host' | 'guest';
  is_muted: boolean;
  is_video_off: boolean;
  is_speaking?: boolean;
  avatar: string;
  stream?: MediaStream; // Real media stream from the browser
}

interface VideoPlayerProps {
  participants: Participant[];
  hostName: string;
  roomId: string;
  settings: { quality: string; fps: number };
  onUpdateSettings: (settings: { quality: string; fps: number }) => void;
  onLeave: () => void;
  onToggleAudio: (muted: boolean) => void;
  onToggleVideo: (videoOff: boolean) => void;
}

// Local hook extracted to hooks/useAudioActivity.ts

const VideoSlot: React.FC<{ participant: Participant; hostName: string; roomId: string }> = ({ participant, hostName, roomId }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  
  // Use local hook for self-stream, otherwise use synced prop from server
  const localIsSpeaking = useAudioActivity(participant.stream, participant.is_muted);
  const isSpeaking = participant.stream ? localIsSpeaking : participant.is_speaking;

  useEffect(() => {
    if (videoRef.current && participant.stream) {
      videoRef.current.srcObject = participant.stream;
    }
  }, [participant.stream, participant.is_video_off]);

  return (
    <div className={`relative bg-[#1A1A1A] rounded-xl overflow-hidden group/participant border-2 transition-all duration-300 shadow-inner ${isSpeaking ? 'border-theme-accent shadow-[0_0_20px_rgba(255,107,107,0.3)]' : 'border-white/5'}`}>
      {participant.is_video_off ? (
        <div className="absolute inset-0 flex items-center justify-center bg-[#111]">
          <img 
            src={participant.avatar} 
            alt={participant.name} 
            className="w-24 h-24 rounded-full border-4 border-white/10 opacity-50 shadow-2xl" 
          />
        </div>
      ) : participant.stream ? (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted={participant.name === hostName} // Mute local self
          className="w-full h-full object-cover transition-opacity duration-300 transform scale-[1.01]"
        />
      ) : (
        <img 
          src={`http://localhost:8000/rooms/${roomId}/video_feed/${participant.name}`} 
          alt={`${participant.name}'s Stream`}
          className="w-full h-full object-cover"
          onError={(e) => {
            const target = e.target as HTMLImageElement;
            target.src = participant.avatar;
            target.className = "w-24 h-24 rounded-full border-4 border-white/10 opacity-50 shadow-2xl m-auto";
          }}
        />
      )}
      
      {/* Participant Label */}
      <div className="absolute bottom-3 left-3 flex items-center gap-2 bg-black/60 backdrop-blur-md px-2.5 py-1.5 rounded-lg border border-white/10 transition-transform group-hover/participant:scale-105">
        <div className="relative flex items-center justify-center">
          {isSpeaking && (
            <span className="absolute w-4 h-4 bg-theme-accent/40 rounded-full animate-ping"></span>
          )}
          <span className={`w-2 h-2 rounded-full relative z-10 ${participant.role === 'host' ? 'bg-red-500' : 'bg-green-500'}`}></span>
        </div>
        <span className="text-[11px] font-bold text-white uppercase tracking-tight">{participant.name}</span>
        <span className="text-[9px] text-white/40 font-medium px-1.5 py-0.5 bg-white/5 rounded">
          {participant.role.toUpperCase()}
        </span>
        <div className="flex gap-1.5 ml-1 border-l border-white/20 pl-2">
          {participant.is_muted ? <MicOff size={10} className="text-red-400" /> : <Mic size={10} className={`${isSpeaking ? 'text-theme-accent animate-bounce' : 'text-white/60'}`} />}
          {participant.is_video_off ? <VideoOff size={10} className="text-red-400" /> : <Video size={10} className="text-white/60" />}
        </div>
      </div>
    </div>
  );
};

const VideoPlayer: React.FC<VideoPlayerProps> = ({ 
  participants, hostName, roomId, settings, onUpdateSettings, onLeave, onToggleAudio, onToggleVideo 
}) => {
  const [showControls, setShowControls] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const localParticipant = participants.find(p => p.stream || p.name === hostName);

  // Layout logic based on participant count
  const getGridClass = () => {
    switch (participants.length) {
      case 1: return 'grid-cols-1';
      case 2: return 'grid-cols-2';
      default: return 'grid-cols-2 lg:grid-cols-3';
    }
  };

  // Controls should reflect the current state of the local participant from props
  const currentMuted = localParticipant?.is_muted || false;
  const currentVideoOff = localParticipant?.is_video_off || false;

  const handleToggleAudio = () => {
    onToggleAudio(!currentMuted);
  };

  const handleToggleVideo = () => {
    onToggleVideo(!currentVideoOff);
  };

  return (
    <div 
      className="relative w-full aspect-video bg-[#0A0A0A] rounded-2xl overflow-hidden group shadow-2xl ring-1 ring-white/10"
      onMouseEnter={() => setShowControls(true)}
      onMouseLeave={() => setShowControls(false)}
    >
      {/* Participants Grid */}
      <div className={`grid h-full gap-2 p-2 ${getGridClass()}`}>
        {participants.map((p) => (
          <VideoSlot key={p.id} participant={p} hostName={hostName} roomId={roomId} />
        ))}
      </div>

      {/* Primary Stream Overlay (Floating Badge) */}
      <div className="absolute top-4 left-4 flex gap-2">
        <span className="bg-red-600 text-white text-[10px] font-bold px-2 py-0.5 rounded shadow-lg shadow-red-600/20">LIVE</span>
        <span className="bg-black/80 backdrop-blur-md text-white/90 text-[10px] font-bold px-2 py-0.5 rounded flex items-center gap-1.5 border border-white/10">
          <Users size={12} fill="currentColor" />
          {participants.length} Active
        </span>
      </div>

      {/* Bottom Controls Bar */}
      <div className={`absolute bottom-0 left-0 right-0 h-20 bg-gradient-to-t from-black/90 to-transparent flex items-end justify-center pb-4 transition-transform duration-300 ${showControls ? 'translate-y-0' : 'translate-y-full'}`}>
        <div className="bg-white/10 backdrop-blur-md px-6 py-2.5 rounded-2xl flex items-center gap-6 border border-white/20 shadow-2xl">
          {localParticipant && (
            <>
              <button 
                onClick={handleToggleAudio}
                className={`${currentMuted ? 'text-red-400' : 'text-white/60 hover:text-white'} transition-colors relative group`}
              >
                {currentMuted ? <MicOff size={22} /> : <Mic size={22} />}
                <span className="absolute -top-10 left-1/2 -translate-x-1/2 bg-black text-white text-[10px] px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                  {currentMuted ? 'Unmute' : 'Mute'}
                </span>
              </button>
              
              <button 
                onClick={handleToggleVideo}
                className={`${currentVideoOff ? 'text-red-400' : 'text-white/60 hover:text-white'} transition-colors relative group`}
              >
                {currentVideoOff ? <VideoOff size={22} /> : <Video size={22} />}
                <span className="absolute -top-10 left-1/2 -translate-x-1/2 bg-black text-white text-[10px] px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                  {currentVideoOff ? 'Start Video' : 'Stop Video'}
                </span>
              </button>
              
              <div className="w-px h-6 bg-white/10 mx-2"></div>
            </>
          )}
          
          <button 
            onClick={onLeave}
            className="bg-red-500 hover:bg-red-600 text-white px-6 py-1.5 rounded-xl text-sm font-bold transition-all shadow-lg shadow-red-500/20 active:scale-95"
          >
            Leave Room
          </button>
          
          <div className="w-px h-6 bg-white/10 mx-2"></div>

          <div className="flex items-center gap-4">
            <button 
              onClick={() => setShowSettings(!showSettings)}
              className={`${showSettings ? 'text-theme-accent' : 'text-white/60 hover:text-white'} transition-colors hover:scale-110`}
            >
              <Settings size={20} className={showSettings ? 'animate-spin-slow' : ''} />
            </button>
            <button className="text-white/60 hover:text-white transition-colors hover:scale-110">
              <Maximize2 size={20} />
            </button>
          </div>
        </div>
      </div>

      {/* Settings Modal Overlay */}
      {showSettings && (
        <div className="absolute top-4 right-4 z-40 w-64 bg-[#0F0F0F]/90 backdrop-blur-xl rounded-2xl border border-white/10 p-5 shadow-2xl animate-in fade-in zoom-in-95 duration-200">
          <div className="flex items-center justify-between mb-6">
            <h4 className="text-[10px] font-black uppercase tracking-widest text-white/50">Stream Settings</h4>
            <button onClick={() => setShowSettings(false)} className="text-white/20 hover:text-white transition-colors">
              <Plus size={18} className="rotate-45" />
            </button>
          </div>

          <div className="space-y-6">
            {/* Resolution */}
            <div>
              <label className="text-[10px] font-bold text-white/30 uppercase mb-3 block">Video Resolution</label>
              <div className="grid grid-cols-3 gap-2">
                {['360p', '720p', '1080p'].map(q => (
                  <button 
                    key={q}
                    onClick={() => onUpdateSettings({ ...settings, quality: q })}
                    className={`py-2 rounded-lg text-[10px] font-bold transition-all border ${settings.quality === q ? 'bg-theme-accent border-theme-accent text-white shadow-lg shadow-theme-accent/20' : 'bg-white/5 border-white/5 text-white/40 hover:bg-white/10'}`}
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>

            {/* Framerate */}
            <div>
              <label className="text-[10px] font-bold text-white/30 uppercase mb-3 block">Performance (FPS)</label>
              <div className="grid grid-cols-3 gap-2">
                {[10, 30, 60].map(f => (
                  <button 
                    key={f}
                    onClick={() => onUpdateSettings({ ...settings, fps: f })}
                    className={`py-2 rounded-lg text-[10px] font-bold transition-all border ${settings.fps === f ? 'bg-theme-accent border-theme-accent text-white shadow-lg shadow-theme-accent/20' : 'bg-white/5 border-white/5 text-white/40 hover:bg-white/10'}`}
                  >
                    {f} FPS
                  </button>
                ))}
              </div>
            </div>

            <div className="pt-2 border-t border-white/5">
              <div className="flex justify-between items-center bg-white/5 p-3 rounded-xl border border-white/5">
                 <span className="text-[10px] font-bold text-white/60">Auto-Adjust</span>
                 <div className="w-8 h-4 bg-theme-accent rounded-full relative">
                    <div className="absolute right-0.5 top-0.5 w-3 h-3 bg-white rounded-full"></div>
                 </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default VideoPlayer;
