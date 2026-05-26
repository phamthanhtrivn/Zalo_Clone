import React, { useState } from "react";
import {
    Modal,
    View,
    Text,
    Image,
    Pressable,
    FlatList,
    ActivityIndicator,
    Alert,
    StyleSheet,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { Dimensions } from "react-native";
import * as ImagePicker from "expo-image-picker";

const screenWidth = Dimensions.get("window").width;
const IMG_SIZE = (screenWidth - 6) / 3;

interface MediaAsset {
    id: string;
    uri: string;
}

interface Props {
    visible: boolean;
    checkedIds: Set<string>;
    onToggle: (id: string, uri: string) => void;
    onConfirm: () => void;
    onClose: () => void;
}

export default function MediaSheet({
    visible,
    checkedIds,
    onToggle,
    onConfirm,
    onClose,
}: Props) {
    const insets = useSafeAreaInsets();
    const [loading, setLoading] = useState(false);

    const openCamera = async () => {
        try {
            setLoading(true);

            // Request camera permission
            const { status } = await ImagePicker.requestCameraPermissionsAsync();
            if (status !== 'granted') {
                Alert.alert("Cần quyền", "Vui lòng cấp quyền camera trong Cài đặt");
                return;
            }

            // Mở camera
            const result = await ImagePicker.launchCameraAsync({
                mediaTypes: ['images', 'videos'],
                quality: 0.85,
            });

            if (!result.canceled && result.assets[0]) {
                const asset = result.assets[0];
                onToggle(Date.now().toString(), asset.uri);
                onConfirm();
            }
        } catch (error) {
            console.error('Camera error:', error);
            Alert.alert('Lỗi', 'Không thể mở camera');
        } finally {
            setLoading(false);
        }
    };

    const openGallery = async () => {
        try {
            setLoading(true);

            // Request media library permission
            const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
            if (status !== 'granted') {
                Alert.alert("Cần quyền", "Vui lòng cấp quyền truy cập thư viện ảnh");
                return;
            }

            // Mở gallery với multiple selection
            const result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ['images', 'videos'],
                allowsMultipleSelection: true,
                quality: 0.85,
            });

            if (!result.canceled && result.assets.length > 0) {
                result.assets.forEach(asset => {
                    onToggle(asset.assetId || Date.now().toString() + Math.random(), asset.uri);
                });
                onConfirm();
            }
        } catch (error) {
            console.error('Gallery error:', error);
            Alert.alert('Lỗi', 'Không thể mở thư viện ảnh');
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <Modal visible={visible} animationType="slide" transparent>
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color="#0068FF" />
                </View>
            </Modal>
        );
    }

    return (
        <Modal visible={visible} animationType="slide" transparent>
            <View style={styles.container}>
                <Pressable style={styles.backdrop} onPress={onClose} />

                <View style={[styles.sheet, { paddingBottom: 30 + insets.bottom }]}>
                    <View style={styles.handle} />

                    <View style={styles.optionsContainer}>
                        <Text style={styles.title}>Chọn ảnh/video</Text>

                        <Pressable style={styles.option} onPress={openCamera}>
                            <View style={styles.optionIcon}>
                                <Ionicons name="camera" size={28} color="#0068FF" />
                            </View>
                            <View style={styles.optionText}>
                                <Text style={styles.optionTitle}>Chụp ảnh</Text>
                                <Text style={styles.optionSubtitle}>Sử dụng camera</Text>
                            </View>
                            <Ionicons name="chevron-forward" size={20} color="#999" />
                        </Pressable>

                        <Pressable style={styles.option} onPress={openGallery}>
                            <View style={styles.optionIcon}>
                                <Ionicons name="images" size={28} color="#0068FF" />
                            </View>
                            <View style={styles.optionText}>
                                <Text style={styles.optionTitle}>Chọn từ thư viện</Text>
                                <Text style={styles.optionSubtitle}>Chọn nhiều ảnh/video</Text>
                            </View>
                            <Ionicons name="chevron-forward" size={20} color="#999" />
                        </Pressable>
                    </View>

                    <Pressable style={styles.cancelBtn} onPress={onClose}>
                        <Text style={styles.cancelText}>Hủy</Text>
                    </Pressable>
                </View>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        justifyContent: 'flex-end',
    },
    backdrop: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'rgba(0,0,0,0.5)',
    },
    sheet: {
        backgroundColor: '#fff',
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        paddingBottom: 30,
    },
    handle: {
        width: 40,
        height: 4,
        backgroundColor: '#ddd',
        borderRadius: 2,
        alignSelf: 'center',
        marginTop: 12,
        marginBottom: 20,
    },
    optionsContainer: {
        paddingHorizontal: 20,
    },
    title: {
        fontSize: 18,
        fontWeight: '600',
        color: '#333',
        marginBottom: 20,
        textAlign: 'center',
    },
    option: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 16,
        paddingHorizontal: 12,
        backgroundColor: '#f8f9fa',
        borderRadius: 12,
        marginBottom: 12,
    },
    optionIcon: {
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: '#e3f0ff',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 16,
    },
    optionText: {
        flex: 1,
    },
    optionTitle: {
        fontSize: 16,
        fontWeight: '500',
        color: '#333',
    },
    optionSubtitle: {
        fontSize: 13,
        color: '#666',
        marginTop: 2,
    },
    cancelBtn: {
        marginTop: 10,
        marginHorizontal: 20,
        paddingVertical: 14,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#ddd',
        alignItems: 'center',
    },
    cancelText: {
        fontSize: 16,
        color: '#666',
        fontWeight: '500',
    },
});