import { parseRedisUrlToOptions } from '../../../src/config/redis.connection.js';

describe('redis.connection', () => {
  it('parses local redis urls for BullMQ', () => {
    expect(parseRedisUrlToOptions('redis://localhost:6379')).toMatchObject({
      host: 'localhost',
      port: 6379,
      maxRetriesPerRequest: null,
      enableReadyCheck: false
    });
  });

  it('parses upstash redis urls with auth and tls', () => {
    expect(
      parseRedisUrlToOptions('rediss://default:secret%21@example.upstash.io:6379')
    ).toMatchObject({
      host: 'example.upstash.io',
      port: 6379,
      username: 'default',
      password: 'secret!',
      tls: {}
    });
  });
});
