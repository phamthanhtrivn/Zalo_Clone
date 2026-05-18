import React, {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  useCallback,
} from "react";
// @ts-ignore
import Peer from "simple-peer/simplepeer.min.js";
import { useSocket } from "./SocketContext";
import { useAppSelector } from "@/store";
import { ICE_SERVERS } from "@/constants/webrtc";
import { CallStatus, CallType } from "@/constants/types";
import { messageService } from "@/services/message.service";

export type CallMode = "NONE" | "DIRECT" | "GROUP";
export type CallSessionState =
  | "IDLE"
  | "CALLING"
  | "RINGING"
  | "CONNECTED"
  | "ENDED"
  | "IN_GROUP_CALL";

interface VideoCallData {
  isReceiving: boolean;
  from: string;
  fromName?: string;
  fromAvatar?: string;
  signal?: any;
  conversationId?: string;
  callType?: CallType;
  messageId?: string;
  sessionId?: string;
}

interface VideoCallContextType {
  callMode: CallMode;
  videoCallData: VideoCallData;
  sessionState: CallSessionState;
  myVideoRef: React.RefObject<HTMLVideoElement | null>;
  userVideoRef: React.RefObject<HTMLVideoElement | null>;
  stream: MediaStream | undefined;
  remoteStream: MediaStream | undefined;
  remoteStreams: Record<string, MediaStream>;
  peersConnecting: Set<string>;
  startDirectCall: (
    targetId: string,
    convId: string,
    type: CallType,
    targetName?: string,
    targetAvatar?: string,
  ) => void;
  answerDirectCall: () => void;
  startGroupCall: (convId: string, type: CallType) => void;
  joinGroupCall: (sessionId: string, convId: string, type: CallType) => void;
  leaveCall: (reason?: CallStatus) => void;
}

const VideoCallContext = createContext<VideoCallContextType | null>(null);

export const useCall = () => {
  const context = useContext(VideoCallContext);
  if (!context) throw new Error("useCall must be used within CallProvider");
  return context;
};

export const CallProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const { socket } = useSocket();
  const currentUser = useAppSelector((state) => state.auth.user);

  const [callMode, setCallMode] = useState<CallMode>("NONE");
  const [sessionState, setSessionState] = useState<CallSessionState>("IDLE");
  const sessionStateRef = useRef<CallSessionState>("IDLE");
  const [videoCallData, setVideoCallData] = useState<VideoCallData>({
    isReceiving: false,
    from: "",
  });

  const [stream, setStream] = useState<MediaStream>();
  const streamRef = useRef<MediaStream | undefined>(undefined);
  const myVideoRef = useRef<HTMLVideoElement>(null);

  const [remoteStream, setRemoteStream] = useState<MediaStream | undefined>(
    undefined,
  );
  const [pendingSignals, setPendingSignals] = useState<any[]>([]);
  const userVideoRef = useRef<HTMLVideoElement>(null);
  const peerRef = useRef<any>(null);

  const [remoteStreams, setRemoteStreams] = useState<
    Record<string, MediaStream>
  >({});
  const [peersConnecting, setPeersConnecting] = useState<Set<string>>(
    new Set(),
  );
  const peersRef = useRef(new Map<string, RTCPeerConnection>());
  const processingGroupOffersRef = useRef(new Set<string>());
  const pendingGroupCandidatesRef = useRef(
    new Map<string, RTCIceCandidateInit[]>(),
  );

  const ringtoneRef = useRef<HTMLAudioElement>(
    new Audio("/sounds/incoming.mp3"),
  );
  const dialingRef = useRef<HTMLAudioElement>(new Audio("/sounds/dialing.mp3"));

  useEffect(() => {
    if (ringtoneRef.current) ringtoneRef.current.loop = true;
    if (dialingRef.current) dialingRef.current.loop = true;
  }, []);

  const updateCallState = useCallback((newState: CallSessionState) => {
    setSessionState(newState);
    sessionStateRef.current = newState;
    console.log(`[CallState] Transition to: ${newState}`);
  }, []);

  const stopMediaStream = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
    }
    setStream(undefined);
    streamRef.current = undefined;
    setRemoteStream(undefined);
    setRemoteStreams({});
    if (myVideoRef.current) myVideoRef.current.srcObject = null;
    if (userVideoRef.current) userVideoRef.current.srcObject = null;

    [ringtoneRef, dialingRef].forEach((ref) => {
      if (ref.current) {
        ref.current.pause();
        ref.current.currentTime = 0;
      }
    });
  }, []);

  const removeConnectingPeer = useCallback((userId: string) => {
    setPeersConnecting((prev) => {
      const next = new Set(prev);
      next.delete(userId);
      return next;
    });
  }, []);

  const removeGroupPeer = useCallback(
    (userId: string) => {
      const peer = peersRef.current.get(userId);
      if (peer) {
        try {
          peer.ontrack = null;
          peer.onicecandidate = null;
          peer.onconnectionstatechange = null;
          peer.close();
        } catch { }
        peersRef.current.delete(userId);
      }

      pendingGroupCandidatesRef.current.delete(userId);
      removeConnectingPeer(userId);
      setRemoteStreams((prev) => {
        const next = { ...prev };
        delete next[userId];
        return next;
      });
    },
    [removeConnectingPeer],
  );

  const resetGroupPeers = useCallback(() => {
    peersRef.current.forEach((peer, userId) => {
      try {
        peer.ontrack = null;
        peer.onicecandidate = null;
        peer.onconnectionstatechange = null;
        peer.close();
      } catch { }
      pendingGroupCandidatesRef.current.delete(userId);
    });
    peersRef.current.clear();
    processingGroupOffersRef.current.clear();
    pendingGroupCandidatesRef.current.clear();
    setRemoteStreams({});
    setPeersConnecting(new Set());
  }, []);

  const leaveCall = useCallback(
    (reason: CallStatus = CallStatus.ENDED, isRemote: boolean = false) => {
      let finalStatus = reason;
      const currentState = sessionStateRef.current;

      if (currentState !== "CONNECTED" && currentState !== "IN_GROUP_CALL") {
        if (currentState === "CALLING") finalStatus = CallStatus.MISSED;
        else if (currentState === "RINGING")
          finalStatus = CallStatus.REJECTED;
      }

      if (videoCallData.sessionId) {
        if (!isRemote) {
          socket?.emit("call:group:leave", {
            sessionId: videoCallData.sessionId,
            conversationId: videoCallData.conversationId,
          });
        }
      } else if (videoCallData.from) {
        if (!isRemote) {
          if (finalStatus === CallStatus.REJECTED) {
            socket?.emit("call:reject", {
              to: videoCallData.from,
              conversationId: videoCallData.conversationId,
              reason: "NgÆ°á»i nghe tá»« chá»‘i cuá»™c gá»i",
              messageId: videoCallData.messageId,
            });
          } else {
            socket?.emit("call:end", {
              to: videoCallData.from,
              conversationId: videoCallData.conversationId,
              status: finalStatus,
              messageId: videoCallData.messageId,
            });
          }
        }
      }

      stopMediaStream();

      if (peerRef.current) {
        peerRef.current.destroy();
        peerRef.current = null;
      }

      resetGroupPeers();
      setPendingSignals([]);
      updateCallState("ENDED");

      setTimeout(() => {
        if (sessionStateRef.current === "ENDED") {
          updateCallState("IDLE");
          setCallMode("NONE");
          setVideoCallData({ isReceiving: false, from: "" });
        }
      }, 2000);
    },
    [socket, videoCallData, stopMediaStream, updateCallState, resetGroupPeers],
  );

  const createGroupPeer = useCallback(
    async (targetUserId: string, initiator: boolean, sessionId: string) => {
      if (!streamRef.current) return null;

      removeGroupPeer(targetUserId);
      setPeersConnecting((prev) => new Set(prev).add(targetUserId));

      const peer = new RTCPeerConnection(ICE_SERVERS);
      streamRef.current.getTracks().forEach((track) => {
        peer.addTrack(track, streamRef.current as MediaStream);
      });

      peer.onicecandidate = (event) => {
        if (event.candidate) {
          socket?.emit("call:group:signal", {
            toUserId: targetUserId,
            signalData: { type: "candidate", candidate: event.candidate },
            sessionId,
          });
        }
      };

      peer.ontrack = (event) => {
        const state = sessionStateRef.current;
        if (state === "IDLE" || state === "ENDED") return;
        if (event.streams && event.streams[0]) {
          setRemoteStreams((prev) => ({
            ...prev,
            [targetUserId]: event.streams[0],
          }));
        }
        removeConnectingPeer(targetUserId);
        if (state !== "IN_GROUP_CALL") {
          updateCallState("IN_GROUP_CALL");
        }
      };

      peer.onconnectionstatechange = () => {
        if (["failed", "disconnected", "closed"].includes(peer.connectionState)) {
          removeGroupPeer(targetUserId);
        }
      };

      peersRef.current.set(targetUserId, peer);

      if (initiator) {
        const offer = await peer.createOffer();
        await peer.setLocalDescription(offer);
        socket?.emit("call:group:signal", {
          toUserId: targetUserId,
          signalData: peer.localDescription,
          sessionId,
        });
      }

      return peer;
    },
    [socket, updateCallState, removeGroupPeer, removeConnectingPeer],
  );

  useEffect(() => {
    if (!socket) return;

    const handleIncomingSignal = (data: any) => {
      if (
        sessionStateRef.current !== "IDLE" &&
        sessionStateRef.current !== "ENDED" &&
        data.signal?.type === "offer"
      ) {
        socket.emit("call:respond_status", {
          to: data.from,
          status: CallStatus.BUSY,
          conversationId: data.conversationId,
        });
        return;
      }

      if (data.signal?.type === "offer") {
        setCallMode("DIRECT");
        setVideoCallData({ ...data, isReceiving: true });
        updateCallState("RINGING");
        ringtoneRef.current?.play().catch(() => { });

        if (data.messageId) {
          messageService.updateCallStatus({
            messageId: data.messageId,
            conversationId: data.conversationId,
            status: CallStatus.RINGING,
          });
        }
      }

      if (data.signal?.type === "answer") {
        updateCallState("CONNECTED");
        dialingRef.current?.pause();
      }

      //Hà Thanh Tuấn sửa
      if (data.signal) {
        if (peerRef.current && !peerRef.current.destroyed) {
          try {
            const internalPC = peerRef.current._pc;
            if (data.signal.type === "answer" && internalPC?.signalingState === "stable") {
              return;
            }
            peerRef.current.signal(data.signal);
          } catch (e) {
            console.warn("Signal error (1-1):", e);
          }
        } else if (data.signal.type === "offer" || !data.signal.type) {
          setPendingSignals((prev) => [...prev, data.signal]);
        }
      }
    };

    const handleGroupSignal = async (data: {
      fromUserId: string;
      signalData: any;
      sessionId: string;
    }) => {
      const currentState = sessionStateRef.current;
      if (currentState === "IDLE" || currentState === "ENDED") return;
      if (currentState !== "IN_GROUP_CALL" && currentState !== "CALLING") return;

      let peer = peersRef.current.get(data.fromUserId) || null;
      if (peer && peer.signalingState === "closed") {
        peersRef.current.delete(data.fromUserId);
        peer = null;
      }

      if (data.signalData?.type === "candidate") {
        if (!peer || !peer.remoteDescription) {
          const queued =
            pendingGroupCandidatesRef.current.get(data.fromUserId) || [];
          queued.push(data.signalData.candidate);
          pendingGroupCandidatesRef.current.set(data.fromUserId, queued);
          return;
        }

        try {
          await peer.addIceCandidate(
            new RTCIceCandidate(data.signalData.candidate),
          );
        } catch (e) {
          console.warn("Group candidate error:", e);
        }
        return;
      }

      if (data.signalData?.type === "offer") {
        if (processingGroupOffersRef.current.has(data.fromUserId)) return;
        processingGroupOffersRef.current.add(data.fromUserId);

        try {
          if (!peer) {
            peer = await createGroupPeer(data.fromUserId, false, data.sessionId);
          }
          if (!peer || peer.signalingState === "closed") return;

          if (peer.remoteDescription) return;

          if (
            peer.signalingState !== "stable" &&
            peer.signalingState !== "have-remote-offer"
          ) {
            removeGroupPeer(data.fromUserId);
            peer = await createGroupPeer(data.fromUserId, false, data.sessionId);
          }

          if (!peer || peer.signalingState === "closed") return;

          await peer.setRemoteDescription(
            new RTCSessionDescription(data.signalData),
          );
          if (peer.signalingState !== "have-remote-offer") return;

          const pendingCandidates =
            pendingGroupCandidatesRef.current.get(data.fromUserId) || [];
          for (const candidate of pendingCandidates) {
            try {
              await peer.addIceCandidate(new RTCIceCandidate(candidate));
            } catch { }
          }
          pendingGroupCandidatesRef.current.delete(data.fromUserId);

          const answer = await peer.createAnswer();
          await peer.setLocalDescription(answer);
          socket?.emit("call:group:signal", {
            toUserId: data.fromUserId,
            signalData: peer.localDescription,
            sessionId: data.sessionId,
          });
        } catch (e) {
          console.warn("Group offer handling error:", e);
        } finally {
          processingGroupOffersRef.current.delete(data.fromUserId);
        }
        return;
      }

      if (data.signalData?.type === "answer") {
        if (!peer) return;
        try {
          await peer.setRemoteDescription(
            new RTCSessionDescription(data.signalData),
          );

          const pendingCandidates =
            pendingGroupCandidatesRef.current.get(data.fromUserId) || [];
          for (const candidate of pendingCandidates) {
            try {
              await peer.addIceCandidate(new RTCIceCandidate(candidate));
            } catch { }
          }
          pendingGroupCandidatesRef.current.delete(data.fromUserId);
        } catch (e) {
          console.warn("Group answer handling error:", e);
        }
      }
    };

    const handleGroupLeave = (data: { userId: string }) => {
      removeGroupPeer(data.userId);
    };

    socket.on("call:signal", handleIncomingSignal);
    socket.on("call:ended", () => leaveCall(CallStatus.ENDED, true));
    socket.on("call:rejected", () => leaveCall(CallStatus.REJECTED, true));
    socket.on("call:group:signal", handleGroupSignal);
    socket.on("call:group:leave", handleGroupLeave);

    return () => {
      socket.off("call:signal");
      socket.off("call:ended");
      socket.off("call:rejected");
      socket.off("call:group:signal");
      socket.off("call:group:leave");
    };
  }, [socket, createGroupPeer, leaveCall, updateCallState, removeGroupPeer]);

  const startDirectCall = async (
    targetId: string,
    convId: string,
    type: CallType,
    targetName?: string,
    targetAvatar?: string,
  ) => {
    setCallMode("DIRECT");
    updateCallState("CALLING");
    dialingRef.current?.play().catch(() => { });

    try {
      const res = await messageService.createCallMessage({
        conversationId: convId,
        senderId: currentUser?.userId || (currentUser as any)?._id,
        type: type as any,
      });
      const msgId = res.data?._id || res._id;

      setVideoCallData({
        isReceiving: false,
        from: targetId,
        conversationId: convId,
        callType: type,
        messageId: msgId,
        fromName: targetName,
        fromAvatar: targetAvatar,
      });

      const currentStream = await navigator.mediaDevices.getUserMedia({
        video: type === CallType.VIDEO,
        audio: true,
      });
      setStream(currentStream);
      streamRef.current = currentStream;
      if (myVideoRef.current) myVideoRef.current.srcObject = currentStream;

      const p = new Peer({
        initiator: true,
        trickle: true,
        stream: currentStream,
        config: ICE_SERVERS,
      });

      //Hà Thanh Tuấn sửa - bắt lỗi để tránh crash app khi peerJS gặp lỗi
      p.on("error", (err: any) => {
        console.error("[WebRTC Caller Error]:", err);
        //nếu lỗi nhiều quá tự tắt máy.
        if (err.code === "ERR_WEBRTC_SUPPORT" || String(err).includes("wrong state")) {
          leaveCall();
        }
      });

      p.on("signal", (sig: any) => {
        socket?.emit("call:signal", {
          to: targetId,
          signal: sig,
          conversationId: convId,
          callType: type,
          fromName: currentUser?.profile?.name || currentUser?.name,
          fromAvatar:
            currentUser?.profile?.avatarUrl || currentUser?.avatarUrl,
          messageId: msgId,
        });
      });
      p.on("stream", (remStream: any) => {
        setRemoteStream(remStream);
        updateCallState("CONNECTED");
        dialingRef.current?.pause();
      });
      peerRef.current = p;
    } catch (err) {
      leaveCall();
    }
  };

  const answerDirectCall = async () => {
    updateCallState("CONNECTED");
    ringtoneRef.current?.pause();
    if (videoCallData.messageId) {
      messageService
        .updateCallStatus({
          messageId: videoCallData.messageId,
          conversationId: videoCallData.conversationId!,
          status: CallStatus.ACCEPTED,
        })
        .catch(() => { });
    }

    try {
      const currentStream = await navigator.mediaDevices.getUserMedia({
        video: videoCallData.callType === CallType.VIDEO,
        audio: true,
      });
      setStream(currentStream);
      streamRef.current = currentStream;
      if (myVideoRef.current) myVideoRef.current.srcObject = currentStream;

      const p = new Peer({
        initiator: false,
        trickle: true,
        stream: currentStream,
        config: ICE_SERVERS,
      });

      //Hà Thanh Tuấn sửa - bắt lỗi để tránh crash app khi peerJS gặp lỗi
      p.on("error", (err: any) => {
        console.error("[WebRTC Receiver Error]:", err);
        if (String(err).includes("wrong state")) {
          leaveCall(CallStatus.REJECTED);
        }
      });

      p.on("signal", (sig: any) => {
        socket?.emit("call:signal", {
          to: videoCallData.from,
          signal: sig,
          conversationId: videoCallData.conversationId,
          callType: videoCallData.callType,
        });
      });
      p.on("stream", (remStream: any) => setRemoteStream(remStream));
      pendingSignals.forEach((sig) => p.signal(sig));
      setPendingSignals([]);
      peerRef.current = p;
    } catch (err) {
      leaveCall(CallStatus.REJECTED);
    }
  };

  const startGroupCall = async (conversationId: string, type: CallType) => {
    setCallMode("GROUP");
    try {
      resetGroupPeers();

      const currentStream = await navigator.mediaDevices.getUserMedia({
        video: type === CallType.VIDEO,
        audio: true,
      });
      setStream(currentStream);
      streamRef.current = currentStream;
      if (myVideoRef.current) myVideoRef.current.srcObject = currentStream;

      const res = await messageService.initiateGroupCall({
        conversationId,
        senderId: currentUser?.userId || (currentUser as any)?._id,
        type,
      });
      const sessionId = res.data?.session?._id || res.session?._id;
      setVideoCallData({
        sessionId,
        conversationId,
        callType: type,
        isReceiving: false,
        from: "",
      });
      updateCallState("IN_GROUP_CALL");
      socket?.emit("call:group:join", { sessionId, conversationId });
    } catch (err) {
      leaveCall();
    }
  };

  const joinGroupCall = async (
    sessionId: string,
    conversationId: string,
    type: CallType,
  ) => {
    setCallMode("GROUP");
    updateCallState("IN_GROUP_CALL");
    try {
      resetGroupPeers();

      const currentStream = await navigator.mediaDevices.getUserMedia({
        video: type === CallType.VIDEO,
        audio: true,
      });
      setStream(currentStream);
      streamRef.current = currentStream;
      if (myVideoRef.current) myVideoRef.current.srcObject = currentStream;

      setVideoCallData({
        sessionId,
        conversationId,
        callType: type,
        isReceiving: false,
        from: "",
      });

      const response = await messageService.joinGroupCall(sessionId);
      const existingParticipants = response.data || response;
      for (const pId of existingParticipants) {
        await createGroupPeer(pId, true, sessionId);
      }
      socket?.emit("call:group:join", { sessionId, conversationId });
    } catch (err) {
      leaveCall();
    }
  };

  return (
    <VideoCallContext.Provider
      value={{
        callMode,
        videoCallData,
        sessionState,
        myVideoRef,
        userVideoRef,
        stream,
        remoteStream,
        remoteStreams,
        peersConnecting,
        startDirectCall,
        answerDirectCall,
        startGroupCall,
        joinGroupCall,
        leaveCall,
      }}
    >
      {children}
    </VideoCallContext.Provider>
  );
};
