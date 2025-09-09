import React, { useRef } from 'react';

/**
 * UploadArea: simple drag/drop + file input
 * onUpload(file) is called with a File object
 */
export default function UploadArea({ onUpload }) {
  const inputRef = useRef();

  function onFileSelected(e) {
    const f = e.target.files?.[0];
    if (f) onUpload(f);
  }

  function onDrop(e) {
    e.preventDefault();
    const f = e.dataTransfer.files?.[0];
    if (f) onUpload(f);
  }

  return (
    <div onDrop={onDrop} onDragOver={(e)=>e.preventDefault()} className="bg-white p-3 rounded shadow">
      <div className="flex items-center justify-between">
        <div>
          <h4 className="font-medium">Upload Video</h4>
          <p className="text-sm text-slate-500">Click or drag & drop a video file to upload to the room (visible to everyone).</p>
        </div>
        <div className="flex gap-2">
          <button className="px-3 py-1 bg-slate-100 rounded" onClick={()=> inputRef.current.click()}>Upload Video</button>
          <input type="file" accept="video/*" ref={inputRef} onChange={onFileSelected} className="hidden" />
        </div>
      </div>
    </div>
  );
}
