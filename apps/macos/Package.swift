// swift-tools-version: 6.2
// Package manifest for the QuietCore macOS companion (menu bar app + IPC library).

import PackageDescription

let package = Package(
    name: "QuietCore",
    platforms: [
        .macOS(.v15),
    ],
    products: [
        .library(name: "QuietCoreIPC", targets: ["QuietCoreIPC"]),
        .library(name: "QuietCoreDiscovery", targets: ["QuietCoreDiscovery"]),
        .executable(name: "QuietCore", targets: ["QuietCore"]),
        .executable(name: "quiet-core-mac", targets: ["QuietCoreMacCLI"]),
    ],
    dependencies: [
        .package(url: "https://github.com/orchetect/MenuBarExtraAccess", exact: "1.3.0"),
        .package(url: "https://github.com/swiftlang/swift-subprocess.git", from: "0.4.0"),
        .package(url: "https://github.com/apple/swift-log.git", from: "1.10.1"),
        .package(url: "https://github.com/sparkle-project/Sparkle", from: "2.9.0"),
        .package(url: "https://github.com/steipete/Peekaboo.git", exact: "3.5.2"),
        .package(url: "https://github.com/pointfreeco/swift-concurrency-extras", from: "1.3.1"),
        .package(path: "../shared/QuietCoreKit"),
        .package(path: "../swabble"),
    ],
    targets: [
        .target(
            name: "QuietCoreIPC",
            dependencies: [],
            swiftSettings: [
                .enableUpcomingFeature("StrictConcurrency"),
            ]),
        .target(
            name: "QuietCoreDiscovery",
            dependencies: [
                .product(name: "QuietCoreKit", package: "QuietCoreKit"),
            ],
            path: "Sources/QuietCoreDiscovery",
            swiftSettings: [
                .enableUpcomingFeature("StrictConcurrency"),
            ]),
        .executableTarget(
            name: "QuietCore",
            dependencies: [
                "QuietCoreIPC",
                "QuietCoreDiscovery",
                .product(name: "QuietCoreKit", package: "QuietCoreKit"),
                .product(name: "QuietCoreChatUI", package: "QuietCoreKit"),
                .product(name: "QuietCoreProtocol", package: "QuietCoreKit"),
                .product(name: "SwabbleKit", package: "swabble"),
                .product(name: "MenuBarExtraAccess", package: "MenuBarExtraAccess"),
                .product(name: "Subprocess", package: "swift-subprocess"),
                .product(name: "Logging", package: "swift-log"),
                .product(name: "Sparkle", package: "Sparkle"),
                .product(name: "PeekabooBridge", package: "Peekaboo"),
                .product(name: "PeekabooAutomationKit", package: "Peekaboo"),
                .product(name: "ConcurrencyExtras", package: "swift-concurrency-extras"),
            ],
            exclude: [
                "Resources/Info.plist",
            ],
            resources: [
                .copy("Resources/QuietCore.icns"),
                .copy("Resources/DeviceModels"),
            ],
            swiftSettings: [
                .enableUpcomingFeature("StrictConcurrency"),
            ]),
        .executableTarget(
            name: "QuietCoreMacCLI",
            dependencies: [
                "QuietCoreDiscovery",
                .product(name: "QuietCoreKit", package: "QuietCoreKit"),
                .product(name: "QuietCoreProtocol", package: "QuietCoreKit"),
            ],
            path: "Sources/QuietCoreMacCLI",
            swiftSettings: [
                .enableUpcomingFeature("StrictConcurrency"),
            ]),
        .testTarget(
            name: "QuietCoreIPCTests",
            dependencies: [
                "QuietCoreIPC",
                "QuietCore",
                "QuietCoreMacCLI",
                "QuietCoreDiscovery",
                .product(name: "QuietCoreProtocol", package: "QuietCoreKit"),
                .product(name: "SwabbleKit", package: "swabble"),
            ],
            swiftSettings: [
                .enableUpcomingFeature("StrictConcurrency"),
                .enableExperimentalFeature("SwiftTesting"),
            ]),
    ])
