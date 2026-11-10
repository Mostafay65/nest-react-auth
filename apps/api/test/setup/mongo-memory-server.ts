import { MongoMemoryServer } from 'mongodb-memory-server';
import type { TestProject } from 'vitest/node';

declare module 'vitest' {
  export interface ProvidedContext {
    mongoUri: string;
  }
}

/** One in-memory MongoDB for the whole e2e run. Each test file gets its own database. */
export default async function startMongo(project: TestProject): Promise<() => Promise<void>> {
  const mongo = await MongoMemoryServer.create();
  project.provide('mongoUri', mongo.getUri());

  return async () => {
    await mongo.stop();
  };
}
