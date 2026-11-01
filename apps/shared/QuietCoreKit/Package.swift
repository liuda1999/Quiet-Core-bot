// swift-tools-version: 6.2

import PackageDescription

let package = Package(
    name: "QuietCoreKit",
    platforms: [
        .iOS(.v18),
        .macOS(.v15),
    ],
    products: [
        .library(name: "QuietCoreProtocol", targets: ["QuietCoreProtocol"]),
        .library(name: "QuietCoreKit", targets: ["QuietCoreKit"]),
        .library(name: "QuietCoreChatUI", targets: ["QuietCoreChatUI"]),
    ],
    traits: [
        .trait(name: "Talk", description: "ElevenLabs cloud TTS / talk support"),
        .default(enabledTraits: ["Talk"]),
    ],
    dependencies: [
        .package(url: "https://github.com/steipete/ElevenLabsKit", exact: "0.1.3"),
    ],
    targets: [
        .target(
            name: "QuietCoreProtocol",
            path: "Sources/QuietCoreProtocol",
            swiftSettings: [
                .enableUpcomingFeature("StrictConcurrency"),
            ]),
        .target(
            name: "QuietCoreKit",
            dependencies: [
                "QuietCoreProtocol",
                .product(name: "ElevenLabsKit", package: "ElevenLabsKit", condition: .when(traits: ["Talk"])),
            ],
            path: "Sources/QuietCoreKit",
            resources: [
                .process("Resources"),
            ],
            swiftSettings: [
                .enableUpcomingFeature("StrictConcurrency"),
            ]),
        .target(
            name: "QuietCoreChatUI",
            dependencies: [
                "QuietCoreKit",
            ],
            path: "Sources/QuietCoreChatUI",
            swiftSettings: [
                .enableUpcomingFeature("StrictConcurrency"),
            ]),
        .testTarget(
            name: "QuietCoreKitTests",
            dependencies: ["QuietCoreKit", "QuietCoreChatUI"],
            path: "Tests/QuietCoreKitTests",
            swiftSettings: [
                .enableUpcomingFeature("StrictConcurrency"),
                .enableExperimentalFeature("SwiftTesting"),
            ]),
    ])
