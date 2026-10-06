import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { useTransfer } from '../api/hooks';
import { DeviceSigner } from '../../modules/device-signer/src';
import type { RootStackParamList } from '../navigation/types';
import { colors } from '../theme';
import { ApiError } from '../types/api';

type Props = NativeStackScreenProps<RootStackParamList, 'Transfer'>;

type Step = 'form' | 'signing' | 'done';

export default function TransferScreen({ navigation }: Props) {
  const [toAccountNumber, setToAccountNumber] = useState('');
  const [amount, setAmount] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState<Step>('form');
  const [signaturePreview, setSignaturePreview] = useState<string | null>(null);
  const transfer = useTransfer();

  async function handleSend() {
    setError(null);
    const amountCents = Math.round(Number(amount) * 100);
    if (!toAccountNumber.trim() || !Number.isFinite(amountCents) || amountCents <= 0) {
      setError('Enter a valid account number and amount.');
      return;
    }

    const idempotencyKey = `${Date.now()}-${Math.random().toString(36).slice(2)}`;

    try {
      setStep('signing');
      // Device-bound proof of intent: this ECDSA signature is produced by a
      // Secure Enclave / AndroidKeyStore key behind a biometric gate (see
      // modules/device-signer). The backend contract above doesn't require
      // it today, but this is the shape a production payments app would
      // extend the transfer payload with to prove the request really came
      // from an authenticated human holding this device.
      const payload = JSON.stringify({ toAccountNumber, amountCents, idempotencyKey });
      const signature = await DeviceSigner.sign(payload);
      setSignaturePreview(signature);

      await transfer.mutateAsync({ toAccountNumber: toAccountNumber.trim(), amountCents, idempotencyKey });
      setStep('done');
    } catch (e) {
      setStep('form');
      if (e instanceof ApiError) {
        setError(e.message);
      } else if (e instanceof Error) {
        setError(e.message || 'Could not sign this transfer on your device.');
      } else {
        setError('Something went wrong.');
      }
    }
  }

  if (step === 'done') {
    return (
      <View style={styles.container}>
        <Text style={styles.successTitle}>Transfer sent</Text>
        <Text style={styles.successBody}>
          Signed on-device and submitted. Signature (truncated):
        </Text>
        <Text style={styles.signature} numberOfLines={2}>
          {signaturePreview?.slice(0, 48)}…
        </Text>
        <Pressable style={styles.button} onPress={() => navigation.goBack()}>
          <Text style={styles.buttonText}>Back to dashboard</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 40 }}>
      <Text style={styles.title}>Send money</Text>

      <Text style={styles.label}>Recipient account number</Text>
      <TextInput
        style={styles.input}
        placeholder="0123456789"
        placeholderTextColor={colors.muted}
        keyboardType="number-pad"
        value={toAccountNumber}
        onChangeText={setToAccountNumber}
      />

      <Text style={styles.label}>Amount (NGN)</Text>
      <TextInput
        style={styles.input}
        placeholder="0.00"
        placeholderTextColor={colors.muted}
        keyboardType="decimal-pad"
        value={amount}
        onChangeText={setAmount}
      />

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <Pressable
        style={[styles.button, step === 'signing' && styles.buttonDisabled]}
        onPress={handleSend}
        disabled={step === 'signing'}
      >
        {step === 'signing' ? (
          <ActivityIndicator color={colors.background} />
        ) : (
          <Text style={styles.buttonText}>Confirm with Face ID / fingerprint</Text>
        )}
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, padding: 24, paddingTop: 60 },
  title: { color: colors.text, fontSize: 24, fontWeight: '700', marginBottom: 24 },
  label: { color: colors.muted, fontSize: 13, marginBottom: 6 },
  input: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    color: colors.text,
    marginBottom: 18,
    fontSize: 16,
  },
  button: {
    backgroundColor: colors.accent,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: colors.background, fontWeight: '700', fontSize: 15 },
  error: { color: colors.danger, marginBottom: 12 },
  successTitle: { color: colors.accent, fontSize: 24, fontWeight: '700', marginBottom: 12 },
  successBody: { color: colors.muted, fontSize: 14, marginBottom: 8 },
  signature: { color: colors.text, fontSize: 12, fontFamily: 'Courier', marginBottom: 32 },
});
