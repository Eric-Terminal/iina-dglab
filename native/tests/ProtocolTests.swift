import Foundation

@main struct ProtocolTests {
    static func main() throws {
        var count = 0
        func verify(_ name: String, _ body: () throws -> Void) throws { try body(); count += 1; print("通过：\(name)") }
        func check(_ value: Bool, _ message: String) { if !value { fatalError(message) } }
        func rejects(_ body: () throws -> Void) { do { try body(); fatalError("预期拒绝无效输入") } catch {} }

        try verify("初始硬件软上限为零，双通道校准位置遵守 BF 协议") {
            check(try DirectSettings().packet == Data([0xBF, 0, 0, 0, 0, 0, 0]), "初始软上限错误")
            let config = try DirectSettings(["capA": 12, "capB": 24, "frequencyBalance": 10, "pulseBalance": 20])
            check(config.packet == Data([0xBF, 12, 24, 10, 10, 20, 20]), "BF 参数位置错误")
        }
        try verify("配置和波形在协议边界拒绝越界、缺失与非法数值") {
            rejects { _ = try DirectSettings(["capA": true, "capB": 20, "frequencyBalance": 0, "pulseBalance": 0]) }
            rejects { _ = try DirectSettings(["capA": 201, "capB": 20, "frequencyBalance": 0, "pulseBalance": 0]) }
            for hex in ["", "GG0A0A0A00000000", "090A0A0A00000000", "0A0A0A0A00000065", "F10A0A0A00000000"] {
                rejects { _ = try CoyoteFrame.decode(hex) }
            }
        }
        try verify("B0 双通道封包、限幅与 B1 序号确认") {
            let output = CoyoteOutput(); output.limits = [12, 8]
            for channel in 0...1 {
                try output.intensity(channel: channel, value: 100, now: 1, duration: 0.25)
                try output.pulse(channel: channel, hex: "323232322A333C36", now: 1, duration: 0.1)
            }
            let packet = try output.packet(now: 1.01)
            check(packet.count == 20 && Array(packet.prefix(4)) == [0xB0, 0x1F, 12, 8], "强度编码或限幅错误")
            check(packet.subdata(in: 4..<12) == packet.subdata(in: 12..<20), "两通道波形不一致")
            let next = try output.packet(now: 1.02)
            check(next[1] == 0, "未收到 B1 时不能重复改强度")
            check(next.subdata(in: 4..<12) == CoyoteFrame.zero, "定时器抖动不应重播同一帧")
            check(output.acknowledge(Data([0xB1, 1, 12, 8])), "未识别匹配的确认")
            let expired = try output.packet(now: 1.11)
            check(Array(expired.prefix(4)) == [0xB0, 0x2F, 0, 0], "波形过期后没有归零")
            check(expired.subdata(in: 4..<12) == CoyoteFrame.zero, "过期帧被重播")
            check(!output.acknowledge(Data([0xB1, 1, 12, 8])) && output.pending?.sequence == 2, "迟到确认覆盖了归零请求")
            check(output.acknowledge(Data([0xB1, 2, 0, 0])), "归零未获确认")
        }
        try verify("确认超时后禁止正常输出，但仍可发送强制归零") {
            let output = CoyoteOutput(); _ = try output.packet(now: 1, forceZero: true)
            rejects { _ = try output.packet(now: 1.6) }
            let zero = try output.packet(now: 1.6, forceZero: true)
            check(zero[2] == 0 && zero[3] == 0 && zero.subdata(in: 4..<12) == CoyoteFrame.zero, "强制归零无效")
        }
        try verify("强度到期、清除通道和硬件拨轮通知不突破软件上限") {
            let output = CoyoteOutput(); output.limits = [9, 0]
            try output.intensity(channel: 0, value: 200, now: 1, duration: 0.05)
            try output.pulse(channel: 0, hex: "0A0A0A0A64646464", now: 1, duration: 0.1)
            check(try output.packet(now: 1.06)[2] == 0, "强度到期未归零")
            check(!output.acknowledge(Data([0xB1, 0, 50, 0])), "拨轮通知不应确认待处理序号")
            output.clear()
            let packet = try output.packet(now: 2)
            check(packet[2] == 0 && packet.subdata(in: 4..<12) == CoyoteFrame.zero, "清除后仍有输出")
        }
        print("原生协议测试全部通过：\(count) 项；未访问蓝牙硬件。")
    }
}
