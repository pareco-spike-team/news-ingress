import { createReadStream } from 'fs';
import { decodeStream } from 'iconv-lite';
import { inject, injectable } from 'inversify';
import { join } from 'path';
import { kGraphStore, kUI } from '../types';
import { Readable } from 'stream';
import { TransformCallback, obj } from 'through2';
import GraphStore from '../stores/graph-store';
import parse from 'csv-parse';
import Task from '../interfaces/task';
import UI from 'console-ui';

@injectable()
export default class ImportFeedTask implements Task {
  @inject(kGraphStore) graphStore: GraphStore;
  @inject(kUI) ui: UI;

  async run(): Promise<Readable> {
    const self = this;
    const session = this.graphStore.driver.session();
    const feed = join(process.cwd(), 'feed.csv');
    const parser = parse({ delimiter: ',' });

    return createReadStream(feed, { autoClose: true })
      .pipe(decodeStream('utf8'))
      .pipe(parser)
      .pipe(obj(
        async function (record: string[], enc: string, callback: TransformCallback) {
          const [gameDate, actualDate, title, content, link] = record;
          const result = await session.run(`CREATE (n:Article {gameDate: {gameDate}, actualDate: {actualDate}, title: {title}, content: {content}, link: {link}})`, { gameDate, actualDate, title, content, link });

          callback();
        },
        function (callback) {
          self.ui.stopProgress();
          self.ui.writeInfoLine('importing should be complete');

          session.close();

          callback();
        }
      ))
      .on('error', error => {
        self.ui.writeWarnLine('error storing article');
        self.ui.writeWarnLine(JSON.stringify(error, null, 2));
      })
      .on('end', () => {
        self.ui.writeInfoLine('importing stream should be complete');
      });
  }
}
