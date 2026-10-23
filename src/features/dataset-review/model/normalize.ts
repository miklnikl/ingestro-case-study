import { fields, type Values } from './types';

const countries: Record<string, string> = {};
for (const [code, variants] of Object.entries({
  DE: ['Germany', 'Deutschland'],
  FR: ['France'],
  IT: ['Italy', 'Italia'],
  ES: ['Spain', 'España'],
  NL: ['Netherlands', 'Nederland', 'The Netherlands'],
  PL: ['Poland', 'Polska'],
  GB: ['United Kingdom', 'UK'],
  US: ['United States', 'USA', 'U.S.'],
})) {
  for (const value of [code, ...variants]) {
    countries[value.toLowerCase()] = code;
  }
}
const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export function normalize(input: Values): Values {
  const v = Object.fromEntries(fields.map((f) => [f, input[f].trim()])) as Values;
  v.country = countries[v.country.toLowerCase()] ?? v.country;
  v.plan = v.plan.toLowerCase();
  let match = v.signup_date.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (match) {
    v.signup_date = `${match[3]}-${match[2]}-${match[1]}`;
  }
  match = v.signup_date.match(/^(\d{1,2}) ([A-Za-z]{3}) (\d{4})$/);
  if (match) {
    const month = months.findIndex((m) => m.toLowerCase() === match![2].toLowerCase()) + 1;
    if (month) {
      v.signup_date = `${match[3]}-${String(month).padStart(2, '0')}-${match[1].padStart(2, '0')}`;
    }
  }
  let spend = v.monthly_spend.replace(/^€\s*/, '').replace(/\s+EUR$/i, '');
  if (/^\d{1,3}(,\d{3})+\.\d+$/.test(spend)) {
    spend = spend.replace(/,/g, '');
  } else if (/^\d+,\d{2}$/.test(spend)) {
    spend = spend.replace(',', '.');
  }
  v.monthly_spend = spend;
  return v;
}
