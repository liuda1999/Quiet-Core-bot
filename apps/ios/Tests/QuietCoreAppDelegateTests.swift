import Foundation
import Testing
@testable import QuietCore

@Suite(.serialized) struct QuietCoreAppDelegateTests {
    @Test @MainActor func `resolves registry model before view task assigns delegate model`() {
        let registryModel = NodeAppModel()
        QuietCoreAppModelRegistry.appModel = registryModel
        defer { QuietCoreAppModelRegistry.appModel = nil }

        let delegate = QuietCoreAppDelegate()

        #expect(delegate._test_resolvedAppModel() === registryModel)
    }

    @Test @MainActor func `prefers explicit delegate model over registry fallback`() {
        let registryModel = NodeAppModel()
        let explicitModel = NodeAppModel()
        QuietCoreAppModelRegistry.appModel = registryModel
        defer { QuietCoreAppModelRegistry.appModel = nil }

        let delegate = QuietCoreAppDelegate()
        delegate.appModel = explicitModel

        #expect(delegate._test_resolvedAppModel() === explicitModel)
    }

    @Test @MainActor func `derives background refresh task identifier from app bundle identifier`() {
        let delegate = QuietCoreAppDelegate()
        let bundleIdentifier = Bundle.main.bundleIdentifier ?? "ai.quiet-core-botfoundation.app.tests"

        #expect(delegate._test_wakeRefreshTaskIdentifier() == "\(bundleIdentifier).bgrefresh")
    }
}
