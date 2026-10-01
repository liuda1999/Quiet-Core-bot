import Foundation

public enum QuietCoreLocationMode: String, Codable, Sendable, CaseIterable {
    case off
    case whileUsing
    case always
}
