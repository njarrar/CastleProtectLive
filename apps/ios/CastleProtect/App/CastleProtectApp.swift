import SwiftUI
import UIKit

@main
struct CastleProtectApp: App {
    @UIApplicationDelegateAdaptor(AppDelegate.self) private var appDelegate
    @StateObject private var model = AppModel()
    @Environment(\.scenePhase) private var scenePhase

    var body: some Scene {
        WindowGroup {
            RootView()
                .environmentObject(model)
                .onChange(of: scenePhase) { phase in
                    model.scenePhaseChanged(phase)
                }
        }
    }
}

final class AppDelegate: NSObject, UIApplicationDelegate {
    func application(_ application: UIApplication, supportedInterfaceOrientationsFor window: UIWindow?) -> UIInterfaceOrientationMask {
        OrientationLock.mask
    }
}

/// Settings, Controls, Rotation: Follow device (default), Stay wide, Stay tall.
@MainActor
enum OrientationLock {
    static var mask: UIInterfaceOrientationMask = .allButUpsideDown

    static func apply(_ setting: RotationSetting) {
        let pad = UIDevice.current.userInterfaceIdiom == .pad
        let next: UIInterfaceOrientationMask
        switch setting {
        case .followDevice: next = pad ? .all : .allButUpsideDown
        case .stayWide: next = .landscape
        case .stayTall: next = pad ? [.portrait, .portraitUpsideDown] : .portrait
        }
        guard next != mask else { return }
        mask = next
        for scene in UIApplication.shared.connectedScenes {
            guard let windowScene = scene as? UIWindowScene else { continue }
            windowScene.requestGeometryUpdate(.iOS(interfaceOrientations: next)) { _ in }
            for window in windowScene.windows {
                window.rootViewController?.setNeedsUpdateOfSupportedInterfaceOrientations()
            }
        }
    }
}
