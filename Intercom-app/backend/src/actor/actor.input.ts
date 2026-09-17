import { Actor } from 'apify';
import {
  actorInputSchema,
  type ActorInput,
} from '../integrations/apify/actor-input.schema.js';

export const loadActorInput = async (
  getInput: () => Promise<unknown> = () => Actor.getInput<unknown>(),
): Promise<ActorInput> => {
  const rawInput = await getInput();
  if (rawInput == null) {
    throw new Error('Actor input is missing.');
  }
  return actorInputSchema.parse(rawInput);
};
