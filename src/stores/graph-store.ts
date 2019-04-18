import { EnvConfig } from '@atsjj/env-config';
import { injectable, inject } from 'inversify';
import { kEnvStore } from '../types';
import neo4j from 'neo4j-driver';

@injectable()
export default class GraphStore {
  @inject(kEnvStore) env: EnvConfig;

  private _driver: neo4j.Driver;

  private get username(): string {
    return this.env.optional('neo4j.username');
  }

  private get password(): string {
    return this.env.optional('neo4j.password');
  }

  private get authToken(): neo4j.AuthToken {
    if (this.username && this.password) {
      return neo4j.auth.basic(this.username, this.password);
    }
  }

  private get url(): string {
    return this.env.required('neo4j.url');
  }

  public get driver(): neo4j.Driver {
    if (!this._driver) {
      this._driver = neo4j.driver(this.url, this.authToken);

      process.on('beforeExit', _ => this._driver.close());
    }

    return this._driver;
  }
}
