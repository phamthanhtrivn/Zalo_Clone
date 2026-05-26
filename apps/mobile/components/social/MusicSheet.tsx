import React, { useEffect, useState } from "react";
import {
    Modal, View, Text, Pressable, FlatList, StyleSheet, TextInput, ActivityIndicator
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { musicService } from "../../services/social.service";
import { Audio } from "expo-av";
import { Image } from "react-native";
interface Music {
    id: string;
    title: string;
    artist: string;
    duration?: string;
    previewUrl?: string;
    image?: string;
}

interface Props {
    visible: boolean;
    onClose: () => void;
    onSelect: (music: Music) => void;
}

export default function MusicSheet({ visible, onClose, onSelect }: Props) {
    const insets = useSafeAreaInsets();
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [query, setQuery] = useState("");
    const [loading, setLoading] = useState(false);
    const [musicList, setMusicList] = useState<Music[]>([]);
    const [sound, setSound] = useState<Audio.Sound | null>(null);

    // KHI MODAL MỞ LÊN HOẶC KHI TỪ KHÓA THAY ĐỔI -> GỌI API
    useEffect(() => {
        if (visible) {
            const timeout = setTimeout(() => {
                // Bỏ if (query.trim()) đi để query rỗng "" vẫn được gọi
                fetchMusic();
            }, 400); // 400ms debounce để người dùng gõ xong mới tìm
            return () => clearTimeout(timeout);
        } else {
            // Khi đóng modal, dừng nhạc đang phát
            if (sound) sound.unloadAsync();
        }
    }, [query, visible]); // Theo dõi cả query và visible

    const fetchMusic = async () => {
        try {
            setLoading(true);
            const res = await musicService.searchMusic(query);

            const data = res?.data || []; // ✅ đúng
            setMusicList(Array.isArray(data) ? data : []);

        } catch (err) {
            console.error("Music search error:", err);
            setMusicList([]);
        } finally {
            setLoading(false);
        }
    };

    const playPreview = async (url?: string, id?: string) => {
        if (!url) return;

        try {
            // 👉 Nếu bấm lại bài đang phát -> STOP
            if (selectedId === id && sound) {
                try {
                    const status = await sound.getStatusAsync();
                    if (status.isLoaded) {
                        await sound.stopAsync();
                        await sound.unloadAsync();
                    }
                } catch { }

                setSound(null);
                setSelectedId(null);
                return;
            }

            // 👉 Nếu đang có bài khác
            if (sound) {
                try {
                    const status = await sound.getStatusAsync();
                    if (status.isLoaded) {
                        await sound.stopAsync();
                        await sound.unloadAsync();
                    }
                } catch { }
            }

            // 👉 Tạo sound mới
            const { sound: newSound } = await Audio.Sound.createAsync(
                { uri: url },
                { shouldPlay: true }
            );

            setSound(newSound);
            setSelectedId(id || null);

        } catch (err) {
            console.log("❌ PLAY ERROR:", err);
        }
    };

    return (
        <Modal visible={visible} animationType="slide" transparent>
            <View style={styles.container}>
                <Pressable style={styles.backdrop} onPress={onClose} />

                <View style={[styles.sheet, { paddingBottom: 30 + insets.bottom }]}>
                    {/* Header */}
                    <View style={styles.header}>
                        <Pressable onPress={onClose}>
                            <Ionicons name="close" size={24} color="#333" />
                        </Pressable>

                        <Text style={styles.title}>Chọn nhạc</Text>

                        <Pressable
                            onPress={() => {
                                const music = musicList.find(m => m.id === selectedId);
                                if (music) {
                                    onSelect(music);
                                    if (sound) sound.unloadAsync(); // Tắt nhạc khi chọn xong
                                    onClose();
                                }
                            }}
                        >
                            <Text style={[styles.doneBtn, !selectedId && styles.disabled]}>
                                Xong
                            </Text>
                        </Pressable>
                    </View>

                    {/* Search input */}
                    <View style={styles.searchContainer}>
                        <Ionicons name="search-outline" size={20} color="#999" />
                        <TextInput
                            placeholder="Tìm kiếm bài hát..."
                            value={query}
                            onChangeText={setQuery}
                            style={{ flex: 1, fontSize: 16, paddingVertical: 0 }}
                        />
                        {query.length > 0 && (
                            <Pressable onPress={() => setQuery("")}>
                                <Ionicons name="close-circle" size={18} color="#999" />
                            </Pressable>
                        )}
                    </View>

                    {/* Tiêu đề danh sách (Thay đổi theo trạng thái tìm kiếm) */}
                    <Text style={{ paddingHorizontal: 16, marginBottom: 10, fontSize: 15, fontWeight: "600", color: "#333" }}>
                        {query.trim() === "" ? "🔥 Đang thịnh hành" : "🔍 Kết quả tìm kiếm"}
                    </Text>

                    {/* List */}
                    <FlatList
                        data={musicList}
                        keyExtractor={(item) => item.id}
                        ListEmptyComponent={
                            <View style={{ alignItems: "center", marginTop: 40 }}>
                                {loading ? (
                                    <ActivityIndicator size="large" color="#0068FF" />
                                ) : (
                                    <Text style={{ color: "#999" }}>Không tìm thấy bài hát nào</Text>
                                )}
                            </View>
                        }
                        renderItem={({ item }) => {
                            const isSelected = selectedId === item.id;
                            return (
                                <Pressable
                                    style={[styles.musicItem, isSelected && styles.selectedItem]}
                                    onPress={() => {
                                        playPreview(item.previewUrl, item.id);
                                    }}
                                >
                                    <Image
                                        source={{ uri: item.image }}
                                        style={styles.musicImage}
                                    />

                                    <View style={styles.musicInfo}>
                                        <Text style={[styles.musicTitle, isSelected && styles.selectedText]}>
                                            {item.title}
                                        </Text>
                                        <Text style={styles.musicArtist}>{item.artist}</Text>
                                    </View>

                                    {isSelected && (
                                        <Ionicons name="volume-medium" size={20} color="#0068FF" />
                                    )}
                                </Pressable>
                            );
                        }}
                        contentContainerStyle={styles.listContent}
                    />
                </View>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, justifyContent: "flex-end" },
    backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)" },
    sheet: { backgroundColor: "#fff", borderTopLeftRadius: 20, borderTopRightRadius: 20, height: "85%", paddingBottom: 30 },
    header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: "#f0f0f0" },
    title: { fontSize: 17, fontWeight: "600", color: "#333" },
    doneBtn: { fontSize: 16, fontWeight: "600", color: "#0068FF" },
    disabled: { color: "#ccc" },
    searchContainer: { flexDirection: "row", alignItems: "center", margin: 16, paddingHorizontal: 12, paddingVertical: 10, backgroundColor: "#f5f5f5", borderRadius: 10, gap: 8 },
    listContent: { paddingHorizontal: 16, paddingBottom: 20 },
    musicItem: { flexDirection: "row", alignItems: "center", paddingVertical: 12, paddingHorizontal: 12, borderRadius: 10, marginBottom: 6 },
    selectedItem: { backgroundColor: "#e3f0ff" },
    musicIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: "#f0f0f0", justifyContent: "center", alignItems: "center", marginRight: 12 },
    selectedMusicIcon: { backgroundColor: "#0068FF" },
    musicInfo: { flex: 1 },
    musicTitle: { fontSize: 15, fontWeight: "500", color: "#333" },
    selectedText: { color: "#0068FF", fontWeight: "600" },
    musicArtist: { fontSize: 13, color: "#999", marginTop: 2 },
    musicImage: {
        width: 50,
        height: 50,
        borderRadius: 10,
        marginRight: 12,
        backgroundColor: "#eee"
    },
});