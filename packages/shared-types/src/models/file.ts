import type { FileType } from "../enums/file-type.js";

export interface File {
  fileKey: string;
  fileSize: number;
  type: FileType;
}