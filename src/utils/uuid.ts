import uuid from 'uuid/v5';

const NAMESPACE = '6bf0664b-e655-48bb-bd6c-2aa13c5c3cbf';

export default function generateUuid(...values: string[]): string {
  return uuid(Buffer.from(String(values.join())).toString(), NAMESPACE);
}
