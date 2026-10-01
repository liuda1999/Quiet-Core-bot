import CoreLocation
import Foundation
import QuietCoreKit
import UIKit

typealias QuietCoreCameraSnapResult = (format: String, base64: String, width: Int, height: Int)
typealias QuietCoreCameraClipResult = (format: String, base64: String, durationMs: Int, hasAudio: Bool)

protocol CameraServicing: Sendable {
    func listDevices() async -> [CameraController.CameraDeviceInfo]
    func snap(params: QuietCoreCameraSnapParams) async throws -> QuietCoreCameraSnapResult
    func clip(params: QuietCoreCameraClipParams) async throws -> QuietCoreCameraClipResult
}

protocol ScreenRecordingServicing: Sendable {
    func record(
        screenIndex: Int?,
        durationMs: Int?,
        fps: Double?,
        includeAudio: Bool?,
        outPath: String?) async throws -> String
}

@MainActor
protocol LocationServicing: Sendable {
    func authorizationStatus() -> CLAuthorizationStatus
    func accuracyAuthorization() -> CLAccuracyAuthorization
    func ensureAuthorization(mode: QuietCoreLocationMode) async -> CLAuthorizationStatus
    func currentLocation(
        params: QuietCoreLocationGetParams,
        desiredAccuracy: QuietCoreLocationAccuracy,
        maxAgeMs: Int?,
        timeoutMs: Int?) async throws -> CLLocation
    func startMonitoringSignificantLocationChanges(onUpdate: @escaping @Sendable (CLLocation) -> Void)
}

@MainActor
protocol DeviceStatusServicing: Sendable {
    func status() async throws -> QuietCoreDeviceStatusPayload
    func info() -> QuietCoreDeviceInfoPayload
}

protocol PhotosServicing: Sendable {
    func latest(params: QuietCorePhotosLatestParams) async throws -> QuietCorePhotosLatestPayload
}

protocol ContactsServicing: Sendable {
    func search(params: QuietCoreContactsSearchParams) async throws -> QuietCoreContactsSearchPayload
    func add(params: QuietCoreContactsAddParams) async throws -> QuietCoreContactsAddPayload
}

protocol CalendarServicing: Sendable {
    func events(params: QuietCoreCalendarEventsParams) async throws -> QuietCoreCalendarEventsPayload
    func add(params: QuietCoreCalendarAddParams) async throws -> QuietCoreCalendarAddPayload
}

protocol RemindersServicing: Sendable {
    func list(params: QuietCoreRemindersListParams) async throws -> QuietCoreRemindersListPayload
    func add(params: QuietCoreRemindersAddParams) async throws -> QuietCoreRemindersAddPayload
}

protocol MotionServicing: Sendable {
    func activities(params: QuietCoreMotionActivityParams) async throws -> QuietCoreMotionActivityPayload
    func pedometer(params: QuietCorePedometerParams) async throws -> QuietCorePedometerPayload
}

struct WatchMessagingStatus: Equatable {
    var supported: Bool
    var paired: Bool
    var appInstalled: Bool
    var reachable: Bool
    var activationState: String
}

struct WatchQuickReplyEvent: Equatable {
    var replyId: String
    var promptId: String
    var actionId: String
    var actionLabel: String?
    var sessionKey: String?
    var note: String?
    var sentAtMs: Int?
    var transport: String
}

struct WatchExecApprovalResolveEvent: Equatable {
    var replyId: String
    var approvalId: String
    var decision: QuietCoreWatchExecApprovalDecision
    var sentAtMs: Int?
    var transport: String
}

struct WatchExecApprovalSnapshotRequestEvent: Equatable {
    var requestId: String
    var sentAtMs: Int?
    var transport: String
}

struct WatchAppSnapshotRequestEvent: Equatable {
    var requestId: String
    var sentAtMs: Int?
    var transport: String
}

struct WatchAppCommandEvent: Codable, Equatable {
    var commandId: String
    var command: QuietCoreWatchAppCommand
    var sessionKey: String?
    var gatewayStableID: String?
    var text: String?
    var sentAtMs: Int?
    var transport: String
}

struct WatchNotificationSendResult: Equatable {
    var deliveredImmediately: Bool
    var queuedForDelivery: Bool
    var transport: String
}

protocol WatchMessagingServicing: AnyObject, Sendable {
    func status() async -> WatchMessagingStatus
    func setStatusHandler(_ handler: (@Sendable (WatchMessagingStatus) -> Void)?)
    func setReplyHandler(_ handler: (@Sendable (WatchQuickReplyEvent) -> Void)?)
    func setExecApprovalResolveHandler(_ handler: (@Sendable (WatchExecApprovalResolveEvent) -> Void)?)
    func setExecApprovalSnapshotRequestHandler(
        _ handler: (@Sendable (WatchExecApprovalSnapshotRequestEvent) -> Void)?)
    func setAppSnapshotRequestHandler(_ handler: (@Sendable (WatchAppSnapshotRequestEvent) -> Void)?)
    func setAppCommandHandler(_ handler: (@Sendable (WatchAppCommandEvent) -> Void)?)
    func sendNotification(
        id: String,
        params: QuietCoreWatchNotifyParams) async throws -> WatchNotificationSendResult
    func sendExecApprovalPrompt(
        _ message: QuietCoreWatchExecApprovalPromptMessage) async throws -> WatchNotificationSendResult
    func sendExecApprovalResolved(
        _ message: QuietCoreWatchExecApprovalResolvedMessage) async throws -> WatchNotificationSendResult
    func sendExecApprovalExpired(
        _ message: QuietCoreWatchExecApprovalExpiredMessage) async throws -> WatchNotificationSendResult
    func syncExecApprovalSnapshot(
        _ message: QuietCoreWatchExecApprovalSnapshotMessage) async throws -> WatchNotificationSendResult
    func syncAppSnapshot(
        _ message: QuietCoreWatchAppSnapshotMessage) async throws -> WatchNotificationSendResult
}

extension CameraController: CameraServicing {}
extension ScreenRecordService: ScreenRecordingServicing {}
extension LocationService: LocationServicing {}
