type MoneyIncomeListener = (amount: number) => void;

const listeners = new Set<MoneyIncomeListener>();

let moneyIndicatorElement: HTMLElement | null = null;

export function setMoneyIndicatorElement(element: HTMLElement | null) {
  moneyIndicatorElement = element;
}

export function getMoneyIndicatorRect() {
  return moneyIndicatorElement?.getBoundingClientRect() ?? null;
}

export function emitMoneyIncome(amount: number) {
  if (!Number.isFinite(amount) || amount <= 0) return;
  listeners.forEach((listener) => listener(amount));
}

export function subscribeToMoneyIncome(listener: MoneyIncomeListener) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
