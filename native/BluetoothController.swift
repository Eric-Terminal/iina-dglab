import Foundation
import CoreBluetooth

final class BluetoothController: NSObject, CBCentralManagerDelegate, CBPeripheralDelegate {
    private var central: CBCentralManager?
    private var found: [UUID: (CBPeripheral, Int)] = [:]
    private var peripheral: CBPeripheral?
    private var writeCharacteristic: CBCharacteristic?
    private var notifyCharacteristic: CBCharacteristic?
    private var writes: [(Data, (() -> Void)?)] = []
    private var writeCompletion: (() -> Void)?
    private var writingAt: TimeInterval?
    private var output = CoyoteOutput()
    private var settings = try! DirectSettings()
    private var timer: DispatchSourceTimer?
    private var connectDeadline: TimeInterval?
    private var scanDeadline: TimeInterval?
    private var initializing = false
    private var failing = false
    private var battery: Int?
    private var state = "idle"
    private var errorCode: String?
    private let serviceID = CBUUID(string: "180C")
    private let writeID = CBUUID(string: "150A")
    private let notifyID = CBUUID(string: "150B")
    private var now: TimeInterval { ProcessInfo.processInfo.systemUptime }

    override init() {
        super.init()
        let timer = DispatchSource.makeTimerSource(queue: .main)
        timer.schedule(deadline: .now(), repeating: .milliseconds(100), leeway: .milliseconds(5))
        timer.setEventHandler { [weak self] in self?.tick() }
        timer.resume(); self.timer = timer
    }

    func status() -> [String: Any] {
        let devices: [[String: Any]] = found.values.map { item in
            ["id": item.0.identifier.uuidString, "name": "Coyote 3.0", "rssi": item.1]
        }.sorted { ($0["rssi"] as! Int) > ($1["rssi"] as! Int) }
        return ["state": state, "error": errorCode as Any? ?? NSNull(), "devices": devices,
                "deviceId": peripheral?.identifier.uuidString as Any? ?? NSNull(), "battery": battery as Any? ?? NSNull(),
                "intensityA": Int(output.actual[0]), "intensityB": Int(output.actual[1]),
                "capA": Int(settings.caps[0]), "capB": Int(settings.caps[1])]
    }

    func request(_ method: String, _ params: [String: Any]) throws -> [String: Any] {
        switch method {
        case "status": return status()
        case "scan":
            guard peripheral == nil else { throw BridgeFailure.code("already-connected") }
            errorCode = nil; failing = false; found.removeAll(); state = "scanning"; scanDeadline = now + 15
            if central == nil { central = CBCentralManager(delegate: self, queue: .main) }
            else { centralManagerDidUpdateState(central!) }
        case "connect":
            guard let id = params["id"] as? String, let uuid = UUID(uuidString: id), let item = found[uuid] else { throw BridgeFailure.code("device-not-found") }
            guard peripheral == nil, central?.state == .poweredOn else { throw BridgeFailure.code("bluetooth-unavailable") }
            errorCode = nil; failing = false; state = "connecting"; scanDeadline = nil
            peripheral = item.0; peripheral?.delegate = self
            central?.stopScan(); connectDeadline = now + 12
            central?.connect(item.0)
        case "configure":
            let next = try DirectSettings(params)
            settings = next; output.limits = next.caps
            if state == "ready" {
                output.clear()
                enqueue(try output.packet(now: now, forceZero: true))
                enqueue(settings.packet)
            }
        case "intensity", "pulse", "clear":
            guard state == "ready" else { throw BridgeFailure.code("device-not-ready") }
            let channel = try integer(params, "channel", 1)
            if method == "intensity" {
                try output.intensity(channel: channel, value: integer(params, "value", 200), now: now,
                                     duration: Double(integer(params, "duration", 250)) / 1000)
            } else if method == "pulse" {
                guard let hex = params["frame"] as? String else { throw BridgeFailure.code("invalid-frame") }
                try output.pulse(channel: channel, hex: hex, now: now, duration: Double(integer(params, "duration", 100)) / 1000)
            } else {
                output.clear(channel)
                // 停止不等待下一次 tick；先撤掉波形，再写绝对零强度。
                if output.channels.allSatisfy({ $0.intensity == 0 }) { enqueue(try output.packet(now: now, forceZero: true)) }
            }
        case "disconnect": disconnect()
        default: throw BridgeFailure.code("unknown-method")
        }
        return status()
    }

    private func integer(_ params: [String: Any], _ key: String, _ maximum: Int) throws -> Int {
        guard let value = params[key] as? NSNumber, CFGetTypeID(value) != CFBooleanGetTypeID(),
              value.doubleValue.isFinite, value.doubleValue == value.doubleValue.rounded(),
              (0...maximum).contains(value.intValue) else { throw BridgeFailure.code("invalid-command") }
        return value.intValue
    }

    func disconnect() {
        central?.stopScan(); scanDeadline = nil; connectDeadline = nil; output.clear()
        if let peripheral {
            writes.removeAll()
            if writeCharacteristic != nil { enqueue(try! output.packet(now: now, forceZero: true)) }
            DispatchQueue.main.asyncAfter(deadline: .now() + .milliseconds(200)) { [weak self] in self?.central?.cancelPeripheralConnection(peripheral) }
        } else { if errorCode == nil { state = "idle" }; return }
        if errorCode == nil { state = "disconnecting" }
    }

    private func fail(_ code: String) {
        guard !failing else { return }
        failing = true; errorCode = code; state = "error"; disconnect()
    }

    func centralManagerDidUpdateState(_ central: CBCentralManager) {
        switch central.state {
        case .poweredOn:
            if state == "scanning" {
                // 设备可能不广播服务列表，因此按官方型号广播名称筛选。
                central.scanForPeripherals(withServices: nil, options: [CBCentralManagerScanOptionAllowDuplicatesKey: true])
            }
        case .unauthorized: fail("bluetooth-denied")
        case .poweredOff: fail("bluetooth-off")
        case .unsupported: fail("bluetooth-unsupported")
        case .resetting: if peripheral != nil { fail("bluetooth-reset") }
        case .unknown: break
        @unknown default: fail("bluetooth-unavailable")
        }
    }

    func centralManager(_ central: CBCentralManager, didDiscover peripheral: CBPeripheral, advertisementData: [String: Any], rssi RSSI: NSNumber) {
        let name = advertisementData[CBAdvertisementDataLocalNameKey] as? String ?? peripheral.name
        guard name == "47L121000" else { return }
        found[peripheral.identifier] = (peripheral, RSSI.intValue)
    }

    func centralManager(_ central: CBCentralManager, didConnect peripheral: CBPeripheral) {
        guard peripheral == self.peripheral, state == "connecting", !failing else { return }
        peripheral.discoverServices([serviceID, CBUUID(string: "180A")])
    }
    func centralManager(_ central: CBCentralManager, didFailToConnect peripheral: CBPeripheral, error: Error?) {
        guard peripheral == self.peripheral, !failing else { return }
        fail("device-connect-failed")
    }
    func centralManager(_ central: CBCentralManager, didDisconnectPeripheral peripheral: CBPeripheral, error: Error?) {
        guard peripheral == self.peripheral else { return }
        self.peripheral = nil; writeCharacteristic = nil; notifyCharacteristic = nil
        writes.removeAll(); writingAt = nil; writeCompletion = nil; initializing = false; connectDeadline = nil
        output = CoyoteOutput(); output.limits = settings.caps; battery = nil
        if errorCode == nil { state = "disconnected" }
    }

    func peripheral(_ peripheral: CBPeripheral, didDiscoverServices error: Error?) {
        guard peripheral == self.peripheral, state == "connecting", !failing else { return }
        guard error == nil, let services = peripheral.services, services.contains(where: { $0.uuid == serviceID }) else { fail("device-incompatible"); return }
        for service in services {
            peripheral.discoverCharacteristics(service.uuid == serviceID ? [writeID, notifyID] : [CBUUID(string: "1500")], for: service)
        }
    }

    func peripheral(_ peripheral: CBPeripheral, didDiscoverCharacteristicsFor service: CBService, error: Error?) {
        guard peripheral == self.peripheral, state == "connecting", !failing else { return }
        if service.uuid == serviceID {
            guard error == nil,
                  let write = service.characteristics?.first(where: { $0.uuid == writeID }),
                  let notify = service.characteristics?.first(where: { $0.uuid == notifyID }),
                  (write.properties.contains(.write) || write.properties.contains(.writeWithoutResponse)), notify.properties.contains(.notify)
            else { fail("device-incompatible"); return }
            writeCharacteristic = write; notifyCharacteristic = notify
            peripheral.setNotifyValue(true, for: notify)
        } else if let battery = service.characteristics?.first(where: { $0.uuid == CBUUID(string: "1500") }) {
            if battery.properties.contains(.read) { peripheral.readValue(for: battery) }
            if battery.properties.contains(.notify) { peripheral.setNotifyValue(true, for: battery) }
        }
    }

    func peripheral(_ peripheral: CBPeripheral, didUpdateNotificationStateFor characteristic: CBCharacteristic, error: Error?) {
        guard peripheral == self.peripheral, state == "connecting", !failing, !initializing else { return }
        guard characteristic.uuid == notifyID else { return }
        guard error == nil, characteristic.isNotifying else { fail("device-notify-failed"); return }
        // 连接时先将硬件软上限设为零，确认 B1 归零后才开放用户设置的上限。
        initializing = true; output = CoyoteOutput()
        enqueue(try! DirectSettings().packet)
        enqueue(try! output.packet(now: now, forceZero: true))
    }

    func peripheral(_ peripheral: CBPeripheral, didUpdateValueFor characteristic: CBCharacteristic, error: Error?) {
        guard peripheral == self.peripheral, !failing, state == "connecting" || state == "ready" else { return }
        guard error == nil, let data = characteristic.value else { return }
        if characteristic.uuid == notifyID {
            let acknowledged = output.acknowledge(data)
            if initializing && acknowledged {
                guard output.actual == [0, 0] else { fail("device-zero-failed"); return }
                initializing = false
                enqueue(settings.packet) { [weak self] in
                    guard let self, !self.failing, self.state == "connecting" else { return }
                    self.output.limits = self.settings.caps; self.connectDeadline = nil; self.state = "ready"
                }
            }
        } else if characteristic.uuid == CBUUID(string: "1500"), data.count == 1, data[0] <= 100 { battery = Int(data[0]) }
    }

    private func enqueue(_ data: Data, completion: (() -> Void)? = nil) {
        guard writes.count < 12 else { fail("device-write-overflow"); return }
        writes.append((data, completion)); drain()
    }

    private func drain() {
        guard writingAt == nil, !writes.isEmpty, let peripheral, let characteristic = writeCharacteristic else { return }
        if characteristic.properties.contains(.write) {
            let item = writes.removeFirst(); writingAt = now; writeCompletion = item.1
            peripheral.writeValue(item.0, for: characteristic, type: .withResponse)
        } else if peripheral.canSendWriteWithoutResponse {
            let item = writes.removeFirst(); peripheral.writeValue(item.0, for: characteristic, type: .withoutResponse)
            item.1?(); drain()
        }
    }

    func peripheral(_ peripheral: CBPeripheral, didWriteValueFor characteristic: CBCharacteristic, error: Error?) {
        guard peripheral == self.peripheral, characteristic.uuid == writeID else { return }
        writingAt = nil
        let callback = writeCompletion; writeCompletion = nil
        if error != nil { fail("device-write-failed"); return }
        callback?(); drain()
    }
    func peripheralIsReady(toSendWriteWithoutResponse peripheral: CBPeripheral) { drain() }

    private func tick() {
        if let deadline = scanDeadline, now >= deadline { central?.stopScan(); scanDeadline = nil; if state == "scanning" { state = "scanned" } }
        if let deadline = connectDeadline, now >= deadline { fail("device-connect-timeout"); return }
        if let writingAt, now - writingAt > 0.5 { fail("device-write-timeout"); return }
        guard state == "ready", writingAt == nil, writes.isEmpty else { drain(); return }
        do { enqueue(try output.packet(now: now)) }
        catch let error as BridgeFailure { fail(error.code) }
        catch { fail("device-write-failed") }
    }
}
