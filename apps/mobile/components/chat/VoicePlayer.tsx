import React, { useState, useRef, useEffect } from "react";
import { View, Text, TouchableOpacity, Alert } from "react-native";
import { Audio } from "expo-av";
import { Ionicons } from "@expo/vector-icons";
import { formatDuration } from "@/utils/format-message-time.util";

interface VoicePlayerProps {
  file: {
    fileKey: string;
    fileName: string;
    fileSize: number;
    type: "VOICE";
  };
  voiceDuration?: number | null; // in seconds
  isMe: boolean;
}

const VoicePlayer = React.memo(({ file, voiceDuration, isMe }: VoicePlayerProps) => {
  const [voiceSound, setVoiceSound] = useState<Audio.Sound | null>(null);
  const [isVoicePlaying, setIsVoicePlaying] = useState(false);
  const [voicePositionMs, setVoicePositionMs] = useState(0);
  const voiceDurationMsRef = useRef((voiceDuration || 0) * 1000);

  useEffect(() => {
    voiceDurationMsRef.current = (voiceDuration || 0) * 1000;
  }, [voiceDuration]);

  useEffect(() => {
    return () => {
      if (voiceSound) {
        void voiceSound.unloadAsync();
      }
    };
  }, [voiceSound]);

  const handleToggleVoicePlayback = async () => {
    try {
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: true,
        shouldDuckAndroid: true,
      });

      if (voiceSound) {
        const status = await voiceSound.getStatusAsync();
        if (status.isLoaded && status.isPlaying) {
          await voiceSound.pauseAsync();
          setIsVoicePlaying(false);
          return;
        }
        await voiceSound.playAsync();
        setIsVoicePlaying(true);
        return;
      }

      const { sound } = await Audio.Sound.createAsync(
        { uri: file.fileKey },
        { shouldPlay: true },
        (status) => {
          if (!status.isLoaded) return;
          setVoicePositionMs(status.positionMillis || 0);
          if (status.durationMillis) {
            voiceDurationMsRef.current = status.durationMillis;
          }
          setIsVoicePlaying(status.isPlaying);
          if (status.didJustFinish) {
            setVoicePositionMs(0);
            setIsVoicePlaying(false);
          }
        },
      );

      setVoiceSound(sound);
    } catch (error) {
      console.error("Voice playback error:", error);
      Alert.alert("Lỗi", "Không thể phát bản ghi âm.");
    }
  };

  const durationMs = voiceDurationMsRef.current;
  const progress = durationMs > 0 ? Math.min(1, Math.max(0, voicePositionMs / durationMs)) : 0;

  return (
    <View
      style={{
        marginTop: 6,
        padding: 6,
        borderRadius: 6,
        backgroundColor: isMe ? "#dff0ff" : "#f3f4f6",
        minWidth: 200,
      }}
    >
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 12,
        }}
      >
        <TouchableOpacity
          onPress={handleToggleVoicePlayback}
          style={{
            width: 30,
            height: 30,
            borderRadius: 20,
            backgroundColor: "#0068ff",
            justifyContent: "center",
            alignItems: "center",
          }}
        >
          <Ionicons
            name={isVoicePlaying ? "pause" : "play"}
            size={18}
            color="white"
          />
        </TouchableOpacity>

        <View style={{ flex: 1 }}>
          <View
            style={{
              height: 6,
              borderRadius: 999,
              backgroundColor: "rgba(0,104,255,0.18)",
              overflow: "hidden",
            }}
          >
            <View
              style={{
                width: `${progress * 100}%`,
                height: "100%",
                backgroundColor: "#0068ff",
              }}
            />
          </View>
          <Text
            style={{
              marginTop: 8,
              fontSize: 11,
              color: "#374151",
              fontWeight: "600",
            }}
          >
            {formatDuration(
              Math.floor((isVoicePlaying ? voicePositionMs : durationMs) / 1000),
            )}
          </Text>
        </View>
      </View>
    </View>
  );
});

VoicePlayer.displayName = "VoicePlayer";

export default VoicePlayer;
