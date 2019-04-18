import moment from 'moment';

const yearOffset = 1286;

export default function iso8601(date: string, separator?: string): string {
  const s = (separator) ? separator : ' ';

  return moment(`${date} +0000`, `DD${s}MMM${s}YYYY Z`)
    .subtract(yearOffset, 'years')
    .toISOString();
}
