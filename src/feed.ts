import { createReadStream } from 'fs';
import { decodeStream } from 'iconv-lite';
import { join } from 'path';
import { TransformCallback, obj } from 'through2';
import * as parse from 'csv-parse';
import database from './database';

export default function() {
  const session = database.session();
  const feed = join(process.cwd(), 'feed.csv');
  const parser = parse({ delimiter: ',' });

  createReadStream(feed, { autoClose: true })
    .pipe(decodeStream('utf8'))
    .pipe(parser)
    .pipe(obj(
      async function (record: string[], enc: string, callback: TransformCallback) {
        const [gameDate, actualDate, title, content, link] = record;
        const result = await session.run(`CREATE (n:Article {gameDate: {gameDate}, actualDate: {actualDate}, title: {title}, content: {content}, link: {link}})`, { gameDate, actualDate, title, content, link });

        callback();
      },
      function (callback) {
        console.log('should be finished');
        session.close();

        callback();
      }
    ))
    .on('error', error => console.error(error))
    .on('end', () => console.log('finished.'));
}
