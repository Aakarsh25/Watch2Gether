import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { v4 as uuidv4 } from 'uuid';

export default function Home() {
  const nav = useNavigate();
  const [roomName, setRoomName] = useState('');

  function createRoom() {
    const id = uuidv4().split('-')[0];
    nav(`/room/${id}`);
  }

  function joinRoom() {
    if (!roomName.trim()) return alert('Enter a room id or create one.');
    nav(`/room/${roomName.trim()}`);
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-2xl bg-white p-8 rounded-2xl shadow-lg">
        <h1 className="text-2xl font-semibold mb-4">Watch2Gether — Demo</h1>
        <p className="mb-6 text-sm text-slate-600">Create a room and share the link with friends. Upload video(s) and watch together.</p>

        <div className="flex gap-2">
          <button onClick={createRoom} className="px-4 py-2 bg-indigo-600 text-white rounded">Create Room</button>
          <input value={roomName} onChange={e=>setRoomName(e.target.value)} placeholder="Room ID" className="flex-1 px-3 py-2 border rounded" />
          <button onClick={joinRoom} className="px-4 py-2 bg-green-600 text-white rounded">Join</button>
        </div>
      </div>
    </div>
  );
}
