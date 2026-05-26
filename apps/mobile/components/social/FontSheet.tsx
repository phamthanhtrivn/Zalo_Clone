import React, { useState } from "react";
import {
    Modal,
    View,
    Text,
    Pressable,
    ScrollView,
    StyleSheet,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

interface FontStyle {
    id: string;
    name: string;
    fontFamily?: string;
    fontWeight?: "normal" | "bold";
    fontStyle?: "normal" | "italic";
    preview: string;
}

interface FontColor {
    id: string;
    color: string;
    name: string;
}

interface Props {
    visible: boolean;
    onClose: () => void;
    onSelect: (style: FontStyle, color: FontColor) => void;
}

const FONT_STYLES: FontStyle[] = [
    { id: "normal", name: "Bình thường", fontWeight: "normal", fontStyle: "normal", preview: "Aa" },
    { id: "bold", name: "In đậm", fontWeight: "bold", fontStyle: "normal", preview: "Aa" },
    { id: "italic", name: "In nghiêng", fontWeight: "normal", fontStyle: "italic", preview: "Aa" },
    { id: "bold-italic", name: "Đậm nghiêng", fontWeight: "bold", fontStyle: "italic", preview: "Aa" },
];

const FONT_COLORS: FontColor[] = [
    { id: "black", color: "#000000", name: "Đen" },
    { id: "red", color: "#FF0000", name: "Đỏ" },
    { id: "blue", color: "#0068FF", name: "Xanh dương" },
    { id: "green", color: "#00C853", name: "Xanh lá" },
    { id: "orange", color: "#FF9800", name: "Cam" },
    { id: "purple", color: "#9C27B0", name: "Tím" },
    { id: "pink", color: "#E91E63", name: "Hồng" },
    { id: "brown", color: "#795548", name: "Nâu" },
    { id: "gray", color: "#607D8B", name: "Xám" },
    { id: "teal", color: "#009688", name: "Xanh ngọc" },
];

export default function FontSheet({ visible, onClose, onSelect }: Props) {
    const insets = useSafeAreaInsets();
    const [selectedStyle, setSelectedStyle] = useState<FontStyle>(FONT_STYLES[0]);
    const [selectedColor, setSelectedColor] = useState<FontColor>(FONT_COLORS[0]);
    const [previewText, setPreviewText] = useState("Xem trước văn bản");

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
                        <Text style={styles.title}>Định dạng chữ</Text>
                        <Pressable
                            onPress={() => {
                                onSelect(selectedStyle, selectedColor);
                                onClose();
                            }}
                        >
                            <Text style={styles.doneBtn}>Xong</Text>
                        </Pressable>
                    </View>

                    {/* Preview */}
                    <View style={styles.previewContainer}>
                        <Text
                            style={[
                                styles.previewText,
                                {
                                    fontWeight: selectedStyle.fontWeight,
                                    fontStyle: selectedStyle.fontStyle,
                                    color: selectedColor.color,
                                },
                            ]}
                        >
                            {previewText}
                        </Text>
                    </View>

                    <ScrollView showsVerticalScrollIndicator={false}>
                        {/* Font Styles */}
                        <Text style={styles.sectionTitle}>Kiểu chữ</Text>
                        <View style={styles.optionsRow}>
                            {FONT_STYLES.map((style) => (
                                <Pressable
                                    key={style.id}
                                    style={[
                                        styles.styleOption,
                                        selectedStyle.id === style.id && styles.selectedOption,
                                    ]}
                                    onPress={() => setSelectedStyle(style)}
                                >
                                    <Text
                                        style={[
                                            styles.stylePreview,
                                            {
                                                fontWeight: style.fontWeight,
                                                fontStyle: style.fontStyle,
                                            },
                                            selectedStyle.id === style.id && styles.selectedText,
                                        ]}
                                    >
                                        {style.preview}
                                    </Text>
                                    <Text style={styles.styleName}>{style.name}</Text>
                                </Pressable>
                            ))}
                        </View>

                        {/* Font Colors */}
                        <Text style={styles.sectionTitle}>Màu chữ</Text>
                        <View style={styles.colorsGrid}>
                            {FONT_COLORS.map((color) => (
                                <Pressable
                                    key={color.id}
                                    style={[
                                        styles.colorOption,
                                        { backgroundColor: color.color },
                                        selectedColor.id === color.id && styles.selectedColor,
                                    ]}
                                    onPress={() => setSelectedColor(color)}
                                >
                                    {selectedColor.id === color.id && (
                                        <Ionicons name="checkmark" size={20} color="#fff" />
                                    )}
                                </Pressable>
                            ))}
                        </View>
                    </ScrollView>
                </View>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        justifyContent: "flex-end",
    },
    backdrop: {
        flex: 1,
        backgroundColor: "rgba(0,0,0,0.5)",
    },
    sheet: {
        backgroundColor: "#fff",
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        maxHeight: "80%",
        paddingBottom: 30,
    },
    header: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingHorizontal: 16,
        paddingVertical: 14,
        borderBottomWidth: 1,
        borderBottomColor: "#f0f0f0",
    },
    title: {
        fontSize: 17,
        fontWeight: "600",
        color: "#333",
    },
    doneBtn: {
        fontSize: 16,
        fontWeight: "600",
        color: "#0068FF",
    },
    previewContainer: {
        margin: 16,
        padding: 20,
        backgroundColor: "#f8f9fa",
        borderRadius: 12,
        minHeight: 80,
        justifyContent: "center",
        alignItems: "center",
    },
    previewText: {
        fontSize: 18,
        textAlign: "center",
    },
    sectionTitle: {
        fontSize: 14,
        fontWeight: "600",
        color: "#666",
        marginLeft: 16,
        marginTop: 16,
        marginBottom: 10,
    },
    optionsRow: {
        flexDirection: "row",
        paddingHorizontal: 12,
        gap: 8,
    },
    styleOption: {
        flex: 1,
        alignItems: "center",
        paddingVertical: 12,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: "#e0e0e0",
        backgroundColor: "#fafafa",
    },
    selectedOption: {
        borderColor: "#0068FF",
        backgroundColor: "#e3f0ff",
    },
    stylePreview: {
        fontSize: 20,
        color: "#333",
        marginBottom: 4,
    },
    selectedText: {
        color: "#0068FF",
    },
    styleName: {
        fontSize: 11,
        color: "#666",
    },
    colorsGrid: {
        flexDirection: "row",
        flexWrap: "wrap",
        paddingHorizontal: 16,
        gap: 12,
    },
    colorOption: {
        width: 44,
        height: 44,
        borderRadius: 22,
        justifyContent: "center",
        alignItems: "center",
        borderWidth: 2,
        borderColor: "transparent",
    },
    selectedColor: {
        borderColor: "#333",
        transform: [{ scale: 1.1 }],
    },
});