export const colors = {
  background: '#0B0F14',
  surface: '#141A21',
  border: '#232B34',
  text: '#F4F6F8',
  muted: '#8A95A1',
  accent: '#3DDC97',
  danger: '#FF6B6B',
};

export function formatMoney(cents: number, currency = 'NGN'): string {
  const amount = cents / 100;
  return new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency,
    maximumFractionDigits: 2,
  }).format(amount);
}
