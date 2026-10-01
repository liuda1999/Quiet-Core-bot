import Foundation

public enum QuietCoreCameraCommand: String, Codable, Sendable {
    case list = "camera.list"
    case snap = "camera.snap"
    case clip = "camera.clip"
}

public enum QuietCoreCameraFacing: String, Codable, Sendable {
    case back
    case front
}

public enum QuietCoreCameraImageFormat: String, Codable, Sendable {
    case jpg
    case jpeg
}

public enum QuietCoreCameraVideoFormat: String, Codable, Sendable {
    case mp4
}

public struct QuietCoreCameraSnapParams: Codable, Sendable, Equatable {
    public var facing: QuietCoreCameraFacing?
    public var maxWidth: Int?
    public var quality: Double?
    public var format: QuietCoreCameraImageFormat?
    public var deviceId: String?
    public var delayMs: Int?

    public init(
        facing: QuietCoreCameraFacing? = nil,
        maxWidth: Int? = nil,
        quality: Double? = nil,
        format: QuietCoreCameraImageFormat? = nil,
        deviceId: String? = nil,
        delayMs: Int? = nil)
    {
        self.facing = facing
        self.maxWidth = maxWidth
        self.quality = quality
        self.format = format
        self.deviceId = deviceId
        self.delayMs = delayMs
    }
}

public struct QuietCoreCameraClipParams: Codable, Sendable, Equatable {
    public var facing: QuietCoreCameraFacing?
    public var durationMs: Int?
    public var includeAudio: Bool?
    public var format: QuietCoreCameraVideoFormat?
    public var deviceId: String?

    public init(
        facing: QuietCoreCameraFacing? = nil,
        durationMs: Int? = nil,
        includeAudio: Bool? = nil,
        format: QuietCoreCameraVideoFormat? = nil,
        deviceId: String? = nil)
    {
        self.facing = facing
        self.durationMs = durationMs
        self.includeAudio = includeAudio
        self.format = format
        self.deviceId = deviceId
    }
}
