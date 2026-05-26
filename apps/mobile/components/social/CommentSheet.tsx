import React, { useEffect, useRef, useState, useCallback } from "react";
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    FlatList,
    Modal,
    Animated,
    KeyboardAvoidingView,
    Platform,
    Dimensions,
    ActivityIndicator,
    Alert,
    StyleSheet,
    Keyboard,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Image } from "expo-image";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useAppDispatch, useAppSelector } from "@/store/store";
import { fetchCommentsThunk, commentPostThunk, deleteCommentThunk } from "@/store/slices/diaryThunk";
import { CommentItem } from "@/store/slices/diarySlice";

const SCREEN_HEIGHT = Dimensions.get("window").height;
const EMPTY_COMMENTS: CommentItem[] = [];

interface Props {
    postId: string;
    visible: boolean;
    onClose: () => void;
    currentUserId: string;
    onCommentAdded?: () => void;
    onCommentDeleted?: () => void;
}

// Thời gian tương đối
function timeAgo(dateStr: string) {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "Vừa xong";
    if (mins < 60) return `${mins} phút`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs} giờ`;
    return `${Math.floor(hrs / 24)} ngày`;
}

export default function CommentSheet({
    postId,
    visible,
    onClose,
    currentUserId,
    onCommentAdded,
    onCommentDeleted,
}: Props) {
    const insets = useSafeAreaInsets();
    const dispatch = useAppDispatch();
    const comments: CommentItem[] = useAppSelector(
        (s: any) => s.diary?.commentsByPost?.[postId] ?? EMPTY_COMMENTS
    );
    const isLoading: boolean = useAppSelector(
        (s: any) => s.diary?.commentLoading?.[postId] ?? false
    );

    const [text, setText] = useState("");
    const [replyTo, setReplyTo] = useState<{ id: string; name: string } | null>(null);
    const [sending, setSending] = useState(false);

    const slideAnim = useRef(new Animated.Value(SCREEN_HEIGHT)).current;
    const inputRef = useRef<TextInput>(null);

    // Slide up / down animation
    useEffect(() => {
        if (visible) {
            Animated.spring(slideAnim, {
                toValue: 0,
                useNativeDriver: true,
                tension: 80,
                friction: 11,
            }).start();
            dispatch(fetchCommentsThunk(postId));
        } else {
            Animated.timing(slideAnim, {
                toValue: SCREEN_HEIGHT,
                duration: 250,
                useNativeDriver: true,
            }).start();
            setReplyTo(null);
            setText("");
        }
    }, [visible]);

    const handleSend = useCallback(async () => {
        if (!text.trim() || sending) return;
        setSending(true);
        await dispatch(
            commentPostThunk({
                postId,
                content: text.trim(),
                parentId: replyTo?.id,
            })
        );
        onCommentAdded?.();
        setSending(false);
        setText("");
        setReplyTo(null);
        Keyboard.dismiss();
    }, [text, replyTo, sending, postId, dispatch]);

    const handleDelete = useCallback(
        (commentId: string) => {
            Alert.alert("Xoá bình luận", "Bạn có chắc muốn xoá bình luận này?", [
                { text: "Huỷ", style: "cancel" },
                {
                    text: "Xoá",
                    style: "destructive",
                    onPress: () => {
                        dispatch(deleteCommentThunk({ postId, commentId }));
                        onCommentDeleted?.();
                    },
                },
            ]);
        },
        [postId, dispatch]
    );

    const handleReply = useCallback((comment: CommentItem) => {
        setReplyTo({ id: comment.id.toString(), name: comment.user.name });
        setTimeout(() => inputRef.current?.focus(), 100);
    }, []);

    // Tách root comments và replies
    const roots = comments.filter((c) => !c.parentId);
    const repliesOf = (parentId: string) =>
        comments.filter((c) => c.parentId?.toString() === parentId.toString());

    const renderComment = useCallback(
        ({ item }: { item: CommentItem }) => {
            const isMe = item.user.id?.toString() === currentUserId;
            const replies = repliesOf(item.id.toString());

            return (
                <View style={styles.commentBlock}>
                    {/* Root comment */}
                    <View style={styles.commentRow}>
                        <Image
                            source={{ uri: item.user.avatar || "https://ui-avatars.com/api/?name=U" }}
                            style={styles.avatar}
                        />
                        <View style={styles.commentContent}>
                            <View style={styles.bubble}>
                                <Text style={styles.authorName}>{item.user.name}</Text>
                                <Text style={styles.commentText}>{item.content}</Text>
                            </View>
                            {/* Actions */}
                            <View style={styles.commentMeta}>
                                <Text style={styles.timeText}>{timeAgo(item.createdAt)}</Text>
                                <TouchableOpacity onPress={() => handleReply(item)}>
                                    <Text style={styles.replyBtn}>Trả lời</Text>
                                </TouchableOpacity>
                                {isMe && (
                                    <TouchableOpacity onPress={() => handleDelete(item.id.toString())}>
                                        <Text style={styles.deleteBtn}>Xoá</Text>
                                    </TouchableOpacity>
                                )}
                            </View>
                        </View>
                    </View>

                    {/* Replies */}
                    {replies.map((reply) => {
                        const isReplyMe = reply.user.id?.toString() === currentUserId;
                        return (
                            <View key={reply.id?.toString()} style={[styles.commentRow, styles.replyRow]}>
                                <Image
                                    source={{ uri: reply.user.avatar || "https://ui-avatars.com/api/?name=U" }}
                                    style={styles.avatarSmall}
                                />
                                <View style={styles.commentContent}>
                                    <View style={[styles.bubble, styles.replyBubble]}>
                                        <Text style={styles.authorName}>{reply.user.name}</Text>
                                        <Text style={styles.commentText}>{reply.content}</Text>
                                    </View>
                                    <View style={styles.commentMeta}>
                                        <Text style={styles.timeText}>{timeAgo(reply.createdAt)}</Text>
                                        <TouchableOpacity onPress={() => handleReply(item)}>
                                            <Text style={styles.replyBtn}>Trả lời</Text>
                                        </TouchableOpacity>
                                        {isReplyMe && (
                                            <TouchableOpacity onPress={() => handleDelete(reply.id.toString())}>
                                                <Text style={styles.deleteBtn}>Xoá</Text>
                                            </TouchableOpacity>
                                        )}
                                    </View>
                                </View>
                            </View>
                        );
                    })}
                </View>
            );
        },
        [comments, currentUserId, handleReply, handleDelete]
    );

    return (
        <Modal
            visible={visible}
            transparent
            animationType="none"
            onRequestClose={onClose}
            statusBarTranslucent
        >
            {/* Backdrop */}
            <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose} />

            <Animated.View
                style={[
                    styles.sheet,
                    {
                        paddingBottom: (Platform.OS === "ios" ? 24 : 12) + insets.bottom,
                        transform: [{ translateY: slideAnim }],
                    },
                ]}
            >
                {/* Handle bar */}
                <View style={styles.handleBar} />

                {/* Header */}
                <View style={styles.header}>
                    <Text style={styles.headerTitle}>Bình luận</Text>
                    <TouchableOpacity onPress={onClose}>
                        <Ionicons name="close" size={24} color="#374151" />
                    </TouchableOpacity>
                </View>

                {/* Comments list */}
                {isLoading ? (
                    <View style={styles.loader}>
                        <ActivityIndicator size="large" color="#0068FF" />
                    </View>
                ) : roots.length === 0 ? (
                    <View style={styles.empty}>
                        <Text style={styles.emptyText}>Chưa có bình luận nào từ bạn bè 💬</Text>
                        <Text style={styles.emptySubText}>Hãy là người đầu tiên bình luận!</Text>
                    </View>
                ) : (
                    <FlatList
                        data={roots}
                        keyExtractor={(item) => item.id?.toString()}
                        renderItem={renderComment}
                        contentContainerStyle={styles.list}
                        showsVerticalScrollIndicator={false}
                        keyboardShouldPersistTaps="handled"
                    />
                )}

                {/* Input area */}
                <KeyboardAvoidingView
                    behavior={Platform.OS === "ios" ? "padding" : undefined}
                >
                    {/* Reply indicator */}
                    {replyTo && (
                        <View style={styles.replyIndicator}>
                            <Text style={styles.replyIndicatorText}>
                                Đang trả lời <Text style={{ fontWeight: "700" }}>{replyTo.name}</Text>
                            </Text>
                            <TouchableOpacity onPress={() => setReplyTo(null)}>
                                <Ionicons name="close-circle" size={18} color="#6b7280" />
                            </TouchableOpacity>
                        </View>
                    )}
                    <View style={styles.inputRow}>
                        <TextInput
                            ref={inputRef}
                            style={styles.input}
                            placeholder={replyTo ? `Trả lời ${replyTo.name}...` : "Viết bình luận..."}
                            placeholderTextColor="#9ca3af"
                            value={text}
                            onChangeText={setText}
                            multiline
                            maxLength={500}
                            returnKeyType="send"
                        />
                        <TouchableOpacity
                            style={[styles.sendBtn, { opacity: text.trim() ? 1 : 0.4 }]}
                            onPress={handleSend}
                            disabled={!text.trim() || sending}
                        >
                            {sending ? (
                                <ActivityIndicator size="small" color="#fff" />
                            ) : (
                                <Ionicons name="send" size={20} color="#fff" />
                            )}
                        </TouchableOpacity>
                    </View>
                </KeyboardAvoidingView>
            </Animated.View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    backdrop: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: "rgba(0,0,0,0.35)",
    },
    sheet: {
        position: "absolute",
        bottom: 0,
        left: 0,
        right: 0,
        backgroundColor: "#fff",
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        maxHeight: SCREEN_HEIGHT * 0.85,
        minHeight: SCREEN_HEIGHT * 0.5,
        paddingBottom: Platform.OS === "ios" ? 24 : 12,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: -4 },
        shadowOpacity: 0.12,
        shadowRadius: 16,
        elevation: 20,
    },
    handleBar: {
        width: 40,
        height: 4,
        backgroundColor: "#d1d5db",
        borderRadius: 2,
        alignSelf: "center",
        marginTop: 10,
        marginBottom: 4,
    },
    header: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: "#e5e7eb",
    },
    headerTitle: {
        fontSize: 17,
        fontWeight: "700",
        color: "#111827",
    },
    loader: { flex: 1, justifyContent: "center", alignItems: "center", paddingVertical: 40 },
    empty: { flex: 1, justifyContent: "center", alignItems: "center", paddingVertical: 48, paddingHorizontal: 24 },
    emptyText: { fontSize: 16, color: "#374151", fontWeight: "600", textAlign: "center" },
    emptySubText: { fontSize: 13, color: "#9ca3af", marginTop: 6, textAlign: "center" },
    list: { paddingHorizontal: 12, paddingTop: 8, paddingBottom: 16 },

    commentBlock: { marginBottom: 12 },
    commentRow: { flexDirection: "row", alignItems: "flex-start" },
    replyRow: { marginLeft: 48, marginTop: 8 },

    avatar: { width: 38, height: 38, borderRadius: 19, marginRight: 10 },
    avatarSmall: { width: 30, height: 30, borderRadius: 15, marginRight: 8 },

    commentContent: { flex: 1 },
    bubble: {
        backgroundColor: "#f3f4f6",
        borderRadius: 16,
        paddingHorizontal: 14,
        paddingVertical: 10,
        alignSelf: "flex-start",
        maxWidth: "95%",
    },
    replyBubble: { backgroundColor: "#eff6ff" },
    authorName: { fontSize: 13, fontWeight: "700", color: "#111827", marginBottom: 2 },
    commentText: { fontSize: 14, color: "#374151", lineHeight: 20 },
    commentMeta: { flexDirection: "row", alignItems: "center", marginTop: 4, marginLeft: 4, gap: 12 },
    timeText: { fontSize: 12, color: "#9ca3af" },
    replyBtn: { fontSize: 12, color: "#0068FF", fontWeight: "600" },
    deleteBtn: { fontSize: 12, color: "#ef4444", fontWeight: "600" },

    replyIndicator: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        backgroundColor: "#eff6ff",
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderTopWidth: StyleSheet.hairlineWidth,
        borderTopColor: "#bfdbfe",
    },
    replyIndicatorText: { fontSize: 13, color: "#2563eb" },

    inputRow: {
        flexDirection: "row",
        alignItems: "flex-end",
        paddingHorizontal: 12,
        paddingTop: 10,
        paddingBottom: 6,
        gap: 8,
        borderTopWidth: StyleSheet.hairlineWidth,
        borderTopColor: "#e5e7eb",
    },
    input: {
        flex: 1,
        minHeight: 44,
        maxHeight: 120,
        backgroundColor: "#f3f4f6",
        borderRadius: 22,
        paddingHorizontal: 16,
        paddingVertical: 10,
        fontSize: 15,
        color: "#111827",
        lineHeight: 20,
    },
    sendBtn: {
        width: 44,
        height: 44,
        backgroundColor: "#0068FF",
        borderRadius: 22,
        justifyContent: "center",
        alignItems: "center",
    },
});
