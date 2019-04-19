import { kScrapeGalnetTask, kImportFeedTask, kUI, kImportMarkdownTask, kIndexElasticsearchTask } from './types';
import container from './container';
import Task from './interfaces/task';
import UI from 'console-ui';

export default async function app(): Promise<any> {
  const ui = container.get<UI>(kUI);

  const { task } = await ui.prompt({
    name: 'task',
    type: 'list',
    message: 'Which task would you like to run?',
    choices: [{
      name: 'Scrape Galnet',
      value: kScrapeGalnetTask
    }, {
      name: 'Import Feed CSS',
      value: kImportFeedTask
    }, {
      name: 'Import Markdown',
      value: kImportMarkdownTask
    }, {
      name: 'Index Galnet',
      value: kIndexElasticsearchTask
    }]
  });

  return container.get<Task>(task).run();
}
