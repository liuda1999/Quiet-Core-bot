import Foundation

public enum QuietCoreDeviceCommand: String, Codable, Sendable {
    case status = "device.status"
    case info = "device.info"
}

public enum QuietCoreBatteryState: String, Codable, Sendable {
    case unknown
    case unplugged
    case charging
    case full
}

public enum QuietCoreThermalState: String, Codable, Sendable {
    case nominal
    case fair
    case serious
    case critical
}

public enum QuietCoreNetworkPathStatus: String, Codable, Sendable {
    case satisfied
    case unsatisfied
    case requiresConnection
}

public enum QuietCoreNetworkInterfaceType: String, Codable, Sendable {
    case wifi
    case cellular
    case wired
    case other
}

public struct QuietCoreBatteryStatusPayload: Codable, Sendable, Equatable {
    public var level: Double?
    public var state: QuietCoreBatteryState
    public var lowPowerModeEnabled: Bool

    public init(level: Double?, state: QuietCoreBatteryState, lowPowerModeEnabled: Bool) {
        self.level = level
        self.state = state
        self.lowPowerModeEnabled = lowPowerModeEnabled
    }
}

public struct QuietCoreThermalStatusPayload: Codable, Sendable, Equatable {
    public var state: QuietCoreThermalState

    public init(state: QuietCoreThermalState) {
        self.state = state
    }
}

public struct QuietCoreStorageStatusPayload: Codable, Sendable, Equatable {
    public var totalBytes: Int64
    public var freeBytes: Int64
    public var usedBytes: Int64

    public init(totalBytes: Int64, freeBytes: Int64, usedBytes: Int64) {
        self.totalBytes = totalBytes
        self.freeBytes = freeBytes
        self.usedBytes = usedBytes
    }
}

public struct QuietCoreNetworkStatusPayload: Codable, Sendable, Equatable {
    public var status: QuietCoreNetworkPathStatus
    public var isExpensive: Bool
    public var isConstrained: Bool
    public var interfaces: [QuietCoreNetworkInterfaceType]

    public init(
        status: QuietCoreNetworkPathStatus,
        isExpensive: Bool,
        isConstrained: Bool,
        interfaces: [QuietCoreNetworkInterfaceType])
    {
        self.status = status
        self.isExpensive = isExpensive
        self.isConstrained = isConstrained
        self.interfaces = interfaces
    }
}

public struct QuietCoreDeviceStatusPayload: Codable, Sendable, Equatable {
    public var battery: QuietCoreBatteryStatusPayload
    public var thermal: QuietCoreThermalStatusPayload
    public var storage: QuietCoreStorageStatusPayload
    public var network: QuietCoreNetworkStatusPayload
    public var uptimeSeconds: Double

    public init(
        battery: QuietCoreBatteryStatusPayload,
        thermal: QuietCoreThermalStatusPayload,
        storage: QuietCoreStorageStatusPayload,
        network: QuietCoreNetworkStatusPayload,
        uptimeSeconds: Double)
    {
        self.battery = battery
        self.thermal = thermal
        self.storage = storage
        self.network = network
        self.uptimeSeconds = uptimeSeconds
    }
}

public struct QuietCoreDeviceInfoPayload: Codable, Sendable, Equatable {
    public var deviceName: String
    public var modelIdentifier: String
    public var systemName: String
    public var systemVersion: String
    public var appVersion: String
    public var appBuild: String
    public var locale: String

    public init(
        deviceName: String,
        modelIdentifier: String,
        systemName: String,
        systemVersion: String,
        appVersion: String,
        appBuild: String,
        locale: String)
    {
        self.deviceName = deviceName
        self.modelIdentifier = modelIdentifier
        self.systemName = systemName
        self.systemVersion = systemVersion
        self.appVersion = appVersion
        self.appBuild = appBuild
        self.locale = locale
    }
}
