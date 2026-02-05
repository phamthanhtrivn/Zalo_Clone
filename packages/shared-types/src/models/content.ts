import type { File } from "./file.js";

export interface Content {
  text?: string;
  icon?: string;
  file?: File;
}