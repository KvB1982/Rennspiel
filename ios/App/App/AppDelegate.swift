import UIKit
import Capacitor
import MultipeerConnectivity

@UIApplicationMain
class AppDelegate: UIResponder, UIApplicationDelegate {

    var window: UIWindow?

    func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
        // Der Bildschirm bleibt an, auch wenn nur durch Neigen oder mit dem iPhone als Lenkrad gespielt wird.
        application.isIdleTimerDisabled = true
        return true
    }

    func applicationWillResignActive(_ application: UIApplication) {
        // Sent when the application is about to move from active to inactive state. This can occur for certain types of temporary interruptions (such as an incoming phone call or SMS message) or when the user quits the application and it begins the transition to the background state.
        // Use this method to pause ongoing tasks, disable timers, and invalidate graphics rendering callbacks. Games should use this method to pause the game.
    }

    func applicationDidEnterBackground(_ application: UIApplication) {
        // Use this method to release shared resources, save user data, invalidate timers, and store enough application state information to restore your application to its current state in case it is terminated later.
        // If your application supports background execution, this method is called instead of applicationWillTerminate: when the user quits.
    }

    func applicationWillEnterForeground(_ application: UIApplication) {
        // Called as part of the transition from the background to the active state; here you can undo many of the changes made on entering the background.
    }

    func applicationDidBecomeActive(_ application: UIApplication) {
        // Restart any tasks that were paused (or not yet started) while the application was inactive. If the application was previously in the background, optionally refresh the user interface.
    }

    func applicationWillTerminate(_ application: UIApplication) {
        // Called when the application is about to terminate. Save data if appropriate. See also applicationDidEnterBackground:.
    }

    func application(_ application: UIApplication,
                     configurationForConnecting connectingSceneSession: UISceneSession,
                     options: UIScene.ConnectionOptions) -> UISceneConfiguration {
        let config = UISceneConfiguration(name: "Default Configuration",
                                          sessionRole: connectingSceneSession.role)
        config.delegateClass = SceneDelegate.self
        return config
    }
}

// MARK: - Eigener Bildschirm-Controller: meldet das Lenkrad-Plugin an

class MainViewController: CAPBridgeViewController {
    override func capacitorDidLoad() {
        bridge?.registerPluginInstance(LenkradLinkPlugin())
    }
}

// MARK: - Lenkrad: direkte Verbindung zwischen iPad (zeigt das Rennen) und iPhone (ist das Lenkrad)

/// Brücke zum Spiel (js/verbindung.js, Klasse NahLink). Methoden: host, join, stop, send. Ereignisse: state, data.
/// Übernommen aus Frontlinie 3 (dort heißt es PadLink).
@objc(LenkradLinkPlugin)
public class LenkradLinkPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "LenkradLinkPlugin"
    public let jsName = "LenkradLink"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "host", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "join", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "stop", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "send", returnType: CAPPluginReturnPromise)
    ]
    private let link = LenkradLink()

    override public func load() {
        link.onState = { [weak self] state, peer in
            self?.notifyListeners("state", data: ["state": state, "peer": peer])
        }
        link.onData = { [weak self] text in
            self?.notifyListeners("data", data: ["d": text])
        }
    }

    @objc func host(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            self.link.start(asHost: true)
            call.resolve()
        }
    }

    @objc func join(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            self.link.start(asHost: false)
            call.resolve()
        }
    }

    @objc func stop(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            self.link.stop(silent: false)
            call.resolve()
        }
    }

    @objc func send(_ call: CAPPluginCall) {
        let text = call.getString("d") ?? ""
        let reliable = call.getBool("reliable") ?? false
        DispatchQueue.main.async {
            self.link.send(text, reliable: reliable)
            call.resolve()
        }
    }
}

/// Findet das andere Gerät über WLAN oder Bluetooth (MultipeerConnectivity) und tauscht kurze Texte aus.
/// Das iPad macht sich sichtbar, das iPhone sucht und lädt ein. Es wird immer nur ein Lenkrad angenommen.
final class LenkradLink: NSObject, MCSessionDelegate, MCNearbyServiceAdvertiserDelegate, MCNearbyServiceBrowserDelegate {
    private let serviceType = "rennspiel"   // muss zu NSBonjourServices in Info.plist passen
    private let me = MCPeerID(displayName: UIDevice.current.name)
    private var session: MCSession?
    private var advertiser: MCNearbyServiceAdvertiser?
    private var browser: MCNearbyServiceBrowser?
    private var hosting = false
    private var running = false

    var onState: ((String, String) -> Void)?
    var onData: ((String) -> Void)?

    func start(asHost: Bool) {
        stop(silent: true)
        hosting = asHost
        running = true
        let newSession = MCSession(peer: me, securityIdentity: nil, encryptionPreference: .none)
        newSession.delegate = self
        session = newSession
        if asHost {
            let adv = MCNearbyServiceAdvertiser(peer: me, discoveryInfo: nil, serviceType: serviceType)
            adv.delegate = self
            adv.startAdvertisingPeer()
            advertiser = adv
        } else {
            let brw = MCNearbyServiceBrowser(peer: me, serviceType: serviceType)
            brw.delegate = self
            brw.startBrowsingForPeers()
            browser = brw
        }
        onState?("searching", "")
    }

    func stop(silent: Bool) {
        running = false
        advertiser?.stopAdvertisingPeer()
        advertiser?.delegate = nil
        advertiser = nil
        browser?.stopBrowsingForPeers()
        browser?.delegate = nil
        browser = nil
        session?.delegate = nil
        session?.disconnect()
        session = nil
        if !silent {
            onState?("off", "")
        }
    }

    func send(_ text: String, reliable: Bool) {
        guard let current = session, !current.connectedPeers.isEmpty, let data = text.data(using: .utf8) else { return }
        try? current.send(data, toPeers: current.connectedPeers, with: reliable ? .reliable : .unreliable)
    }

    // MARK: MCSessionDelegate

    func session(_ session: MCSession, peer peerID: MCPeerID, didChange state: MCSessionState) {
        DispatchQueue.main.async {
            guard self.running, session === self.session else { return }
            if state == .connected {
                self.onState?("connected", peerID.displayName)
            } else if state == .notConnected, session.connectedPeers.isEmpty {
                self.onState?("searching", "")
                if !self.hosting {
                    // neu suchen, damit das iPad wieder gefunden und eingeladen wird
                    self.browser?.stopBrowsingForPeers()
                    DispatchQueue.main.asyncAfter(deadline: .now() + 1.0) {
                        if self.running { self.browser?.startBrowsingForPeers() }
                    }
                }
            }
        }
    }

    func session(_ session: MCSession, didReceive data: Data, fromPeer peerID: MCPeerID) {
        guard let text = String(data: data, encoding: .utf8) else { return }
        DispatchQueue.main.async {
            guard self.running else { return }
            self.onData?(text)
        }
    }

    func session(_ session: MCSession, didReceive stream: InputStream, withName streamName: String, fromPeer peerID: MCPeerID) {}

    func session(_ session: MCSession, didStartReceivingResourceWithName resourceName: String, fromPeer peerID: MCPeerID, with progress: Progress) {}

    func session(_ session: MCSession, didFinishReceivingResourceWithName resourceName: String, fromPeer peerID: MCPeerID, at localURL: URL?, withError error: Error?) {}

    // MARK: MCNearbyServiceAdvertiserDelegate (iPad)

    func advertiser(_ advertiser: MCNearbyServiceAdvertiser, didReceiveInvitationFromPeer peerID: MCPeerID, withContext context: Data?, invitationHandler: @escaping (Bool, MCSession?) -> Void) {
        DispatchQueue.main.async {
            guard self.running, let current = self.session, current.connectedPeers.isEmpty else {
                invitationHandler(false, nil)
                return
            }
            invitationHandler(true, current)
        }
    }

    func advertiser(_ advertiser: MCNearbyServiceAdvertiser, didNotStartAdvertisingPeer error: Error) {
        DispatchQueue.main.async {
            self.onState?("error", error.localizedDescription)
        }
    }

    // MARK: MCNearbyServiceBrowserDelegate (iPhone)

    func browser(_ browser: MCNearbyServiceBrowser, foundPeer peerID: MCPeerID, withDiscoveryInfo info: [String: String]?) {
        DispatchQueue.main.async {
            guard self.running, let current = self.session, current.connectedPeers.isEmpty else { return }
            browser.invitePeer(peerID, to: current, withContext: nil, timeout: 15)
        }
    }

    func browser(_ browser: MCNearbyServiceBrowser, lostPeer peerID: MCPeerID) {}

    func browser(_ browser: MCNearbyServiceBrowser, didNotStartBrowsingForPeers error: Error) {
        DispatchQueue.main.async {
            self.onState?("error", error.localizedDescription)
        }
    }
}
