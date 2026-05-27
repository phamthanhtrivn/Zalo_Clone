import { Platform, Alert } from "react-native";
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";

/**
 * Downloads a file from a URL and saves it directly to the user's device.
 * - Android: Uses Storage Access Framework (SAF) so the user can save to their chosen directory (e.g. Downloads).
 * - iOS: Uses the Sharing sheet, allowing the user to select "Save to Files" natively.
 * 
 * @param fileKey The URL of the file to download
 * @param fileName The desired name of the file
 * @param mimeType The optional MIME type of the file
 * @returns Promise<boolean> True if saved successfully, false if cancelled or failed
 */
export const downloadAndSaveFile = async (
  fileKey: string,
  fileName: string,
  mimeType?: string
): Promise<boolean> => {
  if (!fileKey) return false;

  try {
    const cleanName = decodeURIComponent(fileName);
    const downloadUrl = encodeURI(fileKey);
    const tempUri = FileSystem.documentDirectory + cleanName;

    // 1. Download file to a local temporary path
    const { uri } = await FileSystem.downloadAsync(downloadUrl, tempUri);

    // 2. Perform platform-specific storage operation
    if (Platform.OS === "android") {
      const permissions = await FileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync();
      if (permissions.granted) {
        // Read temporary file as Base64 representation
        const fileContentB64 = await FileSystem.readAsStringAsync(uri, {
          encoding: FileSystem.EncodingType.Base64,
        });

        // Create document inside the user-selected folder
        const destUri = await FileSystem.StorageAccessFramework.createFileAsync(
          permissions.directoryUri,
          cleanName,
          mimeType || "application/octet-stream"
        );

        // Write the Base64 content to the physical file
        await FileSystem.writeAsStringAsync(destUri, fileContentB64, {
          encoding: FileSystem.EncodingType.Base64,
        });

        Alert.alert("Tải xuống thành công", `Đã lưu file: ${cleanName}`);
        return true;
      } else {
        return false;
      }
    } else {
      // iOS: Expo sharing is the only sandboxed way to trigger native "Save to Files" dialog
      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        await Sharing.shareAsync(uri, {
          mimeType: mimeType || "application/octet-stream",
          dialogTitle: cleanName,
        });
        return true;
      } else {
        Alert.alert("Thành công", `Đã tải xuống file: ${cleanName}`);
        return true;
      }
    }
  } catch (err) {
    Alert.alert("Lỗi", "Không thể tải hoặc lưu file này.");
    return false;
  }
};
