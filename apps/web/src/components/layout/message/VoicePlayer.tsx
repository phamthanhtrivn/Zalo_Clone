import { Play, Pause, Download } from "lucide-react";
import { useState, useRef, useEffect } from "react";
import { formatDuration } from "@/utils/format-message-time..util";

interface VoicePlayerProps {
  fileUrl: string;
  fileName?: string;
  durationMs: number;
  onDownload: () => void;
  isMe?: boolean;
}

export const VoicePlayer = ({
  fileUrl,
  durationMs,
  onDownload,
}: VoicePlayerProps) => {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTimeMs, setCurrentTimeMs] = useState(0);
  const [totalTimeMs, setTotalTimeMs] = useState(durationMs * 1000);

  useEffect(() => {
    setTotalTimeMs(durationMs * 1000);
  }, [durationMs]);

  const handlePlayPause = async () => {
    if (!audioRef.current) return;

    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      try {
        await audioRef.current.play();
        setIsPlaying(true);
      } catch (error) {
        console.error("Playback error:", error);
      }
    }
  };

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      setCurrentTimeMs(audioRef.current.currentTime * 1000);
    }
  };

  const handleEnded = () => {
    setIsPlaying(false);
    setCurrentTimeMs(0);
  };

  const handleProgressChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newTime = parseFloat(e.target.value);
    if (audioRef.current) {
      audioRef.current.currentTime = newTime / 1000;
      setCurrentTimeMs(newTime);
    }
  };

  const progress =
    totalTimeMs > 0 ? (currentTimeMs / totalTimeMs) * 100 : 0;

  return (
    <div className="flex items-center gap-1.5 p-2 bg-linear-to-r from-blue-50/50 to-white rounded-xl border border-blue-100/80 hover:border-blue-200 transition-colors max-w-64">
      {/* Play/Pause Button */}
      <button
        onClick={handlePlayPause}
        className="cursor-pointer shrink-0 w-8 h-8 rounded-full bg-[#0068ff] hover:bg-[#005ae0] text-white flex items-center justify-center transition-all hover:scale-105 active:scale-95 shadow-sm"
        title={isPlaying ? "Pause" : "Play"}
      >
        {isPlaying ? (
          <Pause size={16} fill="currentColor" />
        ) : (
          <Play size={16} className="ml-0.5" fill="currentColor" />
        )}
      </button>

      {/* Progress Bar & Duration */}
      <div className="flex-1 flex flex-col gap-0.5">
        <input
          ref={(input) => {
            if (input) {
              input.style.setProperty("--progress", `${progress}%`, "important");
            }
          }}
          type="range"
          min="0"
          max={totalTimeMs}
          value={currentTimeMs}
          onChange={handleProgressChange}
          className="w-full h-1 bg-blue-100 rounded-full appearance-none cursor-pointer hover:h-1.5 transition-all"
          style={{
            background: `linear-gradient(to right, #0068ff 0%, #0068ff ${progress}%, #dbeafe ${progress}%, #dbeafe 100%)`,
          }}
          title={`${formatDuration(Math.floor(currentTimeMs / 1000))} / ${formatDuration(Math.floor(totalTimeMs / 1000))}`}
        />
        <div className="text-[10px] text-gray-500 text-right pr-0.5 font-medium leading-none mt-0.5">
          {formatDuration(Math.floor(currentTimeMs / 1000))} /{" "}
          {formatDuration(Math.floor(totalTimeMs / 1000))}
        </div>
      </div>

      {/* Download Button */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          onDownload();
        }}
        className="shrink-0 p-1.5 text-gray-400 hover:text-[#0068ff] hover:bg-blue-50 rounded-full transition-colors"
        title="Download"
      >
        <Download size={16} />
      </button>

      {/* Hidden Audio Element */}
      <audio
        ref={audioRef}
        src={fileUrl}
        onTimeUpdate={handleTimeUpdate}
        onEnded={handleEnded}
        onLoadedMetadata={() => {
          if (audioRef.current) {
            setTotalTimeMs(audioRef.current.duration * 1000);
          }
        }}
      />
    </div>
  );
};
