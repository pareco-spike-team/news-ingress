import fetch from 'node-fetch';
import * as cheerio from 'cheerio';
import * as moment from 'moment';
import { Readable } from 'stream';
import { TransformCallback, obj } from 'through2';

interface Article {
  id: string,
  body: string,
  postedAt: string,
  title: string
}

const url = 'https://community.elitedangerous.com';
const indexPath = '/galnet'
const yearOffset = 1286;

function wait<T>(pass: T): Promise<T> {
  console.log('waiting');
  return new Promise(function(resolve, _) {
    setTimeout(function() {
      resolve(pass);
    }, 1000)
  });
}

function iso8601(date: string) {
  return moment(`${date} +0000`, 'DD MMM YYYY Z').subtract(yearOffset, 'years').toISOString();
}

async function getArticles(url): Promise<Article[]> {
  const content = await (await fetch((await wait(url)))).text();
  const $ = cheerio.load(content)

  return $('div.article')
    .toArray()
    .map(element => {
      const block = cheerio(element);
      const link = block.find('a');

      const id = link.attr('href');
      const title = link.text();
      const postedAt = iso8601(block.find('> div').first().text());
      const body = block.find('> p').first().text();

      return { id, body, postedAt, title };
    });
}

export default async function() {
  const $ = cheerio.load(await (await fetch(`${url}${indexPath}`)).text());
  const pages = $('section#block-frontier-galnet-frontier-galnet-block-filter a.galnetLinkBoxLink')
    .toArray()
    .map(element => element.attribs && element.attribs['href'])
    .filter(string => string)
    .map(path => `${url}${path}`);

  const readable = new Readable();

  readable.pipe

  pages.forEach(async page => await getArticles(page));
}
