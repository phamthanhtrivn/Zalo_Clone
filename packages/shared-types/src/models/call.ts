import type { CallStatus } from "../enums/call-status.js";
import type { CallType } from "../enums/call-type.js";

export interface Call {
  type: CallType;
  status: CallStatus;
  endedAt: Date;
  duration: number;
}