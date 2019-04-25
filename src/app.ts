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
      name: 'Import Markdown',
      value: kImportMarkdownTask
    }]
  });

  return container.get<Task>(task).run();
}
