import { AsyncLocalStorage } from "async_hooks";

const requestContext = new AsyncLocalStorage();

export function setRequestContext(req) {
  return requestContext.run(req, () => {});
}

export function getRequestContext() {
  return requestContext.getStore();
}

// Create a request variable helper
export const reqVar = {
  set: (req) => requestContext.enterWith(req),
  get: () => requestContext.getStore(),
};
