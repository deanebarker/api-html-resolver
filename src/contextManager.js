import { AsyncLocalStorage } from "async_hooks";

const contextManager = new AsyncLocalStorage();

export function initContext(req) {
  contextManager.enterWith(
    {
      req,
      notes: [],
      errors: [],
    }
  );
}

export function addNote(note) {
  const context = contextManager.getStore();
  context.notes.push(note);
  contextManager.enterWith(context);
}

export function addError(error) {
  const context = contextManager.getStore();
  context.errors.push(error);
  contextManager.enterWith(context);
}

export function getContext() {
  return contextManager.getStore();
}