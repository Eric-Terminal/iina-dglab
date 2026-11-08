import AppKit
import Foundation

let args = CommandLine.arguments
guard let handshakeIndex = args.firstIndex(of: "--handshake"), handshakeIndex + 1 < args.count else { exit(2) }
let handshake = URL(fileURLWithPath: args[handshakeIndex + 1])
let application = NSApplication.shared
application.setActivationPolicy(.accessory)
let bluetooth = BluetoothController()
var lastLease = ProcessInfo.processInfo.systemUptime
var closing = false
var server: HTTPServer!

func shutdown() {
    guard !closing else { return }
    closing = true; bluetooth.disconnect()
    // 给归零写入留出时间；助手内的波形缓存早于租约过期，断开前不会补发旧帧。
    DispatchQueue.main.asyncAfter(deadline: .now() + .milliseconds(500)) {
        server?.close()
        try? FileManager.default.removeItem(at: handshake)
        application.terminate(nil)
    }
}

do {
    server = try HTTPServer { method, params in
        if closing { throw BridgeFailure.code("helper-stopping") }
        switch method {
        case "lease": lastLease = ProcessInfo.processInfo.systemUptime; return [:]
        case "shutdown": shutdown(); return [:]
        default: return try bluetooth.request(method, params)
        }
    }
    server.onReady = { url in
        do {
            let data = try JSONSerialization.data(withJSONObject: ["url": url])
            try data.write(to: handshake, options: .atomic)
            try FileManager.default.setAttributes([.posixPermissions: 0o600], ofItemAtPath: handshake.path)
        } catch { shutdown() }
    }
    server.onFailure = { shutdown() }
    server.start()
    let lease = Timer.scheduledTimer(withTimeInterval: 1, repeats: true) { _ in
        if ProcessInfo.processInfo.systemUptime - lastLease > 8 { shutdown() }
    }
    RunLoop.main.add(lease, forMode: .common)
    application.run()
} catch {
    let data = try? JSONSerialization.data(withJSONObject: ["error": "helper-start-failed"])
    try? data?.write(to: handshake, options: .atomic)
    exit(1)
}
