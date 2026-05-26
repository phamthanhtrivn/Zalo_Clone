import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  ActivityIndicator,
  Dimensions,
  Animated,
} from "react-native";
import React, { useState, useEffect, useMemo, useRef } from "react";
import { Ionicons } from "@expo/vector-icons";
import * as SecureStore from "expo-secure-store";
import Toast from "react-native-toast-message";
import GroupAvatar from "../ui/GroupAvatar";
import { pollService } from "../../services/poll.service";
import { useAppSelector } from "../../store/store";

const { width: SCREEN_WIDTH } = Dimensions.get("window");


interface PollOption {
  _id: string;
  text: string;
  voteCount: number;
  voters?: {
    userId: string;
    name: string;
    avatar: string;
  }[];
}

interface PollData {
  _id: string;
  title: string;
  options: PollOption[];
  isMultipleChoice: boolean;
  allowAddOptions: boolean;
  isAnonymous: boolean;
  hideResultsUntilVoted: boolean;
  expiresAt: string | null;
  totalParticipants: number;
}

interface Props {
  pollId: string;
  conversationId: string;
  initialPoll?: PollData;
}

const calculatePercentages = (options: PollOption[], total: number) => {
  if (total === 0 || !options.length) return options.map(() => 0);

  const exactPercentages = options.map((opt) => (opt.voteCount / total) * 100);
  const floored = exactPercentages.map((p) => Math.floor(p));
  const sumFloored = floored.reduce((a, b) => a + b, 0);
  const remainders = exactPercentages.map((p, i) => ({
    remainder: p - floored[i],
    index: i,
  }));

  remainders.sort((a, b) => b.remainder - a.remainder);

  let diff = 100 - sumFloored;
  for (let i = 0; i < diff; i++) {
    floored[remainders[i].index]++;
  }

  return floored;
};

const AnimatedProgressBar = ({
  percent,
  isSelected,
  showResults,
}: {
  percent: number;
  isSelected: boolean;
  showResults: boolean;
}) => {
  const widthAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const targetValue = showResults ? percent : 0;
    Animated.timing(widthAnim, {
      toValue: targetValue,
      duration: 600,
      useNativeDriver: false,
    }).start();
  }, [percent, showResults]);

  return (
    <Animated.View
      style={[
        styles.progressBarFill,
        isSelected && styles.progressBarFillSelected,
        {
          width: widthAnim.interpolate({
            inputRange: [0, 100],
            outputRange: ["0%", "100%"],
          }),
        },
      ]}
    />
  );
};

const PollMessage: React.FC<Props> = ({
  pollId,
  conversationId,
  initialPoll,
}) => {
  const currentUser = useAppSelector((state) => state.auth.user);
  const currentUserId = currentUser?.userId || (currentUser as any)?._id || "";

  const storeVotes = useMemo(() => {
    if (!initialPoll || !initialPoll.options || !currentUserId) return [];
    return initialPoll.options
      .filter((opt) =>
        opt.voters?.some((v) => String(v.userId) === String(currentUserId)),
      )
      .map((opt) => opt._id);
  }, [initialPoll, currentUserId]);


  const poll = initialPoll;

  const [selectedOptionIds, setSelectedOptionIds] = useState<string[]>([]);
  const [cachedMyVotes, setCachedMyVotes] = useState<string[]>([]);
  const [isLocalChanged, setIsLocalChanged] = useState(false);
  const [isVoting, setIsVoting] = useState(false);
  const [isAddingOption, setIsAddingOption] = useState(false);
  const [newOptionText, setNewOptionText] = useState("");
  const [isSubmittingOption, setIsSubmittingOption] = useState(false);

  const STORAGE_KEY = `poll_votes_${pollId}_${currentUserId}`;

  useEffect(() => {
    const loadCachedVotes = async () => {
      if (poll?.isAnonymous && currentUserId) {
        try {
          const saved = await SecureStore.getItemAsync(STORAGE_KEY);
          if (saved) {
            const parsed = JSON.parse(saved);
            setCachedMyVotes(parsed);
            if (!isLocalChanged) {
              setSelectedOptionIds(parsed);
            }
          }
        } catch (e) {
          console.error("Error loading cached votes", e);
        }
      }
    };
    loadCachedVotes();
  }, [pollId, currentUserId, poll?.isAnonymous]);


  useEffect(() => {
    if (!isLocalChanged) {
      if (poll?.isAnonymous && cachedMyVotes.length > 0) {
        setSelectedOptionIds(cachedMyVotes);
      } else {
        setSelectedOptionIds(storeVotes);
      }
    }
  }, [storeVotes.join(","), cachedMyVotes.join(","), isLocalChanged, poll?.isAnonymous]);

  if (!poll) return null;

  const isExpired = poll.expiresAt
    ? new Date() > new Date(poll.expiresAt)
    : false;

  const hasVoted = storeVotes.length > 0 || cachedMyVotes.length > 0;
  const showResults = !poll.hideResultsUntilVoted || hasVoted || isExpired;

  const displayTotalParticipants = Math.max(
    poll.totalParticipants || 0,
    poll.isAnonymous && cachedMyVotes.length > 0 ? 1 : 0,
  );

  const percentages = useMemo(() => {
    if (!poll || !poll.options) return [];

    // Xác định "Sự thật gốc" (Base Truth) để so sánh.
    // Nếu ẩn danh -> Server giấu data, ta phải lấy Cache làm gốc.
    // Nếu bình thường -> Lấy StoreVotes từ Server làm gốc.
    const baseVotes = poll.isAnonymous ? cachedMyVotes : storeVotes;

    // Tạo ra danh sách Options ảo để hiển thị NGAY LẬP TỨC
    const optimisticOptions = poll.options.map((opt) => {
      let currentVoteCount = opt.voteCount || 0;

      if (isLocalChanged) {
        const iVotedBase = baseVotes.includes(opt._id);
        const iVotedLocal = selectedOptionIds.includes(opt._id);

        if (iVotedLocal && !iVotedBase) {
          currentVoteCount += 1;
        } else if (!iVotedLocal && iVotedBase) {
          currentVoteCount = Math.max(0, currentVoteCount - 1);
        }
      }

      return { ...opt, voteCount: currentVoteCount };
    });

    let optimisticTotal = poll.totalParticipants || 0;

    if (isLocalChanged) {
      const wasNotVoting = baseVotes.length === 0;
      const isNowVoting = selectedOptionIds.length > 0;

      if (wasNotVoting && isNowVoting) {
        optimisticTotal += 1;
      } else if (!wasNotVoting && !isNowVoting) {
        optimisticTotal = Math.max(0, optimisticTotal - 1);
      }
    }

    return calculatePercentages(optimisticOptions, optimisticTotal);
  }, [
    poll?.options,
    poll?.totalParticipants,
    selectedOptionIds,
    storeVotes,
    cachedMyVotes,
    isLocalChanged,
    poll?.isAnonymous,
  ]);

  const isVoteDisabled = useMemo(() => {
    if (selectedOptionIds.length === 0) return true;
    if (isVoting) return true;

    const currentVotes = poll.isAnonymous && cachedMyVotes.length > 0 ? cachedMyVotes : storeVotes;

    if (selectedOptionIds.length !== currentVotes.length) return false;

    const sortedSelected = [...selectedOptionIds].sort();
    const sortedCurrent = [...currentVotes].sort();

    return sortedSelected.every((id, idx) => id === sortedCurrent[idx]);
  }, [selectedOptionIds, storeVotes, cachedMyVotes, isVoting, poll.isAnonymous]);

  const handleOptionClick = (optionId: string) => {
    if (isExpired) return;
    setIsLocalChanged(true);
    if (poll.isMultipleChoice) {
      setSelectedOptionIds((prev) =>
        prev.includes(optionId)
          ? prev.filter((id) => id !== optionId)
          : [...prev, optionId],
      );
    } else {
      setSelectedOptionIds([optionId]);
    }
  };

  const handleVote = async () => {
    if (isExpired || isVoting) return;
    if (selectedOptionIds.length === 0) return;

    setIsVoting(true);
    try {
      await pollService.votePoll(conversationId, pollId, selectedOptionIds);
      if (poll.isAnonymous) {
        setCachedMyVotes(selectedOptionIds);
        await SecureStore.setItemAsync(
          STORAGE_KEY,
          JSON.stringify(selectedOptionIds),
        );
      }
      setIsLocalChanged(false);
      Toast.show({ type: "success", text1: "Bình chọn thành công" });
    } catch (error) {
      Toast.show({ type: "error", text1: "Có lỗi xảy ra khi bình chọn" });
      console.error("Vote error", error);
    } finally {
      setIsVoting(false);
    }
  };

  const handleAddOption = async () => {
    if (isExpired || isSubmittingOption || !newOptionText.trim()) return;

    setIsSubmittingOption(true);
    try {
      await pollService.addOption(
        conversationId,
        pollId,
        newOptionText.trim(),
      );
      setNewOptionText("");
      setIsAddingOption(false);
      Toast.show({ type: "success", text1: "Thêm phương án thành công" });
    } catch (error) {
      Toast.show({ type: "error", text1: "Không thể thêm phương án" });
      console.error("Add option error", error);
    } finally {
      setIsSubmittingOption(false);
    }
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>{poll.title}</Text>
        <View style={styles.subHeader}>
          {poll.isAnonymous && (
            <View style={styles.anonymousBadge}>
              <Text style={styles.anonymousText}>ẨN DANH</Text>
            </View>
          )}
          <Text style={styles.participantCount}>
            {displayTotalParticipants} người đã bình chọn
          </Text>
        </View>
      </View>

      {/* Options List */}
      <View style={styles.optionsContainer}>
        {poll.options.map((option, index) => {
          const isSelected = selectedOptionIds.includes(option._id);
          const percent = showResults ? percentages[index] || 0 : 0;


          const displayVoteCount =
            poll.isAnonymous &&
              cachedMyVotes.includes(option._id) &&
              option.voteCount === 0
              ? 1
              : option.voteCount;

          return (
            <TouchableOpacity
              key={option._id}
              activeOpacity={0.7}
              onPress={() => handleOptionClick(option._id)}
              style={styles.optionItem}
            >
              <View style={styles.optionRow}>
                <View style={styles.optionLeft}>
                  <View
                    style={[
                      styles.checkbox,
                      isSelected && styles.checkboxSelected,
                    ]}
                  >
                    {isSelected && (
                      <Ionicons name="checkmark" size={12} color="white" />
                    )}
                  </View>
                  <Text
                    style={[
                      styles.optionText,
                      isSelected && styles.optionTextSelected,
                    ]}
                  >
                    {option.text}
                  </Text>
                </View>

                {showResults && (
                  <Text style={styles.voteCount}>
                    {(() => {
                      const baseVotes = poll.isAnonymous
                        ? cachedMyVotes
                        : storeVotes;
                      const iVotedBase = baseVotes.includes(option._id);
                      const iVotedLocal = selectedOptionIds.includes(option._id);

                      let displayVoteCount = option.voteCount || 0;

                      if (isLocalChanged) {
                        if (iVotedLocal && !iVotedBase) displayVoteCount += 1;
                        else if (!iVotedLocal && iVotedBase)
                          displayVoteCount = Math.max(0, displayVoteCount - 1);
                      }

                      return displayVoteCount;
                    })()}
                  </Text>
                )}
              </View>

              {/* Progress Bar Background */}
              <View style={styles.progressBarBg}>
                <AnimatedProgressBar
                  percent={percent}
                  isSelected={isSelected}
                  showResults={showResults}
                />

                {/* Stacked Avatars */}
                {!poll.isAnonymous && showResults && option.voters && (
                  <View style={styles.avatarStack}>
                    {option.voters.slice(0, 3).map((voter, idx) => (
                      <View key={voter.userId || idx} style={{ marginLeft: idx === 0 ? 0 : -10 }}>
                        <GroupAvatar
                          uri={voter.avatar}
                          name={voter.name}
                          size={16}
                        />
                      </View>
                    ))}
                    {option.voteCount > 3 && (
                      <View style={styles.moreVotesBadge}>
                        <Text style={styles.moreVotesText}>
                          +{option.voteCount - 3}
                        </Text>
                      </View>
                    )}
                  </View>
                )}
              </View>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Footer Action Area */}
      <View style={styles.footer}>
        {isExpired ? (
          <View style={styles.expiredBanner}>
            <Text style={styles.expiredText}>Bình chọn đã kết thúc</Text>
          </View>
        ) : (
          <View style={styles.actionContainer}>
            {/* Form Thêm phương án */}
            {poll.allowAddOptions && (
              <View style={styles.addOptionWrapper}>
                {isAddingOption ? (
                  <View style={styles.addOptionForm}>
                    <TextInput
                      style={styles.textInput}
                      placeholder="Nhập phương án mới..."
                      value={newOptionText}
                      onChangeText={setNewOptionText}
                      autoFocus
                    />
                    <View style={styles.addOptionButtons}>
                      <TouchableOpacity
                        onPress={() => {
                          setIsAddingOption(false);
                          setNewOptionText("");
                        }}
                      >
                        <Text style={styles.cancelButtonText}>Hủy</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={handleAddOption}
                        disabled={isSubmittingOption || !newOptionText.trim()}
                        style={[
                          styles.submitOptionButton,
                          (!newOptionText.trim() || isSubmittingOption) &&
                          styles.buttonDisabled,
                        ]}
                      >
                        {isSubmittingOption ? (
                          <ActivityIndicator size="small" color="white" />
                        ) : (
                          <Text style={styles.submitOptionButtonText}>
                            Thêm
                          </Text>
                        )}
                      </TouchableOpacity>
                    </View>
                  </View>
                ) : (
                  <TouchableOpacity
                    onPress={() => setIsAddingOption(true)}
                    style={styles.addOptionTrigger}
                  >
                    <Ionicons name="add" size={18} color="#0068ff" />
                    <Text style={styles.addOptionTriggerText}>
                      Thêm phương án
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            )}

            {/* Vote Button */}
            <TouchableOpacity
              onPress={handleVote}
              disabled={isVoteDisabled}
              style={[
                styles.voteButton,
                isVoteDisabled && styles.voteButtonDisabled,
              ]}
            >
              {isVoting ? (
                <ActivityIndicator size="small" color="white" />
              ) : (
                <Text
                  style={[
                    styles.voteButtonText,
                    isVoteDisabled && styles.voteButtonTextDisabled,
                  ]}
                >
                  Bình chọn
                </Text>
              )}
            </TouchableOpacity>
          </View>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: "white",
    borderRadius: 12,
    padding: 10,
    width: SCREEN_WIDTH * 0.72,
    borderWidth: 1,
    borderColor: "#f0f0f0",
  },
  header: {
    marginBottom: 12,
  },
  title: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1f2937",
    marginBottom: 4,
  },
  subHeader: {
    flexDirection: "row",
    alignItems: "center",
  },
  anonymousBadge: {
    backgroundColor: "#eff6ff",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: "#dbeafe",
    marginRight: 8,
  },
  anonymousText: {
    fontSize: 10,
    fontWeight: "bold",
    color: "#0068ff",
  },
  participantCount: {
    fontSize: 12,
    color: "#6b7280",
  },
  optionsContainer: {
    gap: 12,
  },
  optionItem: {
    width: "100%",
    paddingHorizontal: 4,
  },
  optionRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    marginBottom: 6,
  },
  optionLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  checkbox: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 1.5,
    borderColor: "#d1d5db",
    marginRight: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  checkboxSelected: {
    backgroundColor: "#0068ff",
    borderColor: "#0068ff",
  },
  optionText: {
    fontSize: 14,
    color: "#374151",
    flex: 1,
  },
  optionTextSelected: {
    color: "#0068ff",
    fontWeight: "500",
  },
  voteCount: {
    fontSize: 13,
    fontWeight: "600",
    color: "#4b5563",
    marginLeft: 8,
  },
  progressBarBg: {
    height: 24,
    width: "100%",
    backgroundColor: "#f9fafb",
    borderRadius: 6,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#f3f4f6",
    position: "relative",
    justifyContent: "center",
  },
  progressBarFill: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    backgroundColor: "rgba(209, 213, 219, 0.5)",
    borderTopRightRadius: 4,
    borderBottomRightRadius: 4,
  },
  progressBarFillSelected: {
    backgroundColor: "rgba(0, 104, 255, 0.1)",
  },
  avatarStack: {
    position: "absolute",
    right: 8,
    flexDirection: "row",
    alignItems: "center",
  },
  moreVotesBadge: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: "#f3f4f6",
    borderWidth: 1,
    borderColor: "white",
    alignItems: "center",
    justifyContent: "center",
    marginLeft: -4,
  },
  moreVotesText: {
    fontSize: 7,
    fontWeight: "bold",
    color: "#6b7280",
  },
  footer: {
    marginTop: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#f3f4f6",
  },
  expiredBanner: {
    backgroundColor: "#fef2f2",
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#fee2e2",
    alignItems: "center",
  },
  expiredText: {
    color: "#ef4444",
    fontSize: 13,
    fontWeight: "bold",
  },
  actionContainer: {
    gap: 12,
  },
  addOptionWrapper: {
    width: "100%",
  },
  addOptionTrigger: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  addOptionTriggerText: {
    fontSize: 13,
    color: "#0068ff",
    fontWeight: "500",
  },
  addOptionForm: {
    backgroundColor: "#f9fafb",
    padding: 10,
    borderRadius: 8,
    gap: 8,
  },
  textInput: {
    backgroundColor: "white",
    borderWidth: 1,
    borderColor: "#dbeafe",
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    fontSize: 14,
  },
  addOptionButtons: {
    flexDirection: "row",
    justifyContent: "flex-end",
    alignItems: "center",
    gap: 12,
  },
  cancelButtonText: {
    fontSize: 12,
    color: "#6b7280",
    fontWeight: "500",
  },
  submitOptionButton: {
    backgroundColor: "#0068ff",
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 6,
  },
  submitOptionButtonText: {
    color: "white",
    fontSize: 12,
    fontWeight: "bold",
  },
  voteButton: {
    backgroundColor: "#0068ff",
    paddingVertical: 8,
    paddingHorizontal: 20,
    borderRadius: 20,
    alignSelf: "flex-end",
  },
  voteButtonDisabled: {
    backgroundColor: "#f3f4f6",
  },
  voteButtonText: {
    color: "white",
    fontSize: 13,
    fontWeight: "bold",
  },
  voteButtonTextDisabled: {
    color: "#9ca3af",
  },
  buttonDisabled: {
    opacity: 0.5,
  },
});

export default PollMessage;
