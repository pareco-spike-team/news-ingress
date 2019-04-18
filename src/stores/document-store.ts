import { EnvConfig } from '@atsjj/env-config';
import { injectable, inject } from 'inversify';
import { kEnvStore } from '../types';
import { parse } from 'url';
import PouchDB from 'pouchdb';

@injectable()
export default class DocumentStore {
  @inject(kEnvStore) env: EnvConfig;

  private databases: Map<string, PouchDB.Database> = new Map();

  for(name: string): PouchDB.Database {
    const source = parse(`${this.env.required('couchdb.url')}/${name}`);

    if (!this.databases.has(name)) {
      this.databases.set(name, new PouchDB(source.href));
    }

    return this.databases.get(name);
  }
}
