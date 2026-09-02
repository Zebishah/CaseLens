import { v4 as uuidv4 } from 'uuid';

const store: Array<{ id: string; message: string }> = [];

export const exampleService = {
  async getAll() {
    return store;
  },
  async create(message: string) {
    const record = { id: uuidv4(), message };
    store.push(record);
    return record;
  }
};
