import express from "express";
import axios from "axios";
import { resolveObject, resolveHtml } from "./resolver.js";
import logger from "./logger.js";
import config from "./config.js";
import { addNote, getContext, initContext } from "./contextManager.js";

const app = express();
app.use(express.json()); // to support JSON-encoded bodies
app.use(express.urlencoded({ extended: true })); // to support URL-encoded bodies

// This is for simple HTML, no proxy
if (config.getHtmlEndpoint()) {
  app.use(config.getHtmlEndpoint(), express.raw({ type: "*/*" }));
  app.post(config.getHtmlEndpoint(), async (req, res) => {
    initContext(req);

    try {
      const result = await resolveHtml(req.body);
      res.status(200).send(result);
    } catch (err) {
      logger.error(`Error resolving HTML: ${err}`);
      res.status(500).send("Error resolving HTML");
    }
  });
}


// This is for a proxied API call
app.use(async (req, res) => {
initContext(req);

  logger.info(`Received request: ${req.method} ${req.originalUrl}`);

  try {
    // Transform the existing request to point at the origin
    let newConfig = config.getModifiedRequest(req);

    // Make the origin request
    const tsStartOriginRequest = Date.now();
    const response = await axios(newConfig);
    addNote(`Origin request time: ${Date.now() - tsStartOriginRequest} ms`);

    // Resolve the response data
    const tsStartResolution = Date.now();
    await resolveObject(response.data);
    addNote(`Resolution time: ${Date.now() - tsStartResolution} ms`);

    // Send resolved request back
    response.data._log = {
      notes: getContext().notes,
      errors: getContext().errors,
    };
    res.status(response.status).set(response.headers).send(response.data);
  } catch (err) {
    logger.error(`Error processing request: ${err}`);
    res.status(500).send("Proxy error");
  }
});

app.listen(config.getPort(), () => {
  console.log(`Proxy server running on http://localhost:${config.getPort()}`);
});
