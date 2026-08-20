export function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

export function formatPrice(amount: number): string {
  return `${amount.toLocaleString("ko-KR")}원`;
}
