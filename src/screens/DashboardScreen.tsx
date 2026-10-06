import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';

import { useAccount, useTransactions } from '../api/hooks';
import type { RootStackParamList } from '../navigation/types';
import { useAuthStore } from '../store/authStore';
import { colors, formatMoney } from '../theme';
import type { Transaction } from '../types/api';

type Props = NativeStackScreenProps<RootStackParamList, 'Dashboard'>;

export default function DashboardScreen({ navigation }: Props) {
  const signOut = useAuthStore((s) => s.signOut);
  const user = useAuthStore((s) => s.user);
  const accountQuery = useAccount();
  const transactionsQuery = useTransactions();

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>Hi, {user?.fullName ?? 'there'}</Text>
          <Text style={styles.account}>
            {accountQuery.data ? `•••• ${accountQuery.data.accountNumber.slice(-4)}` : ' '}
          </Text>
        </View>
        <Pressable onPress={() => signOut()}>
          <Text style={styles.signOut}>Sign out</Text>
        </Pressable>
      </View>

      <View style={styles.balanceCard}>
        <Text style={styles.balanceLabel}>Available balance</Text>
        {accountQuery.isLoading ? (
          <ActivityIndicator color={colors.text} style={{ marginTop: 8 }} />
        ) : (
          <Text style={styles.balanceValue}>
            {accountQuery.data
              ? formatMoney(accountQuery.data.balanceCents, accountQuery.data.currency)
              : '—'}
          </Text>
        )}
      </View>

      <Pressable style={styles.transferButton} onPress={() => navigation.navigate('Transfer')}>
        <Text style={styles.transferButtonText}>Send money</Text>
      </Pressable>

      <Text style={styles.sectionTitle}>Recent activity</Text>

      <FlatList
        data={transactionsQuery.data?.items ?? []}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <TransactionRow transaction={item} />}
        ListEmptyComponent={
          transactionsQuery.isLoading ? (
            <ActivityIndicator color={colors.text} />
          ) : (
            <Text style={styles.empty}>No transactions yet.</Text>
          )
        }
        contentContainerStyle={{ paddingBottom: 24 }}
      />
    </View>
  );
}

function TransactionRow({ transaction }: { transaction: Transaction }) {
  const isCredit = transaction.type === 'credit';
  return (
    <View style={styles.row}>
      <View>
        <Text style={styles.rowTitle}>{transaction.counterparty}</Text>
        <Text style={styles.rowSubtitle}>{new Date(transaction.createdAt).toLocaleString()}</Text>
      </View>
      <Text style={[styles.rowAmount, { color: isCredit ? colors.accent : colors.text }]}>
        {isCredit ? '+' : '-'}
        {formatMoney(transaction.amountCents)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    paddingHorizontal: 20,
    paddingTop: 60,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  greeting: { color: colors.text, fontSize: 20, fontWeight: '600' },
  account: { color: colors.muted, fontSize: 13, marginTop: 2 },
  signOut: { color: colors.muted, fontSize: 14 },
  balanceCard: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
  },
  balanceLabel: { color: colors.muted, fontSize: 13 },
  balanceValue: { color: colors.text, fontSize: 32, fontWeight: '700', marginTop: 6 },
  transferButton: {
    backgroundColor: colors.accent,
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
    marginBottom: 24,
  },
  transferButtonText: { color: colors.background, fontWeight: '700', fontSize: 15 },
  sectionTitle: { color: colors.text, fontSize: 16, fontWeight: '600', marginBottom: 12 },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  rowTitle: { color: colors.text, fontSize: 15 },
  rowSubtitle: { color: colors.muted, fontSize: 12, marginTop: 2 },
  rowAmount: { fontSize: 15, fontWeight: '600' },
  empty: { color: colors.muted, textAlign: 'center', marginTop: 24 },
});
