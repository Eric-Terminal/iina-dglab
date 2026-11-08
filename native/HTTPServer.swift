import Foundation
import Network
import Security

/** 仅供 IINA 原生 HTTP 调用；随机回环端口与会话令牌不向局域网开放。 */
final class HTTPServer {
    private let listener: NWListener
    private let token: String
    private let request: (String, [String: Any]) throws -> [String: Any]
    private var connections: [ObjectIdentifier: NWConnection] = [:]
    var onReady: ((String) -> Void)?
    var onFailure: (() -> Void)?

    init(request: @escaping (String, [String: Any]) throws -> [String: Any]) throws {
        self.request = request
        var bytes = [UInt8](repeating: 0, count: 32)
        guard SecRandomCopyBytes(kSecRandomDefault, bytes.count, &bytes) == errSecSuccess else { throw BridgeFailure.code("random-failed") }
        token = bytes.map { String(format: "%02x", $0) }.joined()
        let parameters = NWParameters.tcp
        parameters.requiredLocalEndpoint = .hostPort(host: .ipv4(.loopback), port: .any)
        listener = try NWListener(using: parameters)
    }

    func start() {
        listener.stateUpdateHandler = { [weak self] state in
            guard let self else { return }
            if case .ready = state, let port = self.listener.port {
                self.onReady?("http://127.0.0.1:\(port.rawValue)/\(self.token)")
            } else if case .failed = state { self.onFailure?() }
        }
        listener.newConnectionHandler = { [weak self] connection in
            guard let self, self.connections.count < 32 else { connection.cancel(); return }
            self.connections[ObjectIdentifier(connection)] = connection
            connection.stateUpdateHandler = { [weak self, weak connection] state in
                guard let self, let connection else { return }
                if case .cancelled = state { self.connections.removeValue(forKey: ObjectIdentifier(connection)) }
                if case .failed = state { connection.cancel() }
            }
            connection.start(queue: .main)
            self.receive(connection, Data())
            DispatchQueue.main.asyncAfter(deadline: .now() + 5) { [weak connection] in connection?.cancel() }
        }
        listener.start(queue: .main)
    }

    func close() { listener.cancel(); for connection in connections.values { connection.cancel() } }

    private func receive(_ connection: NWConnection, _ accumulated: Data) {
        connection.receive(minimumIncompleteLength: 1, maximumLength: 16384) { [weak self] data, _, complete, error in
            guard let self else { connection.cancel(); return }
            let buffer = accumulated + (data ?? Data())
            guard buffer.count <= 32768 else { self.respond(connection, status: 413, body: [:]); return }
            guard let separator = buffer.range(of: Data("\r\n\r\n".utf8)) else {
                if complete || error != nil { connection.cancel() } else { self.receive(connection, buffer) }
                return
            }
            guard let head = String(data: buffer[..<separator.lowerBound], encoding: .utf8) else { connection.cancel(); return }
            let lines = head.components(separatedBy: "\r\n")
            let first = lines[0].split(separator: " ")
            var headers: [String: String] = [:]
            for line in lines.dropFirst() {
                guard let colon = line.firstIndex(of: ":") else { continue }
                headers[line[..<colon].lowercased()] = line[line.index(after: colon)...].trimmingCharacters(in: .whitespaces)
            }
            guard first.count == 3, first[0] == "POST", first[1] == "/\(self.token)", headers["origin"] == nil else {
                self.respond(connection, status: 403, body: [:]); return
            }
            guard let length = Int(headers["content-length"] ?? ""), (1...16384).contains(length), headers["transfer-encoding"] == nil else {
                self.respond(connection, status: 400, body: [:]); return
            }
            let body = buffer[separator.upperBound...]
            guard body.count >= length else {
                if complete || error != nil { connection.cancel() } else { self.receive(connection, buffer) }
                return
            }
            do {
                guard let json = try JSONSerialization.jsonObject(with: Data(body.prefix(length))) as? [String: Any],
                      let method = json["method"] as? String, let params = json["params"] as? [String: Any] else { throw BridgeFailure.code("invalid-command") }
                self.respond(connection, status: 200, body: ["result": try self.request(method, params)])
            } catch let failure as BridgeFailure {
                self.respond(connection, status: 200, body: ["error": failure.code])
            } catch { self.respond(connection, status: 200, body: ["error": "invalid-command"]) }
        }
    }

    private func respond(_ connection: NWConnection, status: Int, body: [String: Any]) {
        let json = (try? JSONSerialization.data(withJSONObject: body)) ?? Data("{}".utf8)
        let header = "HTTP/1.1 \(status) Response\r\nContent-Type: application/json\r\nContent-Length: \(json.count)\r\nConnection: close\r\nCache-Control: no-store\r\n\r\n"
        connection.send(content: Data(header.utf8) + json, completion: .contentProcessed { _ in connection.cancel() })
    }
}
