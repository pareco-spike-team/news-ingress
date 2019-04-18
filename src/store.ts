import { parse } from 'url';
import * as PouchDB from 'pouchdb';
import * as uuid from 'uuid/v5';
import env from './env';

const NAMESPACE = '6bf0664b-e655-48bb-bd6c-2aa13c5c3cbf';

class Store {
  private databases: Map<string, PouchDB.Database> = new Map();

  for(name: string): PouchDB.Database {
    const source = parse(`${env.required('couchdb.url')}/${name}`);

    if (!this.databases.has(name)) {
      this.databases.set(name, new PouchDB(source.href));
    }

    return this.databases.get(name);
  }
}

const store = new Store();

export function generateUuid(value: string): string {
  return uuid(Buffer.from(String(value)).toString(), NAMESPACE);
}

export default store;
