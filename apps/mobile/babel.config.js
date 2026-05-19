module.exports = function (api) {
  api.cache(true);
  return {
    presets: [
      ["babel-preset-expo", { jsxImportSource: "nativewind" }],
    ],
    plugins: [
      "react-native-reanimated/plugin" // 🚨 Luôn phải nằm cuối cùng trong mảng plugins
    ],
  };
};