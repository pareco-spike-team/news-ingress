import { basename } from 'path';
import { inject, injectable } from 'inversify';
import { kDocumentStore, kUI } from '../types';
import { parse } from 'url';
import { Readable } from 'stream';
import { TransformCallback, obj } from 'through2';
import cheerio from 'cheerio';
import Article from '../interfaces/article';
import DocumentStore from '../stores/document-store';
import fetch from 'node-fetch';
import generateUuid from '../utils/uuid';
import intoStream from 'into-stream';
import iso8601 from '../utils/iso8601';
import Page from '../interfaces/page';
import Task from '../interfaces/task';
import wait from '../utils/wait';
import UI from 'console-ui';

@injectable()
export default class ScrapeGalnetTask implements Task {
  @inject(kDocumentStore) documentStore: DocumentStore;
  @inject(kUI) ui: UI;

  url: string = 'https://community.elitedangerous.com';
  indexPath: string = '/galnet'

  async run(): Promise<Readable> {
    const self = this;
    const articlesStore = this.documentStore.for('articles');
    const pagesStore = this.documentStore.for('pages');
    const $ = cheerio.load(await (await fetch(`${this.url}${this.indexPath}`)).text());
    const pages = $('section#block-frontier-galnet-frontier-galnet-block-filter a.galnetLinkBoxLink')
      .toArray()
      .map(element => element.attribs && element.attribs['href'])
      .filter(string => string)
      .map(path => `${this.url}${path}`);

    this.ui.writeInfoLine(`there are ${pages.length} page(s) to scrape...`);

    return intoStream(pages)
      .pipe(obj(
        async function (url: string, enc: string, callback: TransformCallback) {
          self.ui.startProgress('fetching articles');

          const page: Page = {
            _id: generateUuid(url),
            createdAt: iso8601(basename(parse(String(url)).path), '-'),
            url: String(url)
          }

          try {
            await pagesStore.put(page);
          } catch (error) {
            self.ui.writeWarnLine('error storing page');
            self.ui.writeWarnLine(error);
          }

          (await self.getArticles(url)).forEach(article => this.push(article));

          callback();
        }
      ))
      .pipe(obj(
        async function (article: Article, enc: string, callback: TransformCallback) {
          self.ui.startProgress('storing article');

          try {
            await articlesStore.put(article)
          } catch (error) {
            self.ui.writeWarnLine('error storing article');
            self.ui.writeWarnLine(error);
          }

          callback();
        },
        function(callback) {
          self.ui.stopProgress();
          self.ui.writeInfoLine('scraping should be complete');

          callback();
        }
      ));
  }

  async getArticles(url: string): Promise<Article[]> {
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
}
