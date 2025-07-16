import express from "express";
import axios from "axios";
import { resolveObject, resolveHtml } from "./resolver.js";
import logger from "./logger.js";
import config from "./config.js";

const app = express();
app.use(express.json()); // to support JSON-encoded bodies
app.use(express.urlencoded({ extended: true })); // to support URL-encoded bodies

// This is for simple HTML, no proxy
if(config.getHtmlEndpoint())
{
  app.use(config.getHtmlEndpoint(), express.raw({ type: "*/*" }));
  app.post(config.getHtmlEndpoint(), async (req, res) =>
  {
    try
    {
      const result  = await resolveHtml(req.body, req);
      res.status(200).send(result);
    }
    catch (err)
    {
      logger.error(`Error resolving HTML: ${err}`);
      res.status(500).send("Error resolving HTML");
    }
  });
}

// This is for a proxied API call
app.use(async (req, res) =>
{
  res.locals.log = [];
  logger.info(`Received request: ${req.method} ${req.originalUrl}`);

  try
  {  
    // Transform the existing request to point at the origin
    let newConfig = config.getModifiedRequest(req);

    // Make the origin request
    const tsStartOriginRequest = Date.now();
    const response = await axios(newConfig);
    res.locals.log.push(
      `Origin request time: ${Date.now() - tsStartOriginRequest} ms`
    );

    // Resolve the response data
    const tsStartResolution = Date.now();
    await Promise.all(config.getObjectReferences(response.data).map((obj) => resolveObject(obj, req)));
    res.locals.log.push(`Resolution time: ${Date.now() - tsStartResolution} ms`);

    // Send resolved request back
    response.data._log = res.locals.log;
    res.status(response.status).set(response.headers).send(response.data);
  }
  catch (err)
  {
    logger.error(`Error processing request: ${err.message}`);
    res.status(500).send("Proxy error");
  }
});

app.listen(config.getPort(), () =>
{
  console.log(`Proxy server running on http://localhost:${config.getPort()}`);
});
