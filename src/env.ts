import { EnvConfig } from '@atsjj/env-config';

const target = process.env && process.env['NODE_ENV'] || 'development';
const envConfig = new EnvConfig('news.ingress', target);

export default envConfig;
