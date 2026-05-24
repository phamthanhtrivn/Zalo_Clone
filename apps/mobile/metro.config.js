const path = require("path");
const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");

const projectRoot = path.resolve(__dirname);

// 1. Lấy cấu hình mặc định của Expo
const config = getDefaultConfig(projectRoot);

const { transformer, resolver } = config;

// 2. Tích hợp cấu hình SVG Transformer vào config mặc định
config.transformer = {
  ...transformer,
  babelTransformerPath: require.resolve("react-native-svg-transformer/expo"),
};

config.resolver = {
  ...resolver,
  // Loại bỏ svg khỏi phần quản lý file tĩnh (asset)
  assetExts: resolver.assetExts.filter((ext) => ext !== "svg"),
  // Thêm svg vào phần quản lý file mã nguồn (source code) để import được dạng Component
  sourceExts: [...resolver.sourceExts, "svg"],
};
// 3. Cuối cùng, bọc toàn bộ config đã tùy biến bằng NativeWind và xuất ra
module.exports = withNativeWind(config, {
  input: path.join(projectRoot, "global.css"),
});
//