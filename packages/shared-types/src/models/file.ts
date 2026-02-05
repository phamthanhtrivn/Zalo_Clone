import type { FileType } from "../enums/file-type.js";

export interface File {
  fileName: string;
  fileUrl: string;
  fileSize: Number;
  type: FileType;
}