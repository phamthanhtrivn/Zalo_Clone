import {
  Smile,
  Paperclip,
  Image as ImageIcon,
  Mic,
  Square,
  SendHorizontal,
  BarChart3,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useEffect, useRef, useState } from "react";
import EmojiPicker, { type EmojiClickData } from "emoji-picker-react";
import { RiShareForward2Fill } from "react-icons/ri";

import CreatePollModal from "./CreatePollModal";
import { MentionSuggestions } from "./MentionSuggestions";

import { conversationService } from "@/services/conversation.service";

import { useAppDispatch, useAppSelector } from "@/store";
import { clearReplyingMessage } from "@/store/slices/conversationSlice";
import { X, Quote } from "lucide-react";

type Props = {
  conversationId: string;
  chatName: string;
  onSendMessage: (text: string) => void;
  onSendFiles: (files: FileList) => void;
  onSendVoice: (voice: {
    blob: Blob;
    fileName: string;
    mimeType: string;
    durationMs: number;
  }) => Promise<void> | void;
  isSelected: boolean;
  setIsSelected: (isSelected: boolean) => void;
  selectedMessages: string[];
  setSelectedMessages: (messageIds: string[]) => void;
  onOpenForwardModal: () => void;
};

const ChatInput = ({
  conversationId,
  chatName,
  onSendMessage,
  onSendFiles,
  onSendVoice,
  isSelected,
  setIsSelected,
  selectedMessages,
  setSelectedMessages,
  onOpenForwardModal,
}: Props) => {
  const dispatch = useAppDispatch();
  const replyingMessage = useAppSelector(
    (state) => state.conversation.replyingMessage,
  );

  const [text, setText] = useState("");
  const [showEmoji, setShowEmoji] = useState(false);
  const [showVoiceModal, setShowVoiceModal] = useState(false);
  const [isRecordingVoice, setIsRecordingVoice] = useState(false);
  const [isSendingVoice, setIsSendingVoice] = useState(false);
  const [recordingDurationMs, setRecordingDurationMs] = useState(0);
  const [recordedVoice, setRecordedVoice] = useState<{
    blob: Blob;
    url: string;
    fileName: string;
    mimeType: string;
    durationMs: number;
  } | null>(null);
  const [showPollModal, setShowPollModal] = useState(false);
  const [myRole, setMyRole] = useState<string>("MEMBER");

  const [members, setMembers] = useState<any[]>([]);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const emojiRef = useRef<HTMLDivElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordingStreamRef = useRef<MediaStream | null>(null);
  const recordingStartedAtRef = useRef<number>(0);
  const recordingTimerRef = useRef<number | null>(null);

  const formatVoiceDuration = (durationMs: number) => {
    const totalSeconds = Math.max(0, Math.floor(durationMs / 1000));
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes.toString().padStart(2, "0")}:${seconds
      .toString()
      .padStart(2, "0")}`;
  };

  // Lấy thông tin hội thoại và user từ Redux
  const currentConversation = useAppSelector((state) =>
    state.conversation.conversations.find(
      (c) => c.conversationId === conversationId,
    ),
  );
  const currentUser = useAppSelector((state) => state.auth.user);

  // Logic kiểm tra khóa chat
  const isGroup = currentConversation?.type === "GROUP";
  const allowSend =
    (currentConversation as any)?.group?.allowMembersSendMessages !== false;

  // Tự động lấy quyền (Role) của mình khi mở nhóm và load thành viên nhóm
  useEffect(() => {
    if (isGroup && conversationId && currentUser?.userId) {
      conversationService
        .getListMembers(conversationId)
        .then((res) => {
          if (res?.success) {
            setMembers(res.data || []);
            const me = res.data.find(
              (m: any) => String(m.userId?._id || m.userId) === String(currentUser.userId),
            );
            if (me) setMyRole(me.role);
          }
        })
        .catch(console.error);
    } else {
      setMembers([]);
    }
  }, [isGroup, conversationId, currentUser?.userId]);



  const isManager = myRole === "OWNER" || myRole === "ADMIN";
  const isMutedByAdmin = isGroup && !allowSend && !isManager;

  // --- CÁC HÀM XỬ LÝ SỰ KIỆN ---
  const handleSelectEmoji = (emojiData: EmojiClickData) => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart ?? 0;
    const end = textarea.selectionEnd ?? 0;

    setText((prev) => {
      const newText =
        prev.substring(0, start) + emojiData.emoji + prev.substring(end);
      requestAnimationFrame(() => {
        textarea.focus();
        const pos = start + emojiData.emoji.length;
        textarea.setSelectionRange(pos, pos);
      });
      return newText;
    });
  };

  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setText(val);
    const el = textareaRef.current;
    if (el) {
      el.style.height = "auto";
      const maxHeight = 10 * 24;
      const newHeight = Math.min(el.scrollHeight, maxHeight);
      el.style.height = newHeight + "px";
      setTimeout(() => {
        const overlay = document.getElementById("textarea-highlight-overlay");
        if (overlay) {
          overlay.scrollTop = el.scrollTop;
        }
      }, 0);
    }
  };

  const handleSend = () => {
    if (text.trim()) {
      onSendMessage(text);
      setText("");
      if (replyingMessage) {
        dispatch(clearReplyingMessage());
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.length) {
      onSendFiles(e.target.files);
      e.target.value = "";
    }
  };

  const cleanupRecording = () => {
    if (recordingTimerRef.current) {
      window.clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }

    recordingStreamRef.current?.getTracks().forEach((track) => track.stop());
    recordingStreamRef.current = null;
    mediaRecorderRef.current = null;
    recordingStartedAtRef.current = 0;
    setIsRecordingVoice(false);
  };

  const discardRecordedVoice = () => {
    if (recordedVoice?.url) {
      URL.revokeObjectURL(recordedVoice.url);
    }
    setRecordedVoice(null);
    setRecordingDurationMs(0);
  };

  const openVoiceModal = () => {
    setShowEmoji(false);
    setShowVoiceModal(true);
    discardRecordedVoice();
  };

  const startRecordingVoice = async () => {
    if (isRecordingVoice) return;

    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        alert("Trình duyệt không hỗ trợ ghi âm.");
        return;
      }

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      recordingStreamRef.current = stream;

      const supportedMimeType = [
        "audio/webm;codecs=opus",
        "audio/webm",
        "audio/mp4",
      ].find((mimeType) => MediaRecorder.isTypeSupported(mimeType));

      const recorder = supportedMimeType
        ? new MediaRecorder(stream, { mimeType: supportedMimeType })
        : new MediaRecorder(stream);

      const chunks: BlobPart[] = [];
      recordingStartedAtRef.current = Date.now();
      setRecordingDurationMs(0);

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunks.push(event.data);
        }
      };

      recorder.onstop = () => {
        const durationMs = Math.max(
          1000,
          Date.now() - recordingStartedAtRef.current,
        );
        const blob = new Blob(chunks, {
          type: recorder.mimeType || supportedMimeType || "audio/webm",
        });
        const url = URL.createObjectURL(blob);

        setRecordedVoice({
          blob,
          url,
          fileName: `voice_${Date.now()}.webm`,
          mimeType: blob.type || "audio/webm",
          durationMs,
        });
        cleanupRecording();
      };

      recorder.start();
      mediaRecorderRef.current = recorder;
      setIsRecordingVoice(true);

      recordingTimerRef.current = window.setInterval(() => {
        setRecordingDurationMs(Date.now() - recordingStartedAtRef.current);
      }, 250);
    } catch (error) {
      console.error("Start voice recording error:", error);
      cleanupRecording();
      alert("Không thể bắt đầu ghi âm.");
    }
  };

  const stopRecordingVoice = async () => {
    const recorder = mediaRecorderRef.current;
    if (!recorder || recorder.state === "inactive") return;

    try {
      recorder.stop();
    } catch (error) {
      console.error("Stop voice recording error:", error);
      cleanupRecording();
    }
  };

  const sendRecordedVoice = async () => {
    if (!recordedVoice || isSendingVoice) return;

    try {
      setIsSendingVoice(true);
      await onSendVoice(recordedVoice);
      discardRecordedVoice();
      setRecordingDurationMs(0);
      setShowVoiceModal(false);
    } catch (error) {
      console.error("Send voice error:", error);
      alert("Không thể gửi bản ghi âm.");
    } finally {
      setIsSendingVoice(false);
    }
  };

  useEffect(() => {
    const handleClickOutside = (e: any) => {
      if (!emojiRef.current?.contains(e.target)) {
        setShowEmoji(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const getRenderedText = () => {
    const validMentionNames = [
      "Zola AI",
      ...members.map((m: any) => {
        if (!m) return "";
        if (m.userId && typeof m.userId === "object") {
          return m.userId.profile?.name || m.userId.name || "";
        }
        return m.name || "";
      }).filter(Boolean)
    ];

    const escapedNames = validMentionNames
      .map(name => name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
      .filter(Boolean)
      .sort((a, b) => b.length - a.length);

    if (escapedNames.length === 0) {
      return text.split(/(\s+)/).map((part, index) => {
        if (part.startsWith("@") && part.length > 1) {
          return <span key={index} className="text-[#0068ff]">{part}</span>;
        }
        return <span key={index}>{part}</span>;
      });
    }

    const pattern = new RegExp(`(@(?:${escapedNames.join("|")}))`, "g");
    const parts = text.split(pattern);

    return parts.map((part, index) => {
      if (part.startsWith("@")) {
        const namePart = part.substring(1);
        if (validMentionNames.includes(namePart)) {
          return <span key={index} className="text-[#0068ff]">{part}</span>;
        }
      }
      return <span key={index}>{part}</span>;
    });
  };

  // --- RENDER GIAO DIỆN ---
  if (isMutedByAdmin) {
    return (
      <div className="w-full p-4 bg-gray-50 border-t flex items-center justify-center h-16">
        <p className="text-[14px] font-medium text-gray-500">
          Chỉ Trưởng/Phó nhóm mới được gửi tin nhắn.
        </p>
      </div>
    );
  }
  return (
    <div className="bg-white border-t relative">
      <MentionSuggestions
        text={text}
        setText={setText}
        textareaRef={textareaRef}
        members={members}
        isGroup={isGroup}
        currentUserId={currentUser?.userId}
      />
      {isSelected && (
        <div className="px-3 py-2 border-b flex justify-between items-center bg-white">
          <div className="text-sm">
            <span className="px-2 py-1 bg-[#E5F1FF] rounded font-medium text-[#104EAD] mr-1">
              {selectedMessages.length}
            </span>{" "}
            Đã chọn
          </div>

          <div className="flex gap-2">
            <button
              onClick={onOpenForwardModal}
              className="bg-blue-500 text-white px-4 py-2 rounded-full cursor-pointer hover:bg-blue-600 transition flex justify-between items-center gap-1 text-sm"
            >
              <RiShareForward2Fill />
              Chuyển tiếp
            </button>

            <button
              onClick={() => {
                setIsSelected(false);
                setSelectedMessages([]);
              }}
              className="text-gray-500 cursor-pointer px-4 py-1 rounded-full border border-gray-300 hover:bg-gray-100 transition text-sm "
            >
              Hủy
            </button>
          </div>
        </div>
      )}

      {replyingMessage && (
        <div className="px-4 py-2 border-b flex items-stretch gap-3 bg-gray-50/80 animate-in slide-in-from-bottom-2 duration-200">
          <div className="w-1 bg-[#0068ff] rounded-full" />
          <div className="flex-1 min-w-0 py-1">
            <div className="text-[13px] font-semibold text-[#0068ff] mb-0.5 flex items-center gap-1.5">
              <Quote size={12} className="fill-current" />
              Trả lời {replyingMessage.senderId.profile?.name}
            </div>
            <p className="text-sm text-gray-500 truncate">
              {replyingMessage.content?.text ||
                (replyingMessage.content?.files
                  ? replyingMessage.content.files[0].fileName
                  : "")}
            </p>
          </div>
          <button
            onClick={() => dispatch(clearReplyingMessage())}
            className="p-1 hover:bg-gray-200 rounded-full h-fit self-center transition-colors cursor-pointer"
          >
            <X size={18} className="text-gray-400" />
          </button>
        </div>
      )}

      <div className="flex items-center gap-1 px-2 border-b py-1 ">
        <Button
          variant="ghost"
          size="icon"
          className="w-10 h-10 text-gray-500 cursor-pointer"
          onClick={() => setShowEmoji(!showEmoji)}
        >
          <Smile className="w-10 h-10" />
        </Button>

        {showEmoji && (
          <div ref={emojiRef} className="absolute bottom-16 left-2 z-50">
            <EmojiPicker
              onEmojiClick={handleSelectEmoji}
              previewConfig={{ showPreview: false }}
              width={300}
              height={400}
            />
          </div>
        )}

        <input
          type="file"
          ref={fileInputRef}
          onChange={onFileChange}
          multiple
          className="hidden"
        />
        <Button
          onClick={() => fileInputRef.current?.click()}
          variant="ghost"
          className="w-10 h-10 text-gray-500 cursor-pointer"
          title="Đính kèm file"
        >
          <Paperclip className="w-10 h-10" />
        </Button>

        <input
          type="file"
          ref={imageInputRef}
          onChange={onFileChange}
          multiple
          accept="image/*"
          className="hidden"
        />
        <Button
          onClick={() => imageInputRef.current?.click()}
          variant="ghost"
          className="w-10 h-10 text-gray-500 cursor-pointer"
          title="Gửi hình ảnh"
        >
          <ImageIcon className="w-10 h-10" />
        </Button>

        <Button
          onClick={openVoiceModal}
          variant="ghost"
          className="w-10 h-10 text-gray-500 cursor-pointer"
          title="Ghi âm"
        >
          <Mic className="w-10 h-10" />
        </Button>
        {isGroup && (
          <Button
            onClick={() => setShowPollModal(true)}
            variant="ghost"
            className="w-10 h-10 text-gray-500 cursor-pointer"
            title="Tạo bình chọn"
          >
            <BarChart3 className="w-10 h-10" />
          </Button>
        )}
        <div className="flex-1"></div>
      </div>
      <div className="flex items-center gap-2 p-2 relative">
        <div className="flex-1 relative min-w-0">
          {/* Highlight overlay */}
          <div
            id="textarea-highlight-overlay"
            className="absolute inset-0 p-2 text-sm leading-6 pointer-events-none whitespace-pre-wrap break-words text-gray-800 select-none overflow-y-auto max-h-60 font-sans border border-transparent bg-transparent"
            style={{
              fontFamily: "inherit",
              fontSize: "inherit",
              lineHeight: "inherit",
              boxSizing: "border-box",
            }}
          >
            {getRenderedText()}
          </div>

          <textarea
            ref={textareaRef}
            value={text}
            onChange={handleInput}
            onKeyDown={handleKeyDown}
            onScroll={(e) => {
              const overlay = document.getElementById("textarea-highlight-overlay");
              if (overlay) {
                overlay.scrollTop = e.currentTarget.scrollTop;
              }
            }}
            placeholder={`Nhắn tin tới ${chatName}`}
            rows={1}
            className="
              w-full
              resize-none 
              border-none 
              bg-transparent 
              text-sm 
              outline-none 
              overflow-y-auto
              p-2
              leading-6
              max-h-60
              text-black
              relative
              z-10
              caret-black
              font-sans
            "
            style={{
              color: text ? "transparent" : "inherit",
              fontFamily: "inherit",
              fontSize: "inherit",
              lineHeight: "inherit",
              boxSizing: "border-box",
            }}
          />
        </div>
        <Button
          onClick={handleSend}
          variant="ghost"
          size="icon"
          className="w-10 h-10 text-[#0068ff] hover:text-[#005AE0] cursor-pointer"
        >
          <span className="font-bold text-sm ">
            {text.trim().length > 0 ? <SendHorizontal /> : "GỬI"}
          </span>
        </Button>
      </div>

      {showVoiceModal && (
        <div className="fixed inset-0 z-120 bg-black/40 flex items-end sm:items-center justify-center p-3">
          <div className="w-full max-w-md rounded-3xl bg-white shadow-2xl border border-black/5 overflow-hidden">
            <div className="px-5 py-4 border-b bg-linear-to-r from-[#f7fbff] to-white">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-gray-900">
                    Ghi âm tin nhắn thoại
                  </div>
                </div>
                <button
                  onClick={() => {
                    if (!isRecordingVoice) {
                      cleanupRecording();
                      discardRecordedVoice();
                      setShowVoiceModal(false);
                    }
                  }}
                  className="h-8 w-8 rounded-full bg-gray-100 text-gray-500 flex items-center justify-center cursor-pointer hover:bg-gray-200 transition-colors"
                >
                  <X size={16} />
                </button>
              </div>
            </div>

            <div className="px-5 py-6">
              {recordedVoice ? (
                <div className="space-y-4">
                  <div className="rounded-2xl bg-gray-50 border border-gray-200 p-4">
                    <audio
                      controls
                      src={recordedVoice.url}
                      className="w-full"
                    />
                    <div className="mt-3 text-xs text-gray-500 flex items-center justify-between">
                      <span>
                        {formatVoiceDuration(recordedVoice.durationMs)}
                      </span>
                      <span className="truncate ml-3">
                        Bản ghi sẵn sàng gửi
                      </span>
                    </div>
                  </div>

                  <div className="flex gap-3">
                    <Button
                      onClick={() => {
                        discardRecordedVoice();
                        setRecordingDurationMs(0);
                        void startRecordingVoice();
                      }}
                      disabled={isSendingVoice}
                      variant="outline"
                      className="flex-1 rounded-2xl cursor-pointer"
                    >
                      Ghi lại
                    </Button>
                    <Button
                      onClick={sendRecordedVoice}
                      disabled={isSendingVoice}
                      className="flex-1 rounded-2xl bg-[#0068ff] hover:bg-[#005ae0] cursor-pointer"
                    >
                      {isSendingVoice ? "Đang gửi..." : "Gửi"}
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center gap-5 py-4">
                  <button
                    onClick={() => {
                      if (isRecordingVoice) {
                        void stopRecordingVoice();
                      } else {
                        void startRecordingVoice();
                      }
                    }}
                    className={`h-24 w-24 rounded-full flex items-center justify-center shadow-xl transition-all cursor-pointer ${isRecordingVoice ? "bg-red-500 text-white scale-95" : "bg-[#0068ff] text-white hover:scale-105"}`}
                  >
                    {isRecordingVoice ? (
                      <Square size={28} />
                    ) : (
                      <Mic size={30} />
                    )}
                  </button>

                  <div className="text-center">
                    <div className="text-sm font-medium text-gray-900">
                      {isRecordingVoice
                        ? "Đang ghi âm"
                        : "Bấm để bắt đầu ghi âm"}
                    </div>
                    <div className="mt-1 text-xs text-gray-500">
                      {formatVoiceDuration(recordingDurationMs)}
                    </div>
                  </div>

                  <div className="w-full rounded-2xl bg-gray-50 border border-dashed border-gray-200 px-4 py-5 text-center text-sm text-gray-500">
                    Khi dừng, bạn có thể nghe lại trước khi gửi.
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
      <CreatePollModal
        conversationId={conversationId}
        isOpen={showPollModal}
        onClose={() => setShowPollModal(false)}
      />
    </div>
  );
};

export default ChatInput;
