import ExpoModulesCore
import Security

private let keyTag = "com.ledgerwallet.devicesigner.key".data(using: .utf8)!

enum DeviceSignerError: Error, LocalizedError {
  case accessControlFailed
  case keyGenerationFailed(String)
  case keyNotFound
  case publicKeyUnavailable
  case invalidPayload
  case signingFailed(String)

  var errorDescription: String? {
    switch self {
    case .accessControlFailed: return "Could not create a biometric access control policy."
    case .keyGenerationFailed(let reason): return "Key generation failed: \(reason)"
    case .keyNotFound: return "No device signing key exists yet."
    case .publicKeyUnavailable: return "Could not read the public key."
    case .invalidPayload: return "Payload must be a UTF-8 string."
    case .signingFailed(let reason): return "Signing failed: \(reason)"
    }
  }
}

public class DeviceSignerModule: Module {
  public func definition() -> ModuleDefinition {
    Name("DeviceSigner")

    AsyncFunction("getOrCreatePublicKey") { () throws -> String in
      let key = try Self.getOrCreatePrivateKey()
      return try Self.publicKeyBase64(for: key)
    }

    AsyncFunction("sign") { (payload: String) throws -> String in
      let key = try Self.getOrCreatePrivateKey()
      return try Self.sign(payload: payload, with: key)
    }

    AsyncFunction("isHardwareBacked") { () -> Bool in
      Self.secureEnclaveAvailable
    }
  }

  // Cached so repeat calls in the same process don't retry Secure Enclave
  // creation if it already fell back to a software key this run.
  private static var secureEnclaveAvailable = true

  private static func loadKey() throws -> SecKey {
    let query: [String: Any] = [
      kSecClass as String: kSecClassKey,
      kSecAttrApplicationTag as String: keyTag,
      kSecAttrKeyType as String: kSecAttrKeyTypeECSECPrimeRandom,
      kSecReturnRef as String: true,
    ]
    var item: CFTypeRef?
    let status = SecItemCopyMatching(query as CFDictionary, &item)
    guard status == errSecSuccess, let key = item else {
      throw DeviceSignerError.keyNotFound
    }
    // swiftlint:disable:next force_cast
    return (key as! SecKey)
  }

  private static func makeAccessControl() throws -> SecAccessControl {
    var error: Unmanaged<CFError>?
    guard
      let access = SecAccessControlCreateWithFlags(
        nil,
        kSecAttrAccessibleWhenPasscodeSetThisDeviceOnly,
        [.privateKeyUsage, .biometryCurrentSet],
        &error
      )
    else {
      throw DeviceSignerError.accessControlFailed
    }
    return access
  }

  /// Tries to create a Secure Enclave-backed key first. Real devices and
  /// modern simulators support this, but some CI/simulator combinations
  /// reject kSecAttrTokenIDSecureEnclave. In that case we fall back to a
  /// software-backed EC key with the same biometric access-control gate so
  /// the signing flow still works end to end, just without hardware backing.
  private static func createKey() throws -> SecKey {
    let access = try makeAccessControl()

    var secureEnclaveAttrs: [String: Any] = [
      kSecAttrKeyType as String: kSecAttrKeyTypeECSECPrimeRandom,
      kSecAttrKeySizeInBits as String: 256,
      kSecAttrTokenID as String: kSecAttrTokenIDSecureEnclave,
      kSecPrivateKeyAttrs as String: [
        kSecAttrIsPermanent as String: true,
        kSecAttrApplicationTag as String: keyTag,
        kSecAttrAccessControl as String: access,
      ],
    ]

    var cfError: Unmanaged<CFError>?
    if let key = SecKeyCreateRandomKey(secureEnclaveAttrs as CFDictionary, &cfError) {
      return key
    }

    secureEnclaveAvailable = false
    secureEnclaveAttrs.removeValue(forKey: kSecAttrTokenID as String)
    cfError = nil
    guard let softwareKey = SecKeyCreateRandomKey(secureEnclaveAttrs as CFDictionary, &cfError) else {
      let reason = cfError.map { CFErrorCopyDescription($0.takeRetainedValue()) as String } ?? "unknown"
      throw DeviceSignerError.keyGenerationFailed(reason)
    }
    return softwareKey
  }

  private static func getOrCreatePrivateKey() throws -> SecKey {
    if let existing = try? loadKey() {
      return existing
    }
    return try createKey()
  }

  private static func publicKeyBase64(for privateKey: SecKey) throws -> String {
    guard let publicKey = SecKeyCopyPublicKey(privateKey) else {
      throw DeviceSignerError.publicKeyUnavailable
    }
    var error: Unmanaged<CFError>?
    guard let data = SecKeyCopyExternalRepresentation(publicKey, &error) as Data? else {
      throw DeviceSignerError.publicKeyUnavailable
    }
    return data.base64EncodedString()
  }

  /// Triggers the system Face ID / Touch ID prompt automatically: the key's
  /// access control (.biometryCurrentSet) makes the Security framework
  /// present it the moment SecKeyCreateSignature touches this key.
  private static func sign(payload: String, with privateKey: SecKey) throws -> String {
    guard let data = payload.data(using: .utf8) else {
      throw DeviceSignerError.invalidPayload
    }
    var error: Unmanaged<CFError>?
    guard
      let signature = SecKeyCreateSignature(
        privateKey,
        .ecdsaSignatureMessageX962SHA256,
        data as CFData,
        &error
      ) as Data?
    else {
      let reason = error.map { CFErrorCopyDescription($0.takeRetainedValue()) as String } ?? "unknown"
      throw DeviceSignerError.signingFailed(reason)
    }
    return signature.base64EncodedString()
  }
}
