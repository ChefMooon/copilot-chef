import { bootstrapDatabase } from "../lib/bootstrap";
import { prisma } from "../lib/prisma";

const DEFAULT_PENDING_SUGGESTION_TTL_DAYS = 14;
const DEFAULT_ACTION_HISTORY_LIMIT = 50;
const SESSION_TITLE_MAX_LENGTH = 72;
const DEFAULT_OWNER_ID = "web-default";

export type ChatSessionState =
  | "idle"
  | "waiting_for_input"
  | "completing_input"
  | "completed"
  | "failed";

type PendingInputState = {
  requestId: string;
  question: string;
  choices: string[];
  allowFreeform: boolean;
  requestedAt: string;
  retryCount: number;
  lastErrorCode: string | null;
  lastRequestId: string | null;
};

function normalizeOwnerId(ownerId?: string) {
  const normalized = ownerId?.trim();
  return normalized && normalized.length > 0 ? normalized : DEFAULT_OWNER_ID;
}

function summarizeSessionTitleFromMessage(content: string) {
  const normalized = content.replace(/\s+/g, " ").trim();
  if (!normalized) {
    return null;
  }

  if (normalized.length <= SESSION_TITLE_MAX_LENGTH) {
    return normalized;
  }

  return `${normalized.slice(0, SESSION_TITLE_MAX_LENGTH - 3).trimEnd()}...`;
}

function parsePendingChoices(raw: string | null): string[] {
  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed.filter((value): value is string => typeof value === "string");
  } catch {
    return [];
  }
}

function serializePendingInputState(session: {
  pendingInputRequestId: string | null;
  pendingQuestion: string | null;
  pendingChoicesJson: string | null;
  pendingAllowFreeform: boolean;
  pendingRequestedAt: Date | null;
  pendingRetryCount: number;
  pendingLastErrorCode: string | null;
  pendingLastRequestId: string | null;
}) {
  if (!session.pendingInputRequestId || !session.pendingQuestion) {
    return null;
  }

  return {
    requestId: session.pendingInputRequestId,
    question: session.pendingQuestion,
    choices: parsePendingChoices(session.pendingChoicesJson),
    allowFreeform: session.pendingAllowFreeform,
    requestedAt: session.pendingRequestedAt?.toISOString() ?? new Date().toISOString(),
    retryCount: session.pendingRetryCount,
    lastErrorCode: session.pendingLastErrorCode,
    lastRequestId: session.pendingLastRequestId,
  } satisfies PendingInputState;
}

function serializeSession(session: {
  id: string;
  copilotSessionId: string | null;
  title: string | null;
  state: ChatSessionState;
  pendingInputRequestId: string | null;
  pendingQuestion: string | null;
  pendingChoicesJson: string | null;
  pendingAllowFreeform: boolean;
  pendingRequestedAt: Date | null;
  pendingRetryCount: number;
  pendingLastErrorCode: string | null;
  pendingLastRequestId: string | null;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: session.id,
    copilotSessionId: session.copilotSessionId,
    title: session.title,
    state: session.state,
    pendingInput: serializePendingInputState(session),
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
  private async findOwnedSessionId(ownerId: string, chatSessionId: string) {
    const session = await prisma.chatSession.findFirst({
      where: { id: chatSessionId, ownerId },
      select: { id: true },
    });

    return session?.id ?? null;
  }

  private async requireOwnedSessionId(ownerId: string, chatSessionId: string) {
    const sessionId = await this.findOwnedSessionId(ownerId, chatSessionId);

    if (!sessionId) {
      throw new Error("Session not found");
    }

    return sessionId;
  }

  private async resolveOwnedActionId(ownerId: string, actionId: string) {
    const action = await prisma.chatAction.findFirst({
      where: {
        id: actionId,
        chatSession: {
          ownerId,
        },
      },
      select: { id: true },
    });

    if (!action) {
      throw new Error("Action not found");
    }

    return action.id;
  }

  async createSession(ownerId: string, title?: string) {
    await bootstrapDatabase();
    const session = await prisma.chatSession.create({
      data: { ownerId: normalizeOwnerId(ownerId), title: title ?? null },
    });
    return serializeSession(session);
  }

  async setCopilotSessionId(
    ownerId: string,
    chatSessionId: string,
    copilotSessionId: string
  ) {
    await bootstrapDatabase();
    const resolvedOwnerId = normalizeOwnerId(ownerId);
    const ownedSessionId = await this.requireOwnedSessionId(
      resolvedOwnerId,
      chatSessionId
    );

    const session = await prisma.chatSession.update({
      where: { id: ownedSessionId },
      data: { copilotSessionId },
    });
    return serializeSession(session);
  }

  async getCopilotSessionId(ownerId: string, chatSessionId: string) {
    await bootstrapDatabase();
    const session = await prisma.chatSession.findFirst({
      where: {
        id: chatSessionId,
        ownerId: normalizeOwnerId(ownerId),
      },
      select: { copilotSessionId: true },
    });
    return session?.copilotSessionId ?? null;
  }

  async clearCopilotSessionId(ownerId: string, chatSessionId: string) {
    await bootstrapDatabase();
    const resolvedOwnerId = normalizeOwnerId(ownerId);
    const ownedSessionId = await this.requireOwnedSessionId(
      resolvedOwnerId,
      chatSessionId
    );

    const session = await prisma.chatSession.update({
      where: { id: ownedSessionId },
      data: { copilotSessionId: null },
    });
    return serializeSession(session);
  }

  async setSessionState(
    ownerId: string,
    chatSessionId: string,
    state: ChatSessionState
  ) {
    await bootstrapDatabase();
    const resolvedOwnerId = normalizeOwnerId(ownerId);
    const ownedSessionId = await this.requireOwnedSessionId(
      resolvedOwnerId,
      chatSessionId
    );

    const session = await prisma.chatSession.update({
      where: { id: ownedSessionId },
      data: { state },
    });
    return serializeSession(session);
  }

  async setPendingInputState(
    ownerId: string,
    chatSessionId: string,
    input: {
      requestId: string;
      question: string;
      choices?: string[];
      allowFreeform?: boolean;
      requestedAt?: Date;
      lastRequestId?: string;
    }
  ) {
    await bootstrapDatabase();
    const resolvedOwnerId = normalizeOwnerId(ownerId);
    const ownedSessionId = await this.requireOwnedSessionId(
      resolvedOwnerId,
      chatSessionId
    );

    const session = await prisma.chatSession.update({
      where: { id: ownedSessionId },
      data: {
        state: "waiting_for_input",
        pendingInputRequestId: input.requestId,
        pendingQuestion: input.question,
        pendingChoicesJson: JSON.stringify(input.choices ?? []),
        pendingAllowFreeform: input.allowFreeform ?? true,
        pendingRequestedAt: input.requestedAt ?? new Date(),
        pendingRetryCount: 0,
        pendingLastErrorCode: null,
        pendingLastRequestId: input.lastRequestId ?? null,
      },
    });

    return serializeSession(session);
  }

  async markPendingInputAttempt(
    ownerId: string,
    chatSessionId: string,
    input: {
      requestId?: string;
      errorCode?: string | null;
      incrementRetry?: boolean;
      state?: ChatSessionState;
    }
  ) {
    await bootstrapDatabase();
    const resolvedOwnerId = normalizeOwnerId(ownerId);
    const ownedSessionId = await this.requireOwnedSessionId(
      resolvedOwnerId,
      chatSessionId
    );

    const current = await prisma.chatSession.findUnique({
      where: { id: ownedSessionId },
      select: { pendingRetryCount: true },
    });

    const session = await prisma.chatSession.update({
      where: { id: ownedSessionId },
      data: {
        ...(input.state ? { state: input.state } : {}),
        ...(input.requestId !== undefined
          ? { pendingLastRequestId: input.requestId }
          : {}),
        ...(input.errorCode !== undefined
          ? { pendingLastErrorCode: input.errorCode }
          : {}),
        ...(input.incrementRetry
          ? { pendingRetryCount: (current?.pendingRetryCount ?? 0) + 1 }
          : {}),
      },
    });

    return serializeSession(session);
  }

  async clearPendingInputState(ownerId: string, chatSessionId: string) {
    await bootstrapDatabase();
    const resolvedOwnerId = normalizeOwnerId(ownerId);
    const ownedSessionId = await this.requireOwnedSessionId(
      resolvedOwnerId,
      chatSessionId
    );

    const session = await prisma.chatSession.update({
      where: { id: ownedSessionId },
      data: {
        state: "idle",
        pendingInputRequestId: null,
        pendingQuestion: null,
        pendingChoicesJson: null,
        pendingAllowFreeform: true,
        pendingRequestedAt: null,
        pendingRetryCount: 0,
        pendingLastErrorCode: null,
        pendingLastRequestId: null,
      },
    });

    return serializeSession(session);
  }

  async getPendingInputState(ownerId: string, chatSessionId: string) {
    await bootstrapDatabase();
    const session = await prisma.chatSession.findFirst({
      where: {
        id: chatSessionId,
        ownerId: normalizeOwnerId(ownerId),
      },
      select: {
        state: true,
        pendingInputRequestId: true,
        pendingQuestion: true,
        pendingChoicesJson: true,
        pendingAllowFreeform: true,
        pendingRequestedAt: true,
        pendingRetryCount: true,
        pendingLastErrorCode: true,
        pendingLastRequestId: true,
      },
    });

    if (!session) {
      return null;
    }

    return {
      state: session.state,
      pendingInput:
        session.state === "waiting_for_input"
          ? serializePendingInputState(session)
          : null,
    };
  }

  async getSessionOwnerId(chatSessionId: string) {
    await bootstrapDatabase();
    const session = await prisma.chatSession.findUnique({
      where: { id: chatSessionId },
      select: { ownerId: true },
    });
    return session?.ownerId ?? null;
  }

  async addMessage(
    ownerId: string,
    chatSessionId: string,
    role: "user" | "assistant",
    content: string
  ) {
    await bootstrapDatabase();
    const resolvedOwnerId = normalizeOwnerId(ownerId);
    const ownedSessionId = await this.requireOwnedSessionId(
      resolvedOwnerId,
      chatSessionId
    );

    const message = await prisma.chatMessage.create({
      data: { chatSessionId: ownedSessionId, role, content },
    });

    if (role === "user") {
      const session = await prisma.chatSession.findUnique({
        where: { id: ownedSessionId },
        select: { title: true },
      });

      if (!session?.title) {
        const firstUserMessage = await prisma.chatMessage.findFirst({
          where: {
            chatSessionId: ownedSessionId,
            role: "user",
          },
          orderBy: {
            createdAt: "asc",
          },
          select: {
            id: true,
          },
        });

        if (firstUserMessage?.id === message.id) {
          const summarizedTitle = summarizeSessionTitleFromMessage(content);
          if (summarizedTitle) {
            await prisma.chatSession.update({
              where: { id: ownedSessionId },
              data: { title: summarizedTitle },
            });
          }
        }
      }
    }

    await prisma.chatSession.update({
      where: { id: ownedSessionId },
      data: { updatedAt: new Date() },
    });
    return serializeMessage(message);
  }

  async pruneExpiredPendingSuggestions(ownerId: string, chatSessionId?: string) {
    await bootstrapDatabase();

    const resolvedOwnerId = normalizeOwnerId(ownerId);
    const now = new Date();
    const deleted = await prisma.chatPendingSuggestion.deleteMany({
      where: {
        ...(chatSessionId
          ? {
              chatSessionId,
              chatSession: {
                ownerId: resolvedOwnerId,
              },
            }
          : {
              chatSession: {
                ownerId: resolvedOwnerId,
              },
            }),
        expiresAt: {
          lt: now,
        },
      },
    });

    return { count: deleted.count };
  }

  async addPendingSuggestion(input: {
    ownerId: string;
    chatSessionId: string;
    domain: string;
    title: string;
    payloadJson: string;
    ttlDays?: number;
  }) {
    await bootstrapDatabase();

    const resolvedOwnerId = normalizeOwnerId(input.ownerId);
    const ownedSessionId = await this.requireOwnedSessionId(
      resolvedOwnerId,
      input.chatSessionId
    );

    const ttlDays = input.ttlDays ?? DEFAULT_PENDING_SUGGESTION_TTL_DAYS;
    const expiresAt = new Date(Date.now() + ttlDays * 24 * 60 * 60 * 1000);

    const suggestion = await prisma.chatPendingSuggestion.create({
      data: {
        chatSessionId: ownedSessionId,
        domain: input.domain,
        title: input.title,
        payloadJson: input.payloadJson,
        expiresAt,
      },
    });

    await prisma.chatSession.update({
      where: { id: ownedSessionId },
      data: { updatedAt: new Date() },
    });

    await this.pruneExpiredPendingSuggestions(resolvedOwnerId, ownedSessionId);
    return serializePendingSuggestion(suggestion);
  }

  async listPendingSuggestions(ownerId: string, chatSessionId: string) {
    await bootstrapDatabase();
    const resolvedOwnerId = normalizeOwnerId(ownerId);
    const ownedSessionId = await this.findOwnedSessionId(
      resolvedOwnerId,
      chatSessionId
    );

    if (!ownedSessionId) {
      return [];
    }

    await this.pruneExpiredPendingSuggestions(resolvedOwnerId, ownedSessionId);

    const suggestions = await prisma.chatPendingSuggestion.findMany({
      where: {
        chatSessionId: ownedSessionId,
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
    ownerId: string;
    chatSessionId: string;
    domain: string;
    actionType: string;
    summary: string;
    forwardJson: string;
    inverseJson: string;
    historyLimit?: number;
  }) {
    await bootstrapDatabase();

    const resolvedOwnerId = normalizeOwnerId(input.ownerId);
    const ownedSessionId = await this.requireOwnedSessionId(
      resolvedOwnerId,
      input.chatSessionId
    );

    // New action invalidates redo stack.
    await prisma.chatAction.deleteMany({
      where: {
        chatSessionId: ownedSessionId,
        undoneAt: {
          not: null,
        },
      },
    });

    const action = await prisma.chatAction.create({
      data: {
        chatSessionId: ownedSessionId,
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
        chatSessionId: ownedSessionId,
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
      where: { id: ownedSessionId },
      data: { updatedAt: new Date() },
    });

    return serializeAction(action);
  }

  async getLatestUndoAction(
    ownerId: string,
    chatSessionId: string,
    domain?: string
  ) {
    await bootstrapDatabase();
    const ownedSessionId = await this.findOwnedSessionId(
      normalizeOwnerId(ownerId),
      chatSessionId
    );

    if (!ownedSessionId) {
      return null;
    }

    const action = await prisma.chatAction.findFirst({
      where: {
        chatSessionId: ownedSessionId,
        ...(domain ? { domain } : {}),
        undoneAt: null,
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    return action ? serializeAction(action) : null;
  }

  async getLatestRedoAction(
    ownerId: string,
    chatSessionId: string,
    domain?: string
  ) {
    await bootstrapDatabase();
    const ownedSessionId = await this.findOwnedSessionId(
      normalizeOwnerId(ownerId),
      chatSessionId
    );

    if (!ownedSessionId) {
      return null;
    }

    const action = await prisma.chatAction.findFirst({
      where: {
        chatSessionId: ownedSessionId,
        ...(domain ? { domain } : {}),
        undoneAt: {
          not: null,
        },
      },
      orderBy: [{ undoneAt: "desc" }, { createdAt: "desc" }],
    });

    return action ? serializeAction(action) : null;
  }

  async markActionUndone(ownerId: string, actionId: string) {
    await bootstrapDatabase();
    const ownedActionId = await this.resolveOwnedActionId(
      normalizeOwnerId(ownerId),
      actionId
    );

    const action = await prisma.chatAction.update({
      where: { id: ownedActionId },
      data: { undoneAt: new Date() },
    });
    return serializeAction(action);
  }

  async markActionRedone(ownerId: string, actionId: string) {
    await bootstrapDatabase();
    const ownedActionId = await this.resolveOwnedActionId(
      normalizeOwnerId(ownerId),
      actionId
    );

    const action = await prisma.chatAction.update({
      where: { id: ownedActionId },
      data: { undoneAt: null },
    });
    return serializeAction(action);
  }

  async getSession(ownerId: string, id: string) {
    await bootstrapDatabase();
    const session = await prisma.chatSession.findFirst({
      where: { id, ownerId: normalizeOwnerId(ownerId) },
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

  async listSessions(ownerId: string, limit = 20) {
    await bootstrapDatabase();
    const sessions = await prisma.chatSession.findMany({
      where: { ownerId: normalizeOwnerId(ownerId) },
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
      lastMessage: session.messages[0]
        ? serializeMessage(session.messages[0])
        : null,
    }));
  }

  async deleteSession(ownerId: string, id: string) {
    await bootstrapDatabase();
    const deleted = await prisma.chatSession.deleteMany({
      where: { id, ownerId: normalizeOwnerId(ownerId) },
    });

    if (deleted.count === 0) {
      return null;
    }

    return { id };
  }

  async clearHistory(ownerId: string) {
    await bootstrapDatabase();
    const deleted = await prisma.chatSession.deleteMany({
      where: { ownerId: normalizeOwnerId(ownerId) },
    });
    return { count: deleted.count };
  }

  async updateSessionTitle(ownerId: string, id: string, title: string) {
    await bootstrapDatabase();
    const ownedSessionId = await this.requireOwnedSessionId(
      normalizeOwnerId(ownerId),
      id
    );

    const session = await prisma.chatSession.update({
      where: { id: ownedSessionId },
      data: { title },
    });
    return serializeSession(session);
  }
}
