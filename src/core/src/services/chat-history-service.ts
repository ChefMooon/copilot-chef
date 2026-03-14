import { bootstrapDatabase } from "../lib/bootstrap";
import { prisma } from "../lib/prisma";

const DEFAULT_PENDING_SUGGESTION_TTL_DAYS = 14;
const DEFAULT_ACTION_HISTORY_LIMIT = 50;

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

function serializeAction(action: {
  id: string;
  chatSessionId: string;
  domain: string;
  actionType: string;
  summary: string;
  forwardJson: string;
  inverseJson: string;
  undoneAt: Date | null;
  createdAt: Date;
}) {
  return {
    id: action.id,
    chatSessionId: action.chatSessionId,
    domain: action.domain,
    actionType: action.actionType,
    summary: action.summary,
    forwardJson: action.forwardJson,
    inverseJson: action.inverseJson,
    undoneAt: action.undoneAt ? action.undoneAt.toISOString() : null,
    createdAt: action.createdAt.toISOString(),
  };
}

function serializePendingSuggestion(suggestion: {
  id: string;
  chatSessionId: string;
  domain: string;
  title: string;
  payloadJson: string;
  expiresAt: Date;
  createdAt: Date;
}) {
  return {
    id: suggestion.id,
    chatSessionId: suggestion.chatSessionId,
    domain: suggestion.domain,
    title: suggestion.title,
    payloadJson: suggestion.payloadJson,
    expiresAt: suggestion.expiresAt.toISOString(),
    createdAt: suggestion.createdAt.toISOString(),
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

  async pruneExpiredPendingSuggestions(chatSessionId?: string) {
    await bootstrapDatabase();

    const now = new Date();
    const deleted = await prisma.chatPendingSuggestion.deleteMany({
      where: {
        ...(chatSessionId ? { chatSessionId } : {}),
        expiresAt: {
          lt: now,
        },
      },
    });

    return { count: deleted.count };
  }

  async addPendingSuggestion(input: {
    chatSessionId: string;
    domain: string;
    title: string;
    payloadJson: string;
    ttlDays?: number;
  }) {
    await bootstrapDatabase();

    const ttlDays = input.ttlDays ?? DEFAULT_PENDING_SUGGESTION_TTL_DAYS;
    const expiresAt = new Date(Date.now() + ttlDays * 24 * 60 * 60 * 1000);

    const suggestion = await prisma.chatPendingSuggestion.create({
      data: {
        chatSessionId: input.chatSessionId,
        domain: input.domain,
        title: input.title,
        payloadJson: input.payloadJson,
        expiresAt,
      },
    });

    await prisma.chatSession.update({
      where: { id: input.chatSessionId },
      data: { updatedAt: new Date() },
    });

    await this.pruneExpiredPendingSuggestions(input.chatSessionId);
    return serializePendingSuggestion(suggestion);
  }

  async listPendingSuggestions(chatSessionId: string) {
    await bootstrapDatabase();
    await this.pruneExpiredPendingSuggestions(chatSessionId);

    const suggestions = await prisma.chatPendingSuggestion.findMany({
      where: {
        chatSessionId,
        expiresAt: {
          gte: new Date(),
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    return suggestions.map(serializePendingSuggestion);
  }

  async recordAction(input: {
    chatSessionId: string;
    domain: string;
    actionType: string;
    summary: string;
    forwardJson: string;
    inverseJson: string;
    historyLimit?: number;
  }) {
    await bootstrapDatabase();

    // New action invalidates redo stack.
    await prisma.chatAction.deleteMany({
      where: {
        chatSessionId: input.chatSessionId,
        undoneAt: {
          not: null,
        },
      },
    });

    const action = await prisma.chatAction.create({
      data: {
        chatSessionId: input.chatSessionId,
        domain: input.domain,
        actionType: input.actionType,
        summary: input.summary,
        forwardJson: input.forwardJson,
        inverseJson: input.inverseJson,
      },
    });

    const historyLimit = input.historyLimit ?? DEFAULT_ACTION_HISTORY_LIMIT;
    const stale = await prisma.chatAction.findMany({
      where: {
        chatSessionId: input.chatSessionId,
      },
      orderBy: {
        createdAt: "desc",
      },
      skip: historyLimit,
      select: {
        id: true,
      },
    });

    if (stale.length > 0) {
      await prisma.chatAction.deleteMany({
        where: {
          id: {
            in: stale.map((entry) => entry.id),
          },
        },
      });
    }

    await prisma.chatSession.update({
      where: { id: input.chatSessionId },
      data: { updatedAt: new Date() },
    });

    return serializeAction(action);
  }

  async getLatestUndoAction(chatSessionId: string, domain?: string) {
    await bootstrapDatabase();
    const action = await prisma.chatAction.findFirst({
      where: {
        chatSessionId,
        ...(domain ? { domain } : {}),
        undoneAt: null,
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    return action ? serializeAction(action) : null;
  }

  async getLatestRedoAction(chatSessionId: string, domain?: string) {
    await bootstrapDatabase();
    const action = await prisma.chatAction.findFirst({
      where: {
        chatSessionId,
        ...(domain ? { domain } : {}),
        undoneAt: {
          not: null,
        },
      },
      orderBy: [{ undoneAt: "desc" }, { createdAt: "desc" }],
    });

    return action ? serializeAction(action) : null;
  }

  async markActionUndone(actionId: string) {
    await bootstrapDatabase();
    const action = await prisma.chatAction.update({
      where: { id: actionId },
      data: { undoneAt: new Date() },
    });
    return serializeAction(action);
  }

  async markActionRedone(actionId: string) {
    await bootstrapDatabase();
    const action = await prisma.chatAction.update({
      where: { id: actionId },
      data: { undoneAt: null },
    });
    return serializeAction(action);
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
