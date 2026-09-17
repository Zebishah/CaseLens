import { Actor } from 'apify';
import {
  actorInputSchema,
  type ActorInput,
} from '../integrations/apify/actor-input.schema.js';

const normalizeApifyInputDefaults = (input: unknown): unknown => {
  if (input === null || typeof input !== 'object' || Array.isArray(input)) {
    return input;
  }

  const inputRecord = input as Record<string, unknown>;
  if (inputRecord.type !== 'intelligence') return input;

  const normalizedInput = { ...inputRecord };
  delete normalizedInput.enqueueSiblingReprocess;
  delete normalizedInput.limit;
  delete normalizedInput.source;
  return normalizedInput;
};

export const loadActorInput = async (
  getInput: () => Promise<unknown> = () => Actor.getInput<unknown>(),
): Promise<ActorInput> => {
  const rawInput = await getInput();
  if (rawInput == null) {
    throw new Error('Actor input is missing.');
  }
  return actorInputSchema.parse(normalizeApifyInputDefaults(rawInput));
};
