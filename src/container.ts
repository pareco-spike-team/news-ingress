import { Client } from '@elastic/elasticsearch';
import { Container } from 'inversify';
import { kEnvStore, kDocumentStore, kGraphStore, kScrapeGalnetTask, kImportFeedTask, kUI, kImportMarkdownTask, kElasticStore, kIndexElasticsearchTask } from './types';
import DocumentStore from './stores/document-store';
import envStore from './stores/env-store';
import GraphStore from './stores/graph-store';
import ImportFeedTask from './tasks/import-feed-task';
import ImportMarkdownTask from './tasks/import-markdown-task';
import IndexElasticsearchTask from './tasks/index-elasticsearch-task';
import ScrapeGalnetTask from './tasks/scrape-galnet-task';
import UI from 'console-ui';

const container = new Container();

const ui = new UI({
  inputStream: process.stdin,
  outputStream: process.stdout,
  errorStream: process.stderr,
  writeLevel: 'DEBUG',
  ci: false
});

const elasticStore = new Client({
  node: envStore.required('elasticsearch.url')
});

container.bind(kDocumentStore).to(DocumentStore).inSingletonScope();
container.bind(kElasticStore).toConstantValue(elasticStore);
container.bind(kEnvStore).toConstantValue(envStore);
container.bind(kGraphStore).to(GraphStore).inSingletonScope();
container.bind(kImportFeedTask).to(ImportFeedTask);
container.bind(kImportMarkdownTask).to(ImportMarkdownTask);
container.bind(kIndexElasticsearchTask).to(IndexElasticsearchTask);
container.bind(kScrapeGalnetTask).to(ScrapeGalnetTask);
container.bind(kUI).toConstantValue(ui);

export default container;
