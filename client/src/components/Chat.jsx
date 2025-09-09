import React, { useEffect, useRef, useState } from 'react';

/**
 * Chat component: sends messages via socket.emit('chat:message')
 * supports /name command
 */
export default function Chat({ socket, roomId, user }) {
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const boxRef = useRef();

  useEffect(() => {
    if (!socket) return;
    socket.on('chat:message', (msg) => {
      setMessages((m) => [...m, { id: msg.id, text: `${msg.username}: ${msg.text}` }]);
      boxRef.current?.scrollTo({ top: boxRef.current.scrollHeight, behavior: 'smooth' });
    });
    socket.on('chat:log', (log) => {
      setMessages((m) => [...m, { id: log.id, text: `[${new Date(log.time).toLocaleTimeString()}] ${log.text}` }]);
      boxRef.current?.scrollTo({ top: boxRef.current.scrollHeight, behavior: 'smooth' });
    });

    return () => {
      socket.off('chat:message');
      socket.off('chat:log');
    };
  }, [socket]);

  function send() {
    if (!text.trim()) return;
    socket.emit('chat:message', { roomId, userId: user.id, text }, (res) => {
      if (res?.ok) {
        // clear if ok
        setText('');
      } else {
        alert('Message error: ' + (res?.error || 'unknown'));
      }
    });
  }

  return (
    <div className="bg-white p-3 rounded shadow">
      <div className="flex justify-between items-center mb-2">
        <h4 className="font-medium">Chat</h4>
        <div className="text-xs text-slate-500">Type <code>/name YourName</code> to change name</div>
      </div>

      <div ref={boxRef} className="h-48 overflow-auto border p-2 rounded mb-2">
        {messages.map(m => <div key={m.id} className="mb-1 text-sm">{m.text}</div>)}
      </div>

      <div className="flex gap-2">
        <input value={text} onChange={(e)=>setText(e.target.value)} onKeyDown={(e)=>{ if (e.key === 'Enter') send(); }} className="flex-1 px-3 py-2 border rounded" />
        <button onClick={send} className="px-3 py-2 bg-indigo-600 text-white rounded">Send</button>
      </div>
    </div>
  );
}
