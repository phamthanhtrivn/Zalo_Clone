/* eslint-disable prettier/prettier */

import {
    WebSocketGateway,
    WebSocketServer,
    SubscribeMessage,
    MessageBody,
    ConnectedSocket,
} from "@nestjs/websockets";
import { Server, Socket } from "socket.io";

const socketCors = {
    origin: process.env.CLIENT_URL || "http://localhost:5173",
    credentials: true,
};

@WebSocketGateway({
    cors: socketCors,
})
export class ConversationSettingGateway {
    @WebSocketServer()
    server: Server;

    @SubscribeMessage("join")
    handleJoin(
        @MessageBody() userId: string,
        @ConnectedSocket() client: Socket,
    ) {
        console.log("JOIN ROOM:", userId);
        client.join(userId);
    }
    emitConversationUpdated(userId: string, conversation: any) {
        this.server.to(userId).emit("conversation_setting:update", conversation);
    }

    emitConversationDeleted(
        userId: string,
        payload: { conversationId: string; deletedAt: Date | null, clearAt: Date | null },
    ) {
        console.log("EMIT DELETE:", userId, payload);
        this.server.to(userId).emit("conversation_setting:delete", payload);
    }

    emitConversationCleared(
        userId: string,
        payload: { conversationId: string; clearAt: Date | null },
    ) {
        this.server.to(userId).emit("conversation_setting:clear", payload);
    }
}
