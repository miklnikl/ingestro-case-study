export const fields = [
  'customer_id',
  'first_name',
  'last_name',
  'email',
  'signup_date',
  'country',
  'plan',
  'monthly_spend',
] as const;
export type Field = (typeof fields)[number];
export type Values = Record<Field, string>;
export type Row = {
  key: number;
  values: Values;
  errors: Partial<Record<Field, string>>;
  corrected: boolean;
};
