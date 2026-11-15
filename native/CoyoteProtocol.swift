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
    struct Confirmation {
        let sequence: UInt8
        let values: [UInt8]
        let until: TimeInterval
        let attempts: Int
    }
    private(set) var channels = [Channel(), Channel()]
    private(set) var actual: [UInt8] = [0, 0]
    private(set) var pending: Confirmation?
    private var hasStatus = false
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
        let values = [data[2], data[3]]
        // 绝对值重同步后，迟到回包若与当前目标相同，也能证明已同步。
        // 不匹配的旧强度不能覆盖归零结果；序号 0 仍用于接收设备拨轮状态。
        let confirmed = pending.map { data[1] == $0.sequence || values == $0.values } ?? false
        guard data[1] == 0 || confirmed else { return false }
        actual = values; hasStatus = true
        if confirmed { pending = nil; return true }
        return false
    }

    func packet(now: TimeInterval, forceZero: Bool = false) throws -> Data {
        var desired: [UInt8] = []
        var frames: [Data] = []
        for (index, channel) in channels.enumerated() {
            // 通道强度有独立的 250 ms 有效期；缺一帧只清波形，避免两个
            // 100 ms 定时器的相位差让强度在零与上限之间来回切换。
            let intensity = !forceZero && now < channel.intensityUntil ? min(channel.intensity, limits[index]) : 0
            desired.append(intensity)
            frames.append(intensity > 0 && now < channel.frameUntil ? channel.frame : CoyoteFrame.zero)
            // 定时器有抖动，帧只能消费一次，不能因下一次 tick 提前而重播。
            channels[index].frameUntil = 0
        }
        var control: UInt8 = 0
        var change: [UInt8]?
        var attempts = 1
        if let pending {
            let reduced = zip(desired, pending.values).map { min($0.0, $0.1) }
            if reduced != pending.values {
                // 停止、到期或降低上限可以立即降强度；其他通道不会趁机升高。
                change = reduced
            } else if now >= pending.until {
                if pending.attempts >= 3 && !forceZero { throw BridgeFailure.code("device-ack-timeout") }
                // 重发当前绝对目标，不能累计加量，也不能恢复已过期的旧强度或波形。
                change = desired; attempts = pending.attempts + 1
            }
        } else if desired != actual || (forceZero && !hasStatus) {
            change = desired
        }
        if let change {
            sequence = sequence % 15 + 1
            pending = Confirmation(sequence: sequence, values: change, until: now + 1, attempts: attempts)
            control = sequence << 4 | 0x0F
            desired = change
        }
        // 重复清零不更换待确认序号；常规等待期间仅发送新的波形。
        return Data([0xB0, control, desired[0], desired[1]]) + frames[0] + frames[1]
    }
}
