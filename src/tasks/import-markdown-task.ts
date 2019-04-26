import { createInterface } from 'readline';
import { createReadStream } from 'fs';
import { decodeStream } from 'iconv-lite';
import { EnvConfig } from '@atsjj/env-config';
import { inject, injectable } from 'inversify';
import { join } from 'path';
import { kGraphStore, kUI, kEnvStore } from '../types';
import { titleize, camelize, classify, underscore, parameterize } from 'inflected';
import fetch from 'node-fetch';
import generateUuid from '../utils/uuid';
import GraphStore from '../stores/graph-store';
import Task from '../interfaces/task';
import UI from 'console-ui';
import moment = require('moment');

interface Tag {
  tag: string;
  subTags?: Tag[];
  type?: string;
}

interface Document {
  id: string;
  date: string;
  title: string;
  text: string;
  tags: Tag[];
}

interface Entity {
  type: string;
  value: string;
}

interface EntityLabel {
  key: string;
  type: string;
  value: string;
}

/*
  How to interpret the markdown
  # - article title
  ## - tag on article
  ### subtag
  * Tag (star system)
      * starport
*/
class Row {
  private readonly document: Document;
  private readonly value: string;
  private readonly rawValue: string;

  constructor(document: Document, value: string) {
    this.document = document;
    this.value = value.trim();
    this.rawValue = value;
  }

  get isSubTag(): boolean {
    return this.value.startsWith('###');
  }

  get isTag(): boolean {
    return !this.isSubTag && this.value.startsWith('##');
  }

  get isTitle(): boolean {
    return !this.isTag && this.value.startsWith('#');
  }

  get isStation(): boolean {
    return this.rawValue.startsWith('    *');
  }

  get isSystem(): boolean {
    return !this.isStation && /^\* \w+/.test(this.value);
  }

  get isDate(): boolean {
    return /^\d{4}-\d{2}-\d{2}$/.test(this.value);
  }

  get parent(): Tag {
    return this.document.tags.slice(-1)[0];
  }

  get subTag(): Tag {
    return {
      tag: titleize(this.value.slice(3).trim())
    };
  }

  get tag(): Tag {
    return {
      tag: titleize(this.value.slice(2).trim()),
      subTags: []
    };
  }

  get systemTag(): Tag {
    return {
      tag: titleize(this.value.slice(2).trim()),
      subTags: [],
      type: 'system'
    };
  }

  get stationTag(): Tag {
    return {
      tag: titleize(this.value.slice(2).trim())
    };
  }

  get title(): string {
    return titleize(this.value.slice(1).trim());
  }

  get date(): string {
    return this.value;
  }

  get text(): string {
    return `${this.document.text}\n${this.value}`;
  }
}

function caseInsensitiveRegexMatch(value: string): string {
  return `(?muis)${value.toLowerCase()}`;
}

function generateQueryVariable(...values: string[]): string {
  return camelize(underscore(values.join('')));
}

function uuidize(...values: string[]): string {
  return generateUuid(parameterize(values.join(' ')));
}

type EntitiesTuple = [Map<string, string>, Map<string, Set<string>>, Map<string, Set<string>>];
type EntitiesTokensTuple = [Map<string, Entity>, Map<string, Set<string>>];
type EntityParam = { [x: string]: string };
type QueryTuple = [string[], EntityParam[]];
type InsertProgressCallback = (current: number, max: number) => void;

@injectable()
export default class ImportMarkdownTask implements Task {
  @inject(kEnvStore) env: EnvConfig;
  @inject(kGraphStore) graphStore: GraphStore;
  @inject(kUI) ui: UI;

  async insert(queryTuple: QueryTuple, cb?: InsertProgressCallback): Promise<any> {
    const session = this.graphStore.driver.session();
    const max = queryTuple[0].length;

    if (cb) {
      cb(0, max);
    }

    for (let i = 0; i < max; i++) {
      try {
        await session.run(queryTuple[0][i], queryTuple[1][i]);

        if (cb) {
          cb(i, max);
        }
      } catch (error) {
        this.ui.writeWarnLine(JSON.stringify({
          title: 'Could not run query.',
          message: `There was a problem processing the query:\n${queryTuple[0][i]}`,
          parameters: queryTuple[1][i],
          error
        }, null, 2));
      }
    }

    session.close();
  }

  reportProgress(task: string): InsertProgressCallback {
    const startedAt = moment();

    return (i, m) => {
      const p = Math.ceil((i / m) * 100);

      this.ui.startProgress(`${task} (${i} of ${m}, ${p}%)`);

      if (i === m || i === (m - 1)) {
        const finishedAt = moment();
        const d = moment.duration(finishedAt.diff(startedAt)).humanize();

        this.ui.stopProgress();
        this.ui.writeInfoLine(`${task} (completed ${m} in ${d})`);
      }
    };
  }

  async run(): Promise<any> {
    const documents = await this.getArticles();
    const [entityMap, entityRelationshipMap, documentRelationshipMap] = this.entitiesFrom(documents);

    this.ui.startProgress('');

    const [entityTokenMap, documentTokenRelationshipMap] = await this.entitiesFromTokenization(documents, this.reportProgress('Fetching tokens'));

    await this.insert(this.createArticleQueriesFrom(documents), this.reportProgress('Creating articles'));
    await this.insert(this.createTagQueriesFrom(entityMap), this.reportProgress('Creating tags'));
    await this.insert(this.createTagQueriesFromTokens(entityTokenMap), this.reportProgress('Creating tokens'));
    await this.insert(this.createTagRelationshipQueriesFrom(entityRelationshipMap), this.reportProgress('Creating tag relationships'));
    await this.insert(this.createArticleRelationshipQueriesFrom(documentRelationshipMap), this.reportProgress('Creating article relationships'));
    await this.insert(this.createArticleRelationshipQueriesFromTokens(entityTokenMap, documentTokenRelationshipMap), this.reportProgress('Creating token relationships'));

    this.ui.stopProgress();
  }

  entitiesFrom(documents: Document[]): EntitiesTuple {
    const entityMap: Map<string, string> = new Map();
    const entityRelationshipMap: Map<string, Set<string>> = new Map();
    const documentRelationshipMap: Map<string, Set<string>> = new Map();

    documents.forEach(document => {
      const { id } = document;

      document.tags.forEach(tag => {
        const key = uuidize(tag.tag);

        if (!documentRelationshipMap.has(id)) {
          documentRelationshipMap.set(id, new Set());
        }

        if (!entityMap.has(key)) {
          entityMap.set(key, titleize(tag.tag));
        }

        documentRelationshipMap.get(id).add(key);

        tag.subTags.forEach(tag => {
          const subKey = uuidize(tag.tag);

          if (!entityMap.has(subKey)) {
            entityMap.set(subKey, titleize(tag.tag));
          }

          if (!entityRelationshipMap.has(key)) {
            entityRelationshipMap.set(key, new Set());
          }

          documentRelationshipMap.get(id).add(subKey);

          entityRelationshipMap.get(key).add(subKey);
        });
      });
    });

    return [entityMap, entityRelationshipMap, documentRelationshipMap];
  }

  async entitiesFromTokenization(documents: Document[], cb?: InsertProgressCallback): Promise<EntitiesTokensTuple> {
    const entityMap: Map<string, Entity> = new Map();
    const documentRelationshipMap: Map<string, Set<string>> = new Map();
    const url = this.env.optional('tokenization.url') || 'http://localhost:5000';
    const method = 'POST';
    const max = documents.length;

    if (cb) {
      cb(0, max);
    }

    for (let i = 0; i < max; i++) {
      const document = documents[i];
      const { id } = document;
      const body = `${document.title}\n${document.text}`;

      try {
        (await (await fetch(url, { method, body }))
          .json() as Entity[])
          .forEach(entity => {
            const type = classify(underscore(parameterize(entity.type)));
            const { value } = entity;
            const key = uuidize(type, value);

            entityMap.set(key, { type, value });

            if (!documentRelationshipMap.has(id)) {
              documentRelationshipMap.set(id, new Set());
            }

            documentRelationshipMap.get(id).add(key);
          });

        if (cb) {
          cb(i, max);
        }
      } catch (error) {
        this.ui.writeWarnLine(JSON.stringify({
          title: 'Could not fetch tokens.',
          message: `There was a problem fetching tokens for:\n${id}`,
          parameters: body,
          error
        }, null, 2));
      }
    }

    return [entityMap, documentRelationshipMap];
  }

  createTagQueriesFromTokens(entityMap: Map<string, Entity>): QueryTuple {
    const queries: string[] = [];
    const params: EntityParam[] = [];

    entityMap.forEach((entity, key) => {
      const { type, value } = entity;
      const id = generateQueryVariable(type, 'id', key);
      const title = generateQueryVariable(type, 'value', key);

      queries.push(`
        MERGE (t:${type} { id: { ${id} }, title: { ${title} } })
        RETURN 0
      `);

      params.push({
        [id]: key,
        [title]: value
      });
    });

    return [queries, params];
  }

  createArticleRelationshipQueriesFromTokens(entityMap: Map<string, Entity>, documentRelationshipMap: Map<string, Set<string>>): QueryTuple {
    const queries: string[] = [];
    const params: EntityParam[] = [];

    documentRelationshipMap.forEach((values, documentId) => {
      const parent = generateQueryVariable('article', 'parent', 'id', documentId);

      values.forEach(entityId => {
        const { type } = entityMap.get(entityId);
        const child = generateQueryVariable('article', type, 'id', entityId);

        queries.push(`
          MATCH (parent:Article) WHERE parent.id = { ${parent} }
          MATCH (child:${type}) WHERE child.id = { ${child} }
          MERGE (parent)-[:${type}]->(child)
          RETURN 0
        `);

        params.push({
          [parent]: documentId,
          [child]: entityId,
        });
      });
    });

    return [queries, params];
  }

  createTagQueriesFrom(entityMap: Map<string, string>): QueryTuple {
    const queries: string[] = [];
    const params: EntityParam[] = [];

    entityMap.forEach((value, key) => {
      const id = generateQueryVariable('tag', 'id', key);
      const name = generateQueryVariable('tag', 'name', key);

      queries.push(`
        MERGE (t:Tag { id: { ${id} }, title: { ${name} } })
        RETURN 0
      `);

      params.push({
        [id]: key,
        [name]: value
      });
    });

    return [queries, params];
  }

  createTagRelationshipQueriesFrom(entityRelationshipMap: Map<string, Set<string>>): QueryTuple {
    const queries: string[] = [];
    const params: EntityParam[] = [];

    entityRelationshipMap.forEach((values, key) => {
      const t1 = generateQueryVariable('tag', 'parent', 'id', key);

      values.forEach(value => {
        const t2 = generateQueryVariable('tag', 'child', 'id', value);

        queries.push(`
          MATCH (t1:Tag) WHERE t1.id = { ${t1} }
          MATCH (t2:Tag) WHERE t2.id = { ${t2} }
          MERGE (t1)-[:Tag]->(t2)
          RETURN 0
        `);

        params.push({
          [t1]: key,
          [t2]: value
        });
      });
    });

    return [queries, params];
  }

  createArticleRelationshipQueriesFrom(documentRelationshipMap: Map<string, Set<string>>): QueryTuple {
    const queries: string[] = [];
    const params: EntityParam[] = [];

    documentRelationshipMap.forEach((values, key) => {
      const parent = generateQueryVariable('article', 'parent', 'id', key);

      values.forEach(value => {
        const child = generateQueryVariable('article', 'tag', 'id', value);

        queries.push(`
          MATCH (parent:Article) WHERE parent.id = { ${parent} }
          MATCH (child:Tag) WHERE child.id = { ${child} }
          MERGE (parent)-[:Tag]->(child)
          RETURN 0
        `);

        params.push({
          [parent]: key,
          [child]: value,
        });
      });
    });

    return [queries, params];
  }

  createArticleQueriesFrom(documents: Document[]): QueryTuple {
    const queries: string[] = [];
    const params: EntityParam[] = [];

    documents.forEach(document => {
      const id = generateQueryVariable('article', 'id', document.id);
      const title = generateQueryVariable('article', 'title', document.id);
      const body = generateQueryVariable('article', 'body', document.id);
      const createdAt = generateQueryVariable('article', 'createdAt', document.id);

      queries.push(`
        MERGE (a:Article { id: { ${id} }, createdAt: { ${createdAt} }, title: { ${title} }, text: { ${body} } })
        RETURN 0
      `);

      params.push({
        [id]: document.id,
        [createdAt]: document.date,
        [title]: document.title,
        [body]: document.text
      });
    });

    return [queries, params];
  }

  async getArticles(): Promise<Document[]> {
    const feed = join(process.cwd(), 'data', 'Galnet_Revamp_no_HTML.txt');

    return new Promise((resolve, reject) => {
      let document: Document = null;
      let documents: Document[] = [];

      const readline = createInterface(createReadStream(feed, { autoClose: true })
        .pipe(decodeStream('utf8')));

      readline.on('line', line => {
        const row = new Row(document, line);

        if (row.isSubTag) {
          row.parent.subTags.push(row.subTag);
        } else if (row.isTag) {
          document.tags.push(row.tag);
        } else if (row.isSystem) {
          document.tags.push(row.systemTag);
        } else if (row.isStation) {
          row.parent.subTags.push(row.stationTag);
        } else if (row.isDate) {
          document.date = row.date;
        } else if (row.isTitle) {
          if (document) {
            document.id = uuidize(document.date, document.title);
            documents.push(Object.assign({}, document));
          }

          document = {
            id: '',
            date: '',
            title: row.title,
            text: '',
            tags: []
          }
        } else {
          document.text = row.text;
        }
      });

      readline.on('close', () => resolve(documents));
    });
  }
}
