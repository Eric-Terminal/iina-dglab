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
        try verify("重复归零保留原确认序号，已确认的零强度不再等待无变化回包") {
            let output = CoyoteOutput()
            let first = try output.packet(now: 1, forceZero: true)
            let again = try output.packet(now: 1.01, forceZero: true)
            check(again[1] == 0 && output.pending?.sequence == first[1] >> 4, "重复归零覆盖了待确认序号")
            check(output.acknowledge(Data([0xB1, first[1] >> 4, 0, 0])), "首次归零确认被当成了过期消息")
            check(try output.packet(now: 1.1, forceZero: true)[1] == 0 && output.pending == nil, "已归零仍创建了确认等待")
            _ = try output.packet(now: 20)
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
            let gap = try output.packet(now: 1.11)
            check(Array(gap.prefix(4)) == [0xB0, 0, 12, 8], "缺一帧不应反复修改通道强度")
            check(gap.subdata(in: 4..<12) == CoyoteFrame.zero, "过期帧被重播")
            let expired = try output.packet(now: 1.26)
            check(Array(expired.prefix(4)) == [0xB0, 0x2F, 0, 0], "波形过期后没有归零")
            check(expired.subdata(in: 4..<12) == CoyoteFrame.zero, "过期帧被重播")
            check(!output.acknowledge(Data([0xB1, 1, 12, 8])) && output.pending?.sequence == 2, "迟到确认覆盖了归零请求")
            check(output.acknowledge(Data([0xB1, 2, 0, 0])), "归零未获确认")
        }
        try verify("一次确认延迟先重同步，连续三次未确认才停止，仍允许强制归零") {
            let output = CoyoteOutput(); _ = try output.packet(now: 1, forceZero: true)
            check(try output.packet(now: 1.8)[1] == 0, "800 ms 延迟不应中断连接或更换序号")
            check(try output.packet(now: 2.1)[1] == 0x2F, "首次未确认应尝试重同步")
            check(try output.packet(now: 3.2)[1] == 0x3F, "第二次未确认应再次重同步")
            rejects { _ = try output.packet(now: 4.3) }
            let zero = try output.packet(now: 4.3, forceZero: true)
            check(zero[2] == 0 && zero[3] == 0 && zero.subdata(in: 4..<12) == CoyoteFrame.zero, "强制归零无效")
        }
        try verify("播放中确认迟到不终止输出，缺一帧不触发强度来回归零") {
            let output = CoyoteOutput(); output.limits = [12, 8]
            for step in 0..<9 {
                let now = 1 + Double(step) / 10
                for channel in 0...1 {
                    try output.intensity(channel: channel, value: 100, now: now, duration: 0.25)
                    if step != 3 { try output.pulse(channel: channel, hex: "323232322A333C36", now: now, duration: 0.1) }
                }
                let packet = try output.packet(now: now)
                check(packet[1] == (step == 0 ? 0x1F : 0), "确认延迟期间反复改了强度")
                check(packet[2] == 12 && packet[3] == 8, "采样缺帧不应归零通道强度")
                check(packet.subdata(in: 4..<12) == (step == 3 ? CoyoteFrame.zero : try CoyoteFrame.decode("323232322A333C36")), "未正确丢弃缺失帧")
            }
            check(output.acknowledge(Data([0xB1, 1, 12, 8])), "迟到确认应恢复同步")
            check(output.pending == nil, "确认状态未清理")
        }
        try verify("丢失回包时只重同步当前绝对强度，迟到的等值确认仍有效") {
            let output = CoyoteOutput(); output.limits = [12, 8]
            try output.intensity(channel: 0, value: 12, now: 1, duration: 0.25)
            try output.pulse(channel: 0, hex: "0A0A0A0A64646464", now: 1, duration: 0.1)
            _ = try output.packet(now: 1)
            try output.intensity(channel: 0, value: 12, now: 2, duration: 0.25)
            let retry = try output.packet(now: 2)
            check(Array(retry.prefix(4)) == [0xB0, 0x2F, 12, 0], "重试必须使用绝对值，不能累计加量")
            check(retry.subdata(in: 4..<12) == CoyoteFrame.zero, "重试补发了旧波形")
            check(output.acknowledge(Data([0xB1, 1, 12, 0])), "目标相同的迟到确认不应丢弃")
            check(output.pending == nil, "重同步没有完成")
        }
        try verify("等待确认时到期或降低上限立即生效，旧回包不能恢复较高强度") {
            let output = CoyoteOutput(); output.limits = [12, 8]
            for channel in 0...1 { try output.intensity(channel: channel, value: 100, now: 1, duration: 0.25) }
            _ = try output.packet(now: 1)
            output.limits = [4, 6]
            let lower = try output.packet(now: 1.1)
            check(Array(lower.prefix(4)) == [0xB0, 0x2F, 4, 6], "降低上限被等待确认阻塞")
            check(!output.acknowledge(Data([0xB1, 1, 12, 8])), "旧回包覆盖了新上限")
            let expired = try output.packet(now: 1.3)
            check(Array(expired.prefix(4)) == [0xB0, 0x3F, 0, 0], "强度过期时没有立即归零")
            check(output.acknowledge(Data([0xB1, 0, 0, 0])), "设备主动报告相同状态也应结束等待")
            check(try output.packet(now: 3)[1] == 0, "过期强度被重发")
        }
        try verify("模拟只在强度变化时通知的设备，连续播放与双通道重复停止不误超时") {
            let output = CoyoteOutput(); output.limits = [12, 8]
            _ = try output.packet(now: 0, forceZero: true)
            _ = output.acknowledge(Data([0xB1, 1, 0, 0]))
            var device: [UInt8] = [0, 0]
            for step in 1...600 {
                let now = Double(step) / 10
                if step % 30 < 20 {
                    for channel in 0...1 {
                        try output.intensity(channel: channel, value: 100, now: now, duration: 0.25)
                        try output.pulse(channel: channel, hex: "323232322A333C36", now: now, duration: 0.1)
                    }
                } else { output.clear() }
                for _ in 0..<(step % 30 < 20 ? 1 : 2) {
                    let packet = try output.packet(now: now, forceZero: step % 30 >= 20)
                    if packet[1] & 0x0F == 0x0F {
                        let next = [packet[2], packet[3]]
                        if next != device {
                            device = next
                            _ = output.acknowledge(Data([0xB1, packet[1] >> 4, device[0], device[1]]))
                        }
                    }
                    check(output.pending == nil, "无变化的强度写入仍要求设备回包")
                }
            }
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
