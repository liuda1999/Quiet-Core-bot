import Foundation

public enum QuietCoreChatTransportEvent: Sendable {
    case health(ok: Bool)
    case tick
    case chat(QuietCoreChatEventPayload)
    case sessionMessage(QuietCoreSessionMessageEventPayload)
    case agent(QuietCoreAgentEventPayload)
    case seqGap
}

public protocol QuietCoreChatTransport: Sendable {
    func createSession(
        key: String,
        label: String?,
        parentSessionKey: String?) async throws -> QuietCoreChatCreateSessionResponse

    func requestHistory(sessionKey: String) async throws -> QuietCoreChatHistoryPayload
    func listModels() async throws -> [QuietCoreChatModelChoice]
    func sendMessage(
        sessionKey: String,
        message: String,
        thinking: String,
        idempotencyKey: String,
        attachments: [QuietCoreChatAttachmentPayload]) async throws -> QuietCoreChatSendResponse

    func abortRun(sessionKey: String, runId: String) async throws
    func listSessions(limit: Int?) async throws -> QuietCoreChatSessionsListResponse
    func setSessionModel(sessionKey: String, model: String?) async throws
    func setSessionThinking(sessionKey: String, thinkingLevel: String) async throws

    func requestHealth(timeoutMs: Int) async throws -> Bool
    func waitForRunCompletion(runId: String, timeoutMs: Int) async -> Bool
    func events() -> AsyncStream<QuietCoreChatTransportEvent>

    func setActiveSessionKey(_ sessionKey: String) async throws
    func resetSession(sessionKey: String) async throws
    func compactSession(sessionKey: String) async throws
}

extension QuietCoreChatTransport {
    public func createSession(
        key _: String,
        label _: String?,
        parentSessionKey _: String?) async throws -> QuietCoreChatCreateSessionResponse
    {
        throw NSError(
            domain: "QuietCoreChatTransport",
            code: 0,
            userInfo: [NSLocalizedDescriptionKey: "sessions.create not supported by this transport"])
    }

    public func setActiveSessionKey(_: String) async throws {}

    public func waitForRunCompletion(runId _: String, timeoutMs _: Int) async -> Bool {
        false
    }

    public func resetSession(sessionKey _: String) async throws {
        throw NSError(
            domain: "QuietCoreChatTransport",
            code: 0,
            userInfo: [NSLocalizedDescriptionKey: "sessions.reset not supported by this transport"])
    }

    public func compactSession(sessionKey _: String) async throws {
        throw NSError(
            domain: "QuietCoreChatTransport",
            code: 0,
            userInfo: [NSLocalizedDescriptionKey: "sessions.compact not supported by this transport"])
    }

    public func abortRun(sessionKey _: String, runId _: String) async throws {
        throw NSError(
            domain: "QuietCoreChatTransport",
            code: 0,
            userInfo: [NSLocalizedDescriptionKey: "chat.abort not supported by this transport"])
    }

    public func listSessions(limit _: Int?) async throws -> QuietCoreChatSessionsListResponse {
        throw NSError(
            domain: "QuietCoreChatTransport",
            code: 0,
            userInfo: [NSLocalizedDescriptionKey: "sessions.list not supported by this transport"])
    }

    public func listModels() async throws -> [QuietCoreChatModelChoice] {
        throw NSError(
            domain: "QuietCoreChatTransport",
            code: 0,
            userInfo: [NSLocalizedDescriptionKey: "models.list not supported by this transport"])
    }

    public func setSessionModel(sessionKey _: String, model _: String?) async throws {
        throw NSError(
            domain: "QuietCoreChatTransport",
            code: 0,
            userInfo: [NSLocalizedDescriptionKey: "sessions.patch(model) not supported by this transport"])
    }

    public func setSessionThinking(sessionKey _: String, thinkingLevel _: String) async throws {
        throw NSError(
            domain: "QuietCoreChatTransport",
            code: 0,
            userInfo: [NSLocalizedDescriptionKey: "sessions.patch(thinkingLevel) not supported by this transport"])
    }
}
