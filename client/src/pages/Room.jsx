import React, { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import io from 'socket.io-client';
import axios from 'axios';
import VideoPlayer from '../components/VideoPlayer';
import Chat from '../components/Chat';
import UploadArea from '../components/UploadArea';
import UserList from '../components/UserList';

const SERVER = import.meta.env.VITE_SERVER_URL || 'http://localhost:4000';

const socket = io(SERVER, { autoConnect: false });

export default function Room() {
  const { roomId } = useParams();
  const [user, setUser] = useState(null);
  const [users, setUsers] = useState([]);
  const [hostId, setHostId] = useState(null);
  const [video, setVideo] = useState(null);
  const [logs, setLogs] = useState([]);
  const [playbackState, setPlaybackState] = useState({ playing: false, time: 0 });

  // connect socket once
  useEffect(() => {
    socket.connect();

    // create guest
    const guestName = `Guest-${Math.floor(100 + Math.random() * 900)}`;
    socket.emit('room:join', { roomId, username: guestName }, (res) => {
      if (res?.ok) {
        setUser(res.user);
      } else {
        alert('Could not join room');
      }
    });

    // handlers
    socket.on('room:state', (state) => {
      setUsers(state.users || []);
      setHostId(state.hostId);
      setVideo(state.video || null);
      setLogs(state.logs || []);
      setPlaybackState(state.playbackState || { playing: false, time: 0 });
    });

    socket.on('room:user_list', ({ users }) => setUsers(users));
    socket.on('room:user_joined', ({ user, log }) => {
      setLogs((s) => [...s, log]);
      setUsers((u) => [...u, user]);
    });
    socket.on('room:user_left', ({ userId, log }) => {
      setLogs((s) => [...s, log]);
      setUsers((u) => u.filter(x => x.id !== userId));
    });

    socket.on('chat:message', (msg) => setLogs((s) => [...s, { id: msg.id, type: 'chat', text: `${msg.username}: ${msg.text}`, time: new Date().toISOString() }]));
    socket.on('chat:log', (log) => setLogs((s) => [...s, log]));

    socket.on('video:uploaded', ({ video, log }) => {
      setVideo(video);
      if (log) setLogs((s) => [...s, log]);
    });

    socket.on('host:play', ({ time, log }) => {
      setPlaybackState({ playing: true, time });
      if (log) setLogs((s) => [...s, log]);
    });

    socket.on('host:pause', ({ time, log }) => {
      setPlaybackState({ playing: false, time });
      if (log) setLogs((s) => [...s, log]);
    });

    socket.on('host:seek', ({ time, log }) => {
      setPlaybackState((p) => ({ ...p, time }));
      if (log) setLogs((s) => [...s, log]);
    });

    socket.on('host:changed', ({ hostId, log }) => {
      setHostId(hostId);
      if (log) setLogs((s) => [...s, log]);
    });

    return () => {
      socket.disconnect();
    };
  }, [roomId]);

  // helper to copy link
  function copyLink() {
    navigator.clipboard.writeText(`${window.location.origin}/room/${roomId}`);
    alert('Link copied to clipboard');
  }

  // upload handler using client HTTP upload
  async function handleUpload(file) {
    const fd = new FormData();
    fd.append('video', file);
    fd.append('roomId', roomId);
    const res = await axios.post(`${SERVER}/upload`, fd, { headers: { 'Content-Type': 'multipart/form-data' }});
    if (res.data?.video) {
      // server will broadcast, but set local too
      setVideo(res.data.video);
    }
  }

  return (
    <div className="min-h-screen p-4">
      <div className="max-w-6xl mx-auto">
        <div className="flex justify-between items-center mb-4">
          <div>
            <h2 className="text-xl font-semibold">Room: {roomId}</h2>
            <p className="text-sm text-slate-600">Share link: <button className="text-indigo-600 underline" onClick={copyLink}>Copy Link</button></p>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={copyLink} className="px-3 py-1 bg-indigo-600 text-white rounded">Copy Link</button>
            <div className="text-sm text-slate-500">You are: <span className="font-medium">{user?.name}</span></div>
          </div>
        </div>

        <div className="grid grid-cols-12 gap-4">
          {/* Video + chat */}
          <div className="col-span-8 space-y-4">
            <VideoPlayer
              video={video}
              playbackState={playbackState}
              onHostAction={async (action, time) => {
                // only send host actions if user is host
                if (!user) return alert('not identified');
                socket.emit('host:action', { roomId, userId: user.id, action, time }, (res) => {
                  if (!res?.ok) console.warn(res?.error);
                });
              }}
              isHost={hostId === user?.id}
              onTakeHost={() => socket.emit('host:take', { roomId, userId: user.id })}
            />

            <UploadArea onUpload={handleUpload} />
            <Chat socket={socket} roomId={roomId} user={user} />
          </div>

          {/* right column */}
          <div className="col-span-4 space-y-4">
            <UserList users={users} hostId={hostId} currentUserId={user?.id} onTakeHost={() => socket.emit('host:take', { roomId, userId: user.id })} />
            <div className="bg-white p-3 rounded shadow">
              <h3 className="font-medium mb-2">Activity Log</h3>
              <div className="h-64 overflow-auto text-sm">
                {logs.length === 0 && <div className="text-slate-400">No activity yet</div>}
                {logs.map(l => (
                  <div key={l.id || Math.random()} className="mb-2">
                    <div className="text-xs text-slate-500">{new Date(l.time).toLocaleTimeString()}</div>
                    <div>{l.text}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white p-3 rounded shadow text-sm">
              <h3 className="font-medium">Room Controls</h3>
              <p className="mt-2">Host: {hostId === user?.id ? 'You' : 'Another user'}</p>
              <p className="mt-2">Video: {video?.filename || 'No video uploaded'}</p>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
