import { basename } from 'path';
import { parse } from 'url';
import { TransformCallback, obj } from 'through2';
import * as cheerio from 'cheerio';
import * as moment from 'moment';
import fetch from 'node-fetch';
import intoStream from 'into-stream';
import store, { generateUuid } from './store';

const url = 'https://community.elitedangerous.com';
const indexPath = '/galnet'
const yearOffset = 1286;

interface Article {
  _id: string,
  createdAt: string,
  title: string,
  body: string,
  url: string
}

interface Page {
  _id: string,
  createdAt: string,
  url: string
}

function wait<T>(pass: T): Promise<T> {
  return new Promise(function(resolve, _) {
    setTimeout(function() {
      resolve(pass);
    }, 10);
  });
}

function iso8601(date: string, separator?: string): string {
  const s = (separator) ? separator : ' ';

  return moment(`${date} +0000`, `DD${s}MMM${s}YYYY Z`)
    .subtract(yearOffset, 'years')
    .toISOString();
}

async function getArticles(url): Promise<Article[]> {
  const response = await fetch((await wait(url)));
  const content = await response.text();
  const $ = cheerio.load(content)

  return $('div.article')
    .toArray()
    .map(element => {
      const block = cheerio(element);
      const link = block.find('a');
      const url = link.attr('href');
      const _id = generateUuid(url);
      const title = link.text().trim();
      const createdAt = iso8601(block.find('> div').first().text());
      const body = block.find('> p').first().text().trim();

      return { _id, createdAt, title, body, url };
    });
}

export default async function() {
  const articlesStore = store.for('articles');
  const pagesStore = store.for('pages');
  const $ = cheerio.load(await (await fetch(`${url}${indexPath}`)).text());
  const pages = $('section#block-frontier-galnet-frontier-galnet-block-filter a.galnetLinkBoxLink')
    .toArray()
    .map(element => element.attribs && element.attribs['href'])
    .filter(string => string)
    .map(path => `${url}${path}`);

  intoStream(pages)
    .pipe(obj(
      async function (url: string, enc: string, callback: TransformCallback) {
        console.log('fetching articles');

        const page: Page = {
          _id: generateUuid(url),
          createdAt: iso8601(basename(parse(String(url)).path), '-'),
          url: String(url)
        }

        try {
          await pagesStore.put(page);
        } catch (error) {
          console.log('error storing page');
          console.log(error);
        }

        (await getArticles(url)).forEach(article => this.push(article));

        callback();
      }
    ))
    .pipe(obj(
      async function (article: Article, enc: string, callback: TransformCallback) {
        console.log('storing article');

        try {
          await articlesStore.put(article)
        } catch (error) {
          console.log('error storing article');
          console.log(error);
        }

        callback();
      },
      function(callback) {
        console.log('should be finished...');

        callback();
      }
    ));
}
