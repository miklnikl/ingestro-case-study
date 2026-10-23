import { z } from 'zod';

export function realDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }
  const date = new Date(value + 'T00:00:00Z');
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}
const required = z.string().min(1, 'Required: enter a value.');
export const schema = z.object({
  customer_id: required,
  first_name: required,
  last_name: required,
  email: z.string().email('Enter an email such as anna@example.com.'),
  signup_date: z.string().refine(realDate, 'Enter a real date as YYYY-MM-DD.'),
  country: z
    .string()
    .regex(/^[A-Z]{2}$/, 'Use a two-letter country code, such as DE.')
    .refine((v) => countryCodes.has(v), 'Use an assigned ISO country code, such as DE.'),
  plan: z.enum(['free', 'pro', 'enterprise'], { error: 'Choose free, pro, or enterprise.' }),
  monthly_spend: z
    .string()
    .regex(/^\d+(\.\d+)?$/, 'Enter a non-negative number, such as 19.50.')
    .refine((v) => Number.isFinite(Number(v)), 'Number is too large.'),
});
const countryCodes = new Set(
  'AD AE AF AG AI AL AM AO AQ AR AS AT AU AW AX AZ BA BB BD BE BF BG BH BI BJ BL BM BN BO BQ BR BS BT BV BW BY BZ CA CC CD CF CG CH CI CK CL CM CN CO CR CU CV CW CX CY CZ DE DJ DK DM DO DZ EC EE EG EH ER ES ET FI FJ FK FM FO FR GA GB GD GE GF GG GH GI GL GM GN GP GQ GR GS GT GU GW GY HK HM HN HR HT HU ID IE IL IM IN IO IQ IR IS IT JE JM JO JP KE KG KH KI KM KN KP KR KW KY KZ LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME MF MG MH MK ML MM MN MO MP MQ MR MS MT MU MV MW MX MY MZ NA NC NE NF NG NI NL NO NP NR NU NZ OM PA PE PF PG PH PK PL PM PN PR PS PT PW PY QA RE RO RS RU RW SA SB SC SD SE SG SH SI SJ SK SL SM SN SO SR SS ST SV SX SY SZ TC TD TF TG TH TJ TK TL TM TN TO TR TT TV TW TZ UA UG UM US UY UZ VA VC VE VG VI VN VU WF WS YE YT ZA ZM ZW'.split(
    ' ',
  ),
);
