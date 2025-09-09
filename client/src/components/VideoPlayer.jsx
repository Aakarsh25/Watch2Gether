import React, { useEffect, useRef, useState } from 'react';

/**
 * VideoPlayer
 * - plays provided video.url
 * - responds to playbackState prop to sync when server instructs seek/play/pause
 * - emits host controls via callbacks passed (onHostAction)
 *
 * Important: we handle small sync differences by nudging playbackTime if drift > 0.5s.
 */

export default function VideoPlayer({ video, playbackState, onHostAction, isHost, onTakeHost }) {
  const ref = useRef(null);
  const [localPlaying, setLocalPlaying] = useState(false);

  useEffect(() => {
    if (!ref.current || !video) return;
    // if server instructs a seek
    const v = ref.current;
    if (Math.abs(v.currentTime - (playbackState.time || 0)) > 0.5) {
      v.currentTime = playbackState.time || 0;
    }

    if (playbackState.playing) {
      v.play().catch(()=>{}); // play, but browsers may block autoplay if not user-initiated
    } else {
      v.pause();
    }
  }, [playbackState, video]);

  function handlePlayPause() {
    if (!ref.current) return;
    const v = ref.current;
    const time = v.currentTime;
    if (!isHost) {
      // guests cannot control host - show take host option
      return onTakeHost && onTakeHost();
    }

    if (v.paused) {
      onHostAction && onHostAction('play', time);
    } else {
      onHostAction && onHostAction('pause', time);
    }
  }

  function handleSeek(e) {
    if (!ref.current) return;
    const time = ref.current.currentTime;
    if (!isHost) {
      // guests cannot seek — ask to take host
      return onTakeHost && onTakeHost();
    }
    onHostAction && onHostAction('seek', time);
  }

  return (
    <div className="bg-white rounded shadow p-3">
      <div className="flex justify-between items-center mb-2">
        <div className="font-medium">Video Player</div>
        <div>
          {isHost ? <span className="text-sm px-2 py-1 bg-green-100 rounded">Host</span> : <button className="text-sm px-2 py-1 bg-slate-100 rounded" onClick={onTakeHost}>Take Host Control</button>}
        </div>
      </div>

      {video ? (
        <>
          <video
            ref={ref}
            src={video.url}
            controls
            onPlay={() => setLocalPlaying(true)}
            onPause={() => setLocalPlaying(false)}
            onSeeked={handleSeek}
            className="w-full rounded"
          />
          <div className="mt-2 flex gap-2">
            <button onClick={handlePlayPause} className="px-3 py-1 bg-indigo-600 text-white rounded">Play/Pause (Host)</button>
            <div className="text-sm text-slate-500">Filename: {video.filename}</div>
          </div>
        </>
      ) : (
        <div className="h-64 flex items-center justify-center text-slate-400 border rounded">No video uploaded. Upload to begin.</div>
      )}
    </div>
  );
}
