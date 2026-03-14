import { bootstrapDatabase } from "../lib/bootstrap";
import { prisma } from "../lib/prisma";

function serializeSession(session: {
  id: string;
  title: string | null;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: session.id,
    title: session.title,
    createdAt: session.createdAt.toISOString(),
    updatedAt: session.updatedAt.toISOString(),
  };
}

function serializeMessage(message: {
  id: string;
  chatSessionId: string;
  role: string;
  content: string;
  createdAt: Date;
}) {
  return {
    id: message.id,
    chatSessionId: message.chatSessionId,
    role: message.role as "user" | "assistant",
    content: message.content,
    createdAt: message.createdAt.toISOString(),
  };
}

export class ChatHistoryService {
  async createSession(title?: string) {
    await bootstrapDatabase();
    const session = await prisma.chatSession.create({
      data: { title: title ?? null },
    });
    return serializeSession(session);
  }

  async addMessage(chatSessionId: string, role: "user" | "assistant", content: string) {
    await bootstrapDatabase();
    const message = await prisma.chatMessage.create({
      data: { chatSessionId, role, content },
    });
    await prisma.chatSession.update({
      where: { id: chatSessionId },
      data: { updatedAt: new Date() },
    });
    return serializeMessage(message);
  }

  async getSession(id: string) {
    await bootstrapDatabase();
    const session = await prisma.chatSession.findUnique({
      where: { id },
      include: { messages: { orderBy: { createdAt: "asc" } } },
    });
    if (!session) {
      return null;
    }
    return {
      ...serializeSession(session),
      messages: session.messages.map(serializeMessage),
    };
  }

  async listSessions(limit = 20) {
    await bootstrapDatabase();
    const sessions = await prisma.chatSession.findMany({
      orderBy: { updatedAt: "desc" },
      take: limit,
      include: {
        messages: {
          orderBy: { createdAt: "desc" },
          take: 1,
        },
      },
    });
    return sessions.map((session) => ({
      ...serializeSession(session),
      lastMessage: session.messages[0] ? serializeMessage(session.messages[0]) : null,
    }));
  }

  async deleteSession(id: string) {
    await bootstrapDatabase();
    await prisma.chatSession.delete({ where: { id } });
    return { id };
  }

  async updateSessionTitle(id: string, title: string) {
    await bootstrapDatabase();
    const session = await prisma.chatSession.update({
      where: { id },
      data: { title },
    });
    return serializeSession(session);
  }
}
