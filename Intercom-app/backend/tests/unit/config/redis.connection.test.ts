import {
  buildRedisClientOptions,
  parseRedisUrlToOptions
} from '../../../src/config/redis.connection.js';

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

  it('uses bounded lazy settings for API cache and rate-limit clients', () => {
    expect(buildRedisClientOptions('rediss://default:secret@example.upstash.io:6379')).toMatchObject({
      host: 'example.upstash.io',
      tls: {},
      maxRetriesPerRequest: 1,
      enableReadyCheck: true,
      enableOfflineQueue: true,
      lazyConnect: true,
      connectTimeout: 3_000,
      commandTimeout: 3_000
    });
  });
});
