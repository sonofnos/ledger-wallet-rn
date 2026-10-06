package expo.modules.devicesigner

import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import android.util.Base64
import androidx.biometric.BiometricPrompt
import androidx.core.content.ContextCompat
import androidx.fragment.app.FragmentActivity
import expo.modules.kotlin.Promise
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.security.KeyPair
import java.security.KeyPairGenerator
import java.security.KeyStore
import java.security.Signature
import java.security.spec.ECGenParameterSpec

private const val KEY_ALIAS = "com.ledgerwallet.devicesigner.key"
private const val KEYSTORE_PROVIDER = "AndroidKeyStore"

class DeviceSignerModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("DeviceSigner")

    AsyncFunction("getOrCreatePublicKey") { promise: Promise ->
      try {
        val keyPair = getOrCreateKeyPair()
        promise.resolve(Base64.encodeToString(keyPair.public.encoded, Base64.NO_WRAP))
      } catch (e: Exception) {
        promise.reject("E_KEYGEN", e.message ?: "key generation failed", e)
      }
    }

    AsyncFunction("sign") { payload: String, promise: Promise ->
      signWithBiometricPrompt(payload, promise)
    }

    AsyncFunction("isHardwareBacked") { promise: Promise ->
      promise.resolve(true)
    }
  }

  private fun keyStore(): KeyStore =
    KeyStore.getInstance(KEYSTORE_PROVIDER).apply { load(null) }

  private fun getOrCreateKeyPair(): KeyPair {
    val ks = keyStore()
    if (ks.containsAlias(KEY_ALIAS)) {
      val entry = ks.getEntry(KEY_ALIAS, null) as KeyStore.PrivateKeyEntry
      return KeyPair(entry.certificate.publicKey, entry.privateKey)
    }

    val generator = KeyPairGenerator.getInstance(KeyProperties.KEY_ALGORITHM_EC, KEYSTORE_PROVIDER)
    val spec =
      KeyGenParameterSpec.Builder(KEY_ALIAS, KeyProperties.PURPOSE_SIGN)
        .setDigests(KeyProperties.DIGEST_SHA256)
        .setAlgorithmParameterSpec(ECGenParameterSpec("secp256r1"))
        .setUserAuthenticationRequired(true)
        .setInvalidatedByBiometricEnrollment(true)
        .build()
    generator.initialize(spec)
    return generator.generateKeyPair()
  }

  /**
   * Unlike iOS, Android's Keystore does not surface the biometric prompt on
   * its own — a key with setUserAuthenticationRequired(true) throws
   * UserNotAuthenticatedException on sign() until a BiometricPrompt unlocks
   * a CryptoObject wrapping that same Signature instance. That wiring has to
   * happen against the current Activity, which is why this half of the
   * bridge is bigger than the iOS half.
   */
  private fun signWithBiometricPrompt(payload: String, promise: Promise) {
    val activity = appContext.currentActivity as? FragmentActivity
    if (activity == null) {
      promise.reject("E_NO_ACTIVITY", "No foreground FragmentActivity available for biometric prompt", null)
      return
    }

    try {
      getOrCreateKeyPair()
      val entry = keyStore().getEntry(KEY_ALIAS, null) as KeyStore.PrivateKeyEntry
      val signature = Signature.getInstance("SHA256withECDSA")
      signature.initSign(entry.privateKey)
      val cryptoObject = BiometricPrompt.CryptoObject(signature)

      val executor = ContextCompat.getMainExecutor(activity)
      val callback =
        object : BiometricPrompt.AuthenticationCallback() {
          override fun onAuthenticationSucceeded(result: BiometricPrompt.AuthenticationResult) {
            try {
              val signedWith = result.cryptoObject?.signature
              signedWith?.update(payload.toByteArray(Charsets.UTF_8))
              val signatureBytes = signedWith?.sign()
              if (signatureBytes == null) {
                promise.reject("E_SIGN", "Signature object missing after authentication", null)
                return
              }
              promise.resolve(Base64.encodeToString(signatureBytes, Base64.NO_WRAP))
            } catch (e: Exception) {
              promise.reject("E_SIGN", e.message ?: "signing failed", e)
            }
          }

          override fun onAuthenticationError(errorCode: Int, errString: CharSequence) {
            promise.reject("E_AUTH", errString.toString(), null)
          }
        }

      val prompt = BiometricPrompt(activity, executor, callback)
      val promptInfo =
        BiometricPrompt.PromptInfo.Builder()
          .setTitle("Confirm transfer")
          .setSubtitle("Sign this transaction with your device")
          .setNegativeButtonText("Cancel")
          .build()

      activity.runOnUiThread {
        prompt.authenticate(promptInfo, cryptoObject)
      }
    } catch (e: Exception) {
      promise.reject("E_SIGN_SETUP", e.message ?: "could not prepare signing key", e)
    }
  }
}
