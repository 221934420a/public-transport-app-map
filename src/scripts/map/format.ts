export const fillTemplate = (template: string, values: Record<string, string | number>) =>
  template.replace(/\{(\w+)\}/g, (match, key: string) =>
    key in values ? String(values[key]) : match,
  );

export const createFormatters = (locale: string) => {
  const formatMoney = (amount: number, currency: string) =>
    new Intl.NumberFormat(locale, { style: 'currency', currency }).format(amount);

  const formatDuration = (duration: { value: number; unit: string }) => {
    try {
      return new Intl.NumberFormat(locale, {
        style: 'unit',
        unit: duration.unit as Intl.NumberFormatOptions['unit'],
        unitDisplay: 'long',
      }).format(duration.value);
    } catch {
      return `${duration.value} ${duration.unit}`;
    }
  };

  return { formatMoney, formatDuration };
};
