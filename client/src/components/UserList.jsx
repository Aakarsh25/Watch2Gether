import React from 'react';

/**
 * Displays users and highlight host.
 */
export default function UserList({ users, hostId, currentUserId, onTakeHost }) {
  return (
    <div className="bg-white p-3 rounded shadow">
      <div className="flex justify-between items-center mb-2">
        <h4 className="font-medium">Participants</h4>
        <button onClick={onTakeHost} className="text-sm px-2 py-1 bg-slate-100 rounded">Take Host</button>
      </div>

      <ul>
        {users.map(u => (
          <li key={u.id} className={`flex items-center justify-between py-1 ${u.id === currentUserId ? 'bg-slate-50' : ''} rounded px-2`}>
            <div>
              <span className="font-medium">{u.name}</span>
              {u.id === hostId && <span className="ml-2 text-xs text-green-600">Host</span>}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
