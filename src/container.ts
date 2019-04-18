import { Container } from 'inversify';
import { kEnvStore, kDocumentStore, kGraphStore, kScrapeGalnetTask, kImportFeedTask, kUI } from './types';
import DocumentStore from './stores/document-store';
import envStore from './stores/env-store';
import GraphStore from './stores/graph-store';
import ImportFeedTask from './tasks/import-feed-task';
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

container.bind(kEnvStore).toConstantValue(envStore);
container.bind(kDocumentStore).to(DocumentStore).inSingletonScope();
container.bind(kGraphStore).to(GraphStore).inSingletonScope();
container.bind(kScrapeGalnetTask).to(ScrapeGalnetTask);
container.bind(kImportFeedTask).to(ImportFeedTask);
container.bind(kUI).toConstantValue(ui);

export default container;
