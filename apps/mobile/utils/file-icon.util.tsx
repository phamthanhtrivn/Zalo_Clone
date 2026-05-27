import React from "react";
import { Image } from "expo-image";

export const getFileIcon = (fileName: string, size = 28) => {
  const name = (fileName || "").toLowerCase();

  if (name.endsWith(".pdf")) {
    return (
      <Image
        source={{ uri: "https://cdn.jsdelivr.net/gh/glincker/thesvg@main/public/icons/pdf/default.svg" }}
        style={{ width: size, height: size }}
        contentFit="contain"
      />
    );
  }

  if (name.endsWith(".doc") || name.endsWith(".docx")) {
    return (
      <Image
        source={{ uri: "https://cdn.jsdelivr.net/gh/glincker/thesvg@main/public/icons/microsoft-word/default.svg" }}
        style={{ width: size, height: size }}
        contentFit="contain"
      />
    );
  }

  if (name.endsWith(".xls") || name.endsWith(".xlsx")) {
    return (
      <Image
        source={{ uri: "https://cdn.jsdelivr.net/gh/glincker/thesvg@main/public/icons/microsoft-excel/default.svg" }}
        style={{ width: size, height: size }}
        contentFit="contain"
      />
    );
  }

  return (
    <Image
      source={{ uri: "https://cdn.jsdelivr.net/gh/glincker/thesvg@main/public/icons/files/default.svg" }}
      style={{ width: size, height: size }}
      contentFit="contain"
    />
  );
};
