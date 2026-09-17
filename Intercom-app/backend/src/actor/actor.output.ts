import { Actor } from 'apify';

export const writeActorOutput = async (output: unknown): Promise<void> => {
  await Actor.setValue('OUTPUT', output);
};
