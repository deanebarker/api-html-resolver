import { AsyncLocalStorage } from "async_hooks";

const requestContext = new AsyncLocalStorage();

// Create a request variable helper
export const request = {
  set: (req) => requestContext.enterWith(req),
  get: () => requestContext.getStore(),
};