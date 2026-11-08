import Foundation
import CoreFoundation

enum BridgeFailure: Error {
    case code(String)
    var code: String { switch self { case .code(let value): return value } }
}

struct DirectSettings {
    var caps: [UInt8] = [0, 0]
    var frequencyBalance: UInt8 = 0
    var pulseBalance: UInt8 = 0

    init(_ values: [String: Any] = [:]) throws {
        func integer(_ key: String, _ maximum: Int) throws -> UInt8 {
            guard let number = values[key] as? NSNumber,
                  CFGetTypeID(number) != CFBooleanGetTypeID(),
                  number.doubleValue.isFinite, number.doubleValue.rounded() == number.doubleValue,
                  (0...maximum).contains(number.intValue) else { throw BridgeFailure.code("invalid-settings") }
            return UInt8(number.intValue)
        }
        if !values.isEmpty {
            caps = [try integer("capA", 200), try integer("capB", 200)]
            frequencyBalance = try integer("frequencyBalance", 255)
            pulseBalance = try integer("pulseBalance", 255)
        }
    }

    var packet: Data { Data([0xBF, caps[0], caps[1], frequencyBalance, frequencyBalance, pulseBalance, pulseBalance]) }
}

struct CoyoteFrame {
    static let zero = Data([10, 10, 10, 10, 0, 0, 0, 0])
    static func decode(_ hex: String) throws -> Data {
        let chars = Array(hex.utf8)
        guard chars.count == 16 else { throw BridgeFailure.code("invalid-frame") }
        var bytes: [UInt8] = []
        for index in stride(from: 0, to: 16, by: 2) {
            guard let byte = UInt8(String(bytes: chars[index...index + 1], encoding: .utf8) ?? "", radix: 16) else {
                throw BridgeFailure.code("invalid-frame")
            }
            bytes.append(byte)
        }
        guard bytes.prefix(4).allSatisfy({ (10...240).contains($0) }), bytes.suffix(4).allSatisfy({ $0 <= 100 }) else {
            throw BridgeFailure.code("invalid-frame")
        }
        return Data(bytes)
    }
}

/** 只保留最新帧；使用单调时钟到期归零，不依赖 WebView 是否仍在运行。 */
final class CoyoteOutput {
    struct Channel {
        var intensity: UInt8 = 0
        var intensityUntil: TimeInterval = 0
        var frame = CoyoteFrame.zero
        var frameUntil: TimeInterval = 0
    }
    private(set) var channels = [Channel(), Channel()]
    private(set) var actual: [UInt8] = [0, 0]
    private(set) var pending: (sequence: UInt8, until: TimeInterval)?
    private var sequence: UInt8 = 0
    var limits: [UInt8] = [0, 0]

    func intensity(channel: Int, value: Int, now: TimeInterval, duration: TimeInterval) throws {
        guard (0...1).contains(channel), (0...200).contains(value), duration > 0, duration <= 0.25 else { throw BridgeFailure.code("invalid-command") }
        channels[channel].intensity = min(UInt8(value), limits[channel])
        channels[channel].intensityUntil = now + duration
    }

    func pulse(channel: Int, hex: String, now: TimeInterval, duration: TimeInterval) throws {
        guard (0...1).contains(channel), duration > 0, duration <= 0.1 else { throw BridgeFailure.code("invalid-command") }
        channels[channel].frame = try CoyoteFrame.decode(hex)
        channels[channel].frameUntil = now + duration
    }

    func clear(_ channel: Int? = nil) {
        if let channel { channels[channel] = Channel() }
        else { channels = [Channel(), Channel()] }
    }

    func acknowledge(_ data: Data) -> Bool {
        guard data.count == 4, data[0] == 0xB1, data[1] <= 15, data[2] <= 200, data[3] <= 200 else { return false }
        // 旧序号的迟到确认不能覆盖新一轮归零结果；序号 0 是设备拨轮的主动通知。
        guard data[1] == 0 || data[1] == pending?.sequence else { return false }
        actual = [data[2], data[3]]
        if data[1] == pending?.sequence { pending = nil; return true }
        return false
    }

    func packet(now: TimeInterval, forceZero: Bool = false) throws -> Data {
        if !forceZero, let pending, now > pending.until { throw BridgeFailure.code("device-ack-timeout") }
        var desired: [UInt8] = []
        var frames: [Data] = []
        for (index, channel) in channels.enumerated() {
            let active = !forceZero && now < channel.frameUntil && now < channel.intensityUntil
            desired.append(active ? min(channel.intensity, limits[index]) : 0)
            frames.append(active ? channel.frame : CoyoteFrame.zero)
            // 定时器有抖动，帧只能消费一次，不能因下一次 tick 提前而重播。
            channels[index].frameUntil = 0
        }
        var control: UInt8 = 0
        if forceZero || (pending == nil && desired != actual) {
            sequence = sequence % 15 + 1
            pending = (sequence, now + 0.5)
            control = sequence << 4 | 0x0F
        }
        // 等待 B1 时只更新波形，避免并行改强度；归零指令可以立即覆盖尚未确认的输出。
        return Data([0xB0, control, desired[0], desired[1]]) + frames[0] + frames[1]
    }
}
