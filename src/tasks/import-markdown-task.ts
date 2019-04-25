import { createReadStream } from 'fs';
import { createInterface } from 'readline';
import { decodeStream } from 'iconv-lite';
import { inject, injectable } from 'inversify';
import { join } from 'path';
import { kGraphStore, kUI, kEnvStore } from '../types';
import { Readable } from 'stream';
import { TransformCallback, obj } from 'through2';
import GraphStore from '../stores/graph-store';
import Task from '../interfaces/task';
import UI from 'console-ui';
import intoStream from 'into-stream';
import { titleize, camelize, classify } from 'inflected';
import generateUuid from '../utils/uuid';
import fetch from 'node-fetch';
import { EnvConfig } from '@atsjj/env-config';

interface Tag {
  tag: string;
  subTags?: Tag[];
  type?: string;
}

interface Document {
  date: string;
  title: string;
  text: string;
  tags: Tag[];
}

interface Entity {
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

@injectable()
export default class ImportMarkdownTask implements Task {
  @inject(kEnvStore) env: EnvConfig;
  @inject(kGraphStore) graphStore: GraphStore;
  @inject(kUI) ui: UI;

  async run(): Promise<any> {
    const documents = await this.getArticles();
    const session = this.graphStore.driver.session();
    const tokenizationUrl = this.env.required('tokenization.url');
    const method = 'POST';

    this.ui.startProgress('storing tags');

    for (const tag of this.tagsFrom(documents).values()) {
      try {
        await session.run(`
          MERGE (t:Tag { tag: {tag} }) RETURN t
        `, { tag })
      } catch (error) {
        this.ui.writeWarnLine('error storing tag');
        this.ui.writeWarnLine(JSON.stringify(error, null, 2));
      }
    }

    this.ui.startProgress('linking tags');

    for (const document of documents) {
      for (const tag of document.tags) {
        for (const subTag of tag.subTags) {
          const t1 = caseInsensitiveRegexMatch(tag.tag);
          const t2 = caseInsensitiveRegexMatch(subTag.tag);

          try {
            await session.run(`
              MATCH (t1:Tag) WHERE t1.tag =~ {t1}
              MATCH (t2:Tag) WHERE t2.tag =~ {t2}
              MERGE (t1)-[:Tag]->(t2)
              RETURN 0
            `, { t1, t2 })
          } catch (error) {
            this.ui.writeWarnLine('error linking tags');
            this.ui.writeWarnLine(JSON.stringify(error, null, 2));
          }
        }
      }
    }

    this.ui.startProgress('storing articles');

    for (const document of documents) {
      const { date, text, title } = document;
      const id = generateUuid(date, title);

      const queries: string[] = [];
      const params = { id, date, text, title };

      queries.push(`
        CREATE (a:Article { id: {id}, title: {title}, text: {text}, date: {date} })
        WITH a
      `);

      document.tags.forEach((tag, i) => {
        queries.push(`
          MATCH (t:Tag) WHERE t.tag =~ {tag${i}}
          MERGE (a)-[:Tag]->(t)
          WITH a
        `);

        params[`tag${i}`] = caseInsensitiveRegexMatch(tag.tag);

        tag.subTags.forEach((subTag, j) => {
          queries.push(`
            MATCH (t:Tag) WHERE t.tag =~ {tag${i}_${j}}
            MERGE (a)-[:Tag]->(t)
            WITH a
          `);

          params[`tag${i}_${j}`] = caseInsensitiveRegexMatch(subTag.tag);
        });
      });

      // try {
      //   this.ui.startProgress('tokenizing document');

      //   const body = `${document.title}\n${document.text}`;
      //   const entities: Entity[] = await (await fetch(tokenizationUrl, { body, method })).json();

      //   this.ui.startProgress('storing tokens');

      //   let k = 0;
      //   for (const entity of entities) {
      //     const type = classify(entity.type)
      //     const key = camelize(entity.type)

      //     try {
      //       await session.run(`
      //         MERGE (t:${type} { tag: {tag} }) RETURN t
      //       `, { tag: entity.value })

      //       queries.push(`
      //         MATCH (t:${type}) WHERE t.tag =~ {${key}_${k}}
      //         MERGE (a)-[:${type}]->(t)
      //         WITH a
      //       `);

      //       params[`${key}_${k}`] = caseInsensitiveRegexMatch(entity.value);

      //       k++;
      //     } catch (error) {
      //       this.ui.writeWarnLine('error storing tag');
      //       this.ui.writeWarnLine(JSON.stringify(error, null, 2));
      //     }
      //   }
      // } catch (error) {
      //   this.ui.writeWarnLine('error parsing entities');
      //   this.ui.writeWarnLine(JSON.stringify(error, null, 2));
      // }

      queries.push(`
        RETURN 0
      `);

      try {
        await session.run(queries.join("\n"), params);
      } catch (error) {
        this.ui.writeWarnLine('error creating articles');
        this.ui.writeWarnLine(JSON.stringify(error, null, 2));
      }
    }

    session.close();
    this.ui.stopProgress();
    this.ui.writeInfoLine('should be finished importing markdown');

    return documents;
  }

  tagsFrom(documents: Document[]): Set<string> {
    const tags: Set<string> = new Set();

    documents.forEach(document => {
      document.tags.forEach(tag => {
        tags.add(tag.tag);
        tag.subTags.forEach(subTag => tags.add(subTag.tag))
      });
    });

    return tags;
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
            documents.push(Object.assign({}, document));
          }

          document = {
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
