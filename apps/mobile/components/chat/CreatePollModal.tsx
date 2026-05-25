import React, { useState } from "react";
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Switch,
  ActivityIndicator,
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import DateTimePickerModal from "react-native-modal-datetime-picker";
import Toast from "react-native-toast-message";
import { pollService } from "../../services/poll.service";

interface Props {
  conversationId: string;
  visible: boolean;
  onClose: () => void;
}

const CreatePollModal: React.FC<Props> = ({
  conversationId,
  visible,
  onClose,
}) => {
  const [title, setTitle] = useState("");
  const [options, setOptions] = useState<string[]>(["", ""]);
  const [isMultipleChoice, setIsMultipleChoice] = useState(true);
  const [allowAddOptions, setAllowAddOptions] = useState(true);
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [hideResultsUntilVoted, setHideResultsUntilVoted] = useState(false);
  const [expiresAt, setExpiresAt] = useState<Date | null>(null);
  const [isDatePickerVisible, setDatePickerVisibility] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const showDatePicker = () => {
    setDatePickerVisibility(true);
  };

  const hideDatePicker = () => {
    setDatePickerVisibility(false);
  };

  const handleConfirmDate = (date: Date) => {
    setExpiresAt(date);
    hideDatePicker();
  };

  const handleClearDate = () => {
    setExpiresAt(null);
  };

  const handleAddOption = () => {
    setOptions([...options, ""]);
  };

  const handleRemoveOption = (index: number) => {
    if (options.length <= 2) return;
    const newOptions = [...options];
    newOptions.splice(index, 1);
    setOptions(newOptions);
  };

  const handleOptionChange = (index: number, value: string) => {
    const newOptions = [...options];
    newOptions[index] = value;
    setOptions(newOptions);
  };

  const handleSubmit = async () => {
    if (!title.trim()) {
      Toast.show({ type: "error", text1: "Vui lòng nhập tiêu đề bình chọn" });
      return;
    }

    const filteredOptions = options.filter((opt) => opt.trim() !== "");
    if (filteredOptions.length < 2) {
      Toast.show({ type: "error", text1: "Vui lòng nhập ít nhất 2 phương án" });
      return;
    }

    const uniqueOptions = new Set(filteredOptions);
    if (uniqueOptions.size !== filteredOptions.length) {
      Toast.show({ type: "error", text1: "Các phương án không được trùng nhau" });
      return;
    }

    try {
      setIsSubmitting(true);
      await pollService.createPoll(conversationId, {
        title,
        options: filteredOptions,
        isMultipleChoice,
        allowAddOptions,
        isAnonymous,
        hideResultsUntilVoted,
        expiresAt: expiresAt ? expiresAt.toISOString() : null,
      });
      Toast.show({ type: "success", text1: "Tạo bình chọn thành công" });
      onClose();
      // Reset form
      setTitle("");
      setOptions(["", ""]);
      setIsAnonymous(false);
      setHideResultsUntilVoted(false);
      setExpiresAt(null);
    } catch (error: any) {
      Toast.show({
        type: "error",
        text1: error.response?.data?.message || "Không thể tạo bình chọn",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Ionicons name="close" size={24} color="#6b7280" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Tạo bình chọn</Text>
            <TouchableOpacity
              onPress={handleSubmit}
              disabled={isSubmitting}
              style={styles.submitButton}
            >
              {isSubmitting ? (
                <ActivityIndicator size="small" color="#0068ff" />
              ) : (
                <Text style={styles.submitButtonText}>Tạo</Text>
              )}
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.body} showsVerticalScrollIndicator={false}>
            {/* Title Input */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Tiêu đề bình chọn</Text>
              <TextInput
                placeholder="Đặt câu hỏi cho nhóm..."
                style={styles.titleInput}
                value={title}
                onChangeText={setTitle}
                multiline
              />
            </View>

            {/* Options List */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Các phương án</Text>
              {options.map((option, index) => (
                <View key={index} style={styles.optionRow}>
                  <TextInput
                    placeholder={`Phương án ${index + 1}`}
                    style={styles.optionInput}
                    value={option}
                    onChangeText={(val) => handleOptionChange(index, val)}
                  />
                  {options.length > 2 && (
                    <TouchableOpacity
                      onPress={() => handleRemoveOption(index)}
                      style={styles.removeOptionBtn}
                    >
                      <Ionicons name="trash-outline" size={20} color="#ef4444" />
                    </TouchableOpacity>
                  )}
                </View>
              ))}
              <TouchableOpacity
                onPress={handleAddOption}
                style={styles.addOptionBtn}
              >
                <Ionicons name="add-circle-outline" size={20} color="#0068ff" />
                <Text style={styles.addOptionBtnText}>Thêm phương án</Text>
              </TouchableOpacity>
            </View>

            {/* Settings */}
            <View style={styles.settingsSection}>
              <View style={styles.settingItem}>
                <View style={styles.settingText}>
                  <Text style={styles.settingLabel}>Chọn nhiều phương án</Text>
                  <Text style={styles.settingDesc}>
                    Cho phép chọn &gt; 1 phương án
                  </Text>
                </View>
                <Switch
                  value={isMultipleChoice}
                  onValueChange={setIsMultipleChoice}
                  trackColor={{ false: "#d1d5db", true: "#dbeafe" }}
                  thumbColor={isMultipleChoice ? "#0068ff" : "#f3f4f6"}
                />
              </View>

              <View style={styles.settingItem}>
                <View style={styles.settingText}>
                  <Text style={styles.settingLabel}>Cho phép thêm phương án</Text>
                  <Text style={styles.settingDesc}>
                    Mọi người đều có thể thêm phương án
                  </Text>
                </View>
                <Switch
                  value={allowAddOptions}
                  onValueChange={setAllowAddOptions}
                  trackColor={{ false: "#d1d5db", true: "#dbeafe" }}
                  thumbColor={allowAddOptions ? "#0068ff" : "#f3f4f6"}
                />
              </View>

              <View style={styles.settingItem}>
                <View style={styles.settingText}>
                  <Text style={styles.settingLabel}>Bình chọn ẩn danh</Text>
                  <Text style={styles.settingDesc}>Ẩn người bình chọn</Text>
                </View>
                <Switch
                  value={isAnonymous}
                  onValueChange={setIsAnonymous}
                  trackColor={{ false: "#d1d5db", true: "#dbeafe" }}
                  thumbColor={isAnonymous ? "#0068ff" : "#f3f4f6"}
                />
              </View>

              <View style={styles.settingItem}>
                <View style={styles.settingText}>
                  <Text style={styles.settingLabel}>Ẩn kết quả</Text>
                  <Text style={styles.settingDesc}>
                    Chỉ hiện sau khi đã bình chọn
                  </Text>
                </View>
                <Switch
                  value={hideResultsUntilVoted}
                  onValueChange={setHideResultsUntilVoted}
                  trackColor={{ false: "#d1d5db", true: "#dbeafe" }}
                  thumbColor={hideResultsUntilVoted ? "#0068ff" : "#f3f4f6"}
                />
              </View>

              {/* Date Picker Section */}
              <View style={styles.settingItem}>
                <View style={styles.settingText}>
                  <Text style={styles.settingLabel}>Thời hạn kết thúc</Text>
                  <TouchableOpacity
                    onPress={showDatePicker}
                    activeOpacity={0.7}
                    style={styles.dateButton}
                  >
                    <Text
                      style={
                        expiresAt ? styles.dateTextActive : styles.dateTextPlaceholder
                      }
                    >
                      {expiresAt
                        ? expiresAt.toLocaleString("vi-VN", {
                            hour: "2-digit",
                            minute: "2-digit",
                            day: "2-digit",
                            month: "2-digit",
                            year: "numeric",
                          })
                        : "Không có thời hạn"}
                    </Text>
                    
                    {expiresAt ? (
                      <TouchableOpacity 
                        onPress={handleClearDate} 
                        hitSlop={{top: 10, bottom: 10, left: 10, right: 10}}
                      >
                        <Ionicons name="close-circle" size={20} color="#EF4444" />
                      </TouchableOpacity>
                    ) : (
                      <Ionicons name="calendar-outline" size={20} color="#6B7280" />
                    )}
                  </TouchableOpacity>
                </View>
              </View>

              <DateTimePickerModal
                isVisible={isDatePickerVisible}
                mode="datetime"
                date={expiresAt || new Date()}
                minimumDate={new Date()}
                onConfirm={handleConfirmDate}
                onCancel={hideDatePicker}
                confirmTextIOS="Xác nhận"
                cancelTextIOS="Hủy"
                locale="vi-VN"
              />
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: "white",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    height: "90%",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#f3f4f6",
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: "#111",
  },
  closeButton: {
    padding: 4,
  },
  submitButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  submitButtonText: {
    color: "#0068ff",
    fontSize: 16,
    fontWeight: "700",
  },
  body: {
    flex: 1,
    padding: 16,
  },
  inputGroup: {
    marginBottom: 24,
  },
  label: {
    fontSize: 14,
    fontWeight: "700",
    color: "#374151",
    marginBottom: 8,
  },
  titleInput: {
    fontSize: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
    paddingVertical: 8,
    color: "#111",
  },
  optionRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  optionInput: {
    flex: 1,
    fontSize: 15,
    borderBottomWidth: 1,
    borderBottomColor: "#f3f4f6",
    paddingVertical: 6,
    color: "#374151",
  },
  removeOptionBtn: {
    padding: 8,
  },
  addOptionBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 8,
  },
  addOptionBtnText: {
    color: "#0068ff",
    fontSize: 15,
    fontWeight: "500",
  },
  settingsSection: {
    borderTopWidth: 1,
    borderTopColor: "#f3f4f6",
    paddingTop: 16,
    paddingBottom: 40,
  },
  settingItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 20,
  },
  settingText: {
    flex: 1,
    marginRight: 16,
  },
  settingLabel: {
    fontSize: 15,
    fontWeight: "600",
    color: "#1f2937",
  },
  settingDesc: {
    fontSize: 12,
    color: "#6b7280",
    marginTop: 2,
  },
  datePickerTrigger: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: "#f9fafb",
    marginTop: 10,
  },
  dateButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#F3F4F6",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    marginTop: 8,
  },
  dateTextPlaceholder: {
    color: "#9CA3AF",
    fontSize: 15,
  },
  dateTextActive: {
    color: "#111827",
    fontSize: 15,
    fontWeight: "500",
  },
  iosDoneButton: {
    alignSelf: "flex-end",
    padding: 8,
  },
  iosDoneText: {
    color: "#0068ff",
    fontWeight: "bold",
    fontSize: 16,
  },
});

export default CreatePollModal;
