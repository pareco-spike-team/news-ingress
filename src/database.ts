import env from './env';
import neo4j from 'neo4j-driver';

const username = env.optional('neo4j.username');
const password = env.optional('neo4j.username');

const authToken = (username && password) ? neo4j.auth.basic(username, password) : null;

const driver = neo4j.driver(env.required('neo4j.url'), authToken);

process.on('beforeExit', _ => driver.close());

export default driver;
