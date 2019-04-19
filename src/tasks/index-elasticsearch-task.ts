import { inject, injectable } from 'inversify';
import { kDocumentStore, kUI, kElasticStore } from '../types';
import Article from '../interfaces/article';
import DocumentStore from '../stores/document-store';
import Task from '../interfaces/task';
import UI from 'console-ui';
import { Client } from '@elastic/elasticsearch';

@injectable()
export default class IndexElasticsearchTask implements Task {
  @inject(kDocumentStore) documentStore: DocumentStore;
  @inject(kElasticStore) elasticStore: Client;
  @inject(kUI) ui: UI;

  async run(): Promise<any> {
    const articlesStore = this.documentStore.for('articles');

    const articles = await articlesStore.allDocs<Article>({ include_docs: true });

    this.ui.writeInfoLine(`there are ${articles.total_rows} page(s) to index...`);
    this.ui.startProgress('creating articles index');

    try {
      await this.elasticStore.indices.delete({
        index: 'articles'
      });

      await this.elasticStore.indices.create({
        index: 'articles',
        body: {
          settings: {
            index: {
              number_of_shards: 1,
              number_of_replicas: 1
            }
          },
          mappings: {
            properties: {
              createdAt: {
                type: 'date'
              },
              title: {
                term_vector: 'with_positions_offsets_payloads',
                type: 'text'
              },
              body: {
                term_vector: 'with_positions_offsets_payloads',
                type: 'text'
              },
              url: {
                type: 'keyword'
              }
            }
          }
        }
      });
    } catch (error) {
      this.ui.writeWarnLine('error creating articles index');
      // this.ui.writeWarnLine(JSON.stringify(error, null, 2));
    }

    this.ui.startProgress('indexing articles');

    for (const article of articles.rows) {
      const a = article.doc;

      (true == true)

      const { _id: id, title, createdAt, url, body } = article.doc

      try {
        await this.elasticStore.index({
          id,
          index: 'articles',
          body: {
            title, createdAt, url, body
          }
        });
      } catch (error) {
        this.ui.writeWarnLine('error indexing article');

        // this.ui.writeWarnLine(JSON.stringify(error, null, 2));
      }
    }

    this.ui.stopProgress();
    this.ui.writeInfoLine('indexing should be complete');

    return true;
  }
}
