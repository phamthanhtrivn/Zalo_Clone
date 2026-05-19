import React, { useState, useEffect, useRef } from "react";
import AppAvatar from "@/components/common/AppAvatar";

interface MentionSuggestionsProps {
  text: string;
  setText: React.Dispatch<React.SetStateAction<string>>;
  textareaRef: React.RefObject<HTMLTextAreaElement | null>;
  members: any[];
  isGroup: boolean;
  currentUserId?: string;
}

export const MentionSuggestions = ({
  text,
  setText,
  textareaRef,
  members,
  isGroup,
  currentUserId,
}: MentionSuggestionsProps) => {
  const [showMentionList, setShowMentionList] = useState(false);
  const [mentionQuery, setMentionQuery] = useState("");
  const mentionRef = useRef<HTMLDivElement>(null);

  // Analyze text and selection position to trigger suggestions
  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const checkMention = () => {
      const start = textarea.selectionStart ?? 0;
      const textBefore = textarea.value.substring(0, start);
      const lastAtIndex = textBefore.lastIndexOf("@");

      if (lastAtIndex !== -1) {
        const textAfterAt = textBefore.slice(lastAtIndex + 1);
        // Only trigger if no whitespace or newline is typed after @
        if (!textAfterAt.includes(" ") && !textAfterAt.includes("\n")) {
          setMentionQuery(textAfterAt);
          setShowMentionList(true);
          return;
        }
      }
      setShowMentionList(false);
      setMentionQuery("");
    };

    textarea.addEventListener("input", checkMention);
    textarea.addEventListener("keyup", checkMention);
    textarea.addEventListener("click", checkMention);

    return () => {
      textarea.removeEventListener("input", checkMention);
      textarea.removeEventListener("keyup", checkMention);
      textarea.removeEventListener("click", checkMention);
    };
  }, [text, textareaRef]);

  // Handle click outside to close popover
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (mentionRef.current && !mentionRef.current.contains(e.target as Node)) {
        setShowMentionList(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  if (!showMentionList) return null;

  // Build candidates list
  const memberCandidates = isGroup
    ? (members || [])
      .map((m: any) => {
        if (!m) return null;
        if (m.userId && typeof m.userId === "object") {
          const u = m.userId;
          if (currentUserId && String(u._id || m.userId) === String(currentUserId)) return null;
          return {
            _id: u._id || m.userId,
            name: u.profile?.name || u.name || "Người dùng",
            avatarUrl: u.profile?.avatarUrl || u.avatarUrl || "",
            isAi: false,
          };
        }
        const userIdStr = typeof m.userId === "string" ? m.userId : (m._id || "");
        if (currentUserId && String(userIdStr) === String(currentUserId)) return null;
        return {
          _id: userIdStr,
          name: m.name || "Người dùng",
          avatarUrl: m.avatarUrl || "",
          isAi: false,
        };
      })
      .filter(Boolean) as Array<{ _id: string; name: string; avatarUrl: string; isAi: boolean }>
    : [];

  const allCandidates = [
    { _id: "zola_ai", name: "Zola AI", avatarUrl: "", isAi: true },
    ...memberCandidates,
  ];

  const filteredCandidates = allCandidates.filter((c) =>
    c.name.toLowerCase().includes(mentionQuery.toLowerCase())
  );

  if (filteredCandidates.length === 0) return null;

  const handleSelectMention = (name: string) => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart ?? 0;
    const textBefore = text.substring(0, start);
    const textAfter = text.substring(start);
    const lastAtIndex = textBefore.lastIndexOf("@");

    if (lastAtIndex !== -1) {
      const newText =
        textBefore.substring(0, lastAtIndex) +
        `@${name} ` +
        textAfter;

      setText(newText);

      requestAnimationFrame(() => {
        textarea.focus();
        const newPos = lastAtIndex + name.length + 2; // @ + name + space
        textarea.setSelectionRange(newPos, newPos);

        // Trigger auto-resize height of textarea
        textarea.style.height = "auto";
        const maxHeight = 10 * 24;
        const newHeight = Math.min(textarea.scrollHeight, maxHeight);
        textarea.style.height = newHeight + "px";
      });
    }
    setShowMentionList(false);
    setMentionQuery("");
  };

  return (
    <div
      ref={mentionRef}
      className="absolute bottom-[58px] left-4 bg-white border border-gray-200 rounded-lg shadow-xl z-50 max-h-48 overflow-y-auto w-64 animate-in slide-in-from-bottom-2 duration-150"
    >
      {filteredCandidates.map((c) => (
        <div
          key={c._id}
          onClick={() => handleSelectMention(c.name)}
          className="flex items-center gap-3 px-4 py-2 hover:bg-gray-50 cursor-pointer border-b border-gray-100 last:border-b-0 transition-colors"
        >
          <AppAvatar
            src={c.avatarUrl}
            name={c.name}
            isAI={c.isAi}
            className="w-8 h-8 text-[10px]"
          />
          <span className="text-sm font-medium text-gray-900 truncate">{c.name}</span>
        </div>
      ))}
    </div>
  );
};
