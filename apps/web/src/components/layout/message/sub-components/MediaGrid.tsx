import React from "react";

interface Props {
  mediaFiles: any[];
  onPreview: (index: number) => void;
  onLoad: () => void;
}

const imageSizeCache: Record<string, number> = {};

const SingleMediaItem: React.FC<{ file: any; onPreview: () => void; onLoad: () => void }> = ({ file, onPreview, onLoad }) => {
  const cachedRatio = imageSizeCache[file.fileKey] || null;
  const [aspectRatio, setAspectRatio] = React.useState<number | null>(cachedRatio);

  React.useEffect(() => {
    if (imageSizeCache[file.fileKey]) {
      setAspectRatio(imageSizeCache[file.fileKey]);
    } else {
      setAspectRatio(null);
    }
  }, [file.fileKey]);

  const MAX_WIDTH = 300;
  const MAX_HEIGHT = 300;

  let displayWidth = 200;
  let displayHeight = 200;

  if (aspectRatio) {
    if (aspectRatio > 1) {
      displayWidth = MAX_WIDTH;
      displayHeight = MAX_WIDTH / aspectRatio;
      if (displayHeight > MAX_HEIGHT) {
        displayHeight = MAX_HEIGHT;
        displayWidth = MAX_HEIGHT * aspectRatio;
      }
    } else {
      displayHeight = MAX_HEIGHT;
      displayWidth = MAX_HEIGHT * aspectRatio;
      if (displayWidth > MAX_WIDTH) {
        displayWidth = MAX_WIDTH;
        displayHeight = MAX_WIDTH / aspectRatio;
      }
    }
  }

  return (
    <div
      className="relative overflow-hidden rounded-xl border bg-black group cursor-pointer flex items-center justify-center"
      style={{ width: displayWidth, height: displayHeight }}
      onClick={(e) => {
        e.stopPropagation();
        onPreview();
      }}
    >
      {file.type === "IMAGE" && (
        <img
          src={file.fileKey}
          style={{ width: "100%", height: "100%" }}
          className="object-contain group-hover:scale-105 transition duration-200"
          onLoad={(e) => {
            const { naturalWidth, naturalHeight } = e.currentTarget;
            if (naturalWidth && naturalHeight) {
              const ratio = naturalWidth / naturalHeight;
              imageSizeCache[file.fileKey] = ratio;
              setAspectRatio(ratio);
            }
            onLoad();
          }}
          alt="attachment"
        />
      )}
      {file.type === "VIDEO" && (
        <div className="relative w-full h-full flex items-center justify-center">
          <video
            src={file.fileKey}
            style={{ width: "100%", height: "100%" }}
            className="object-contain"
            controls={false}
            onLoadedMetadata={(e) => {
              const { videoWidth, videoHeight } = e.currentTarget;
              if (videoWidth && videoHeight) {
                const ratio = videoWidth / videoHeight;
                imageSizeCache[file.fileKey] = ratio;
                setAspectRatio(ratio);
              }
              onLoad();
            }}
          />
          <div className="absolute w-9 h-9 rounded-full bg-black/50 flex items-center justify-center pointer-events-none">
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="white"
              className="ml-0.5"
            >
              <path d="M8 5v14l11-7z" />
            </svg>
          </div>
        </div>
      )}
    </div>
  );
};

const MediaGrid: React.FC<Props> = ({ mediaFiles, onPreview, onLoad }) => {
  if (mediaFiles.length === 0) return null;

  if (mediaFiles.length === 1) {
    return (
      <SingleMediaItem
        file={mediaFiles[0]}
        onPreview={() => onPreview(0)}
        onLoad={onLoad}
      />
    );
  }

  return (
    <div
      className={`grid gap-1 ${mediaFiles.length === 2 ? "grid-cols-2" : "grid-cols-3"
        }`}
    >
      {mediaFiles.map((file: any, index: number) => (
        <div
          key={index}
          className="relative overflow-hidden rounded-xl border bg-black group cursor-pointer"
          onClick={(e) => {
            e.stopPropagation();
            onPreview(index);
          }}
        >
          {file.type === "IMAGE" && (
            <img
              src={file.fileKey}
              className="w-full h-32 object-cover group-hover:scale-105 transition"
              onLoad={onLoad}
              alt="attachment"
            />
          )}
          {file.type === "VIDEO" && (
            <video
              src={file.fileKey}
              className="w-full h-32 object-cover"
              onLoadedMetadata={onLoad}
            />
          )}
        </div>
      ))}
    </div>
  );
};

export default React.memo(MediaGrid);
