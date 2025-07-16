import { JSDOM } from "jsdom";
import fs from "fs"
import logger from "./logger.js";
import config from "./config.js";
import { request } from "./requestContext.js";


async function resolveElement(element)
{


  /*
    Possible paths to resolution:

    1. Controller exists; template does not: use controller output as resolution
    2. Controller does not exist; template exists: pass element into template and use template output as resolution
    3. Controller exists; Liquid template exists: pass element and widget name into controller, use controller output as input to template, use template output as resolution
    
    If neither exists, it will be routed to the unknown resolver, which will just return the element as is.
    */

  const req = request.get();

  // Determine the element name
  const elementName = config.getElementName(element, req);
  logger.info("Resolving element: " + elementName);

  let templateData = element; // We might replace this with the output of the controller

  // Controller
  let controller;
  if (fileExistsSync(config.getControllerPath(elementName, req)))
  {
    // Compile the found controller
    try {
      controller = await import(config.getControllerImportPath(elementName, req));
    } catch (err) {
      logger.error(
        "Error compiling controller for " + elementName + ": " + err.message
      );
      return;
    }

    // Execute the controller
    try {
      let controllerReturnValue = await controller.default(
        element,
        elementName,
        req
      );

      // If the controller returns false, we remove the element
      if (!controllerReturnValue)
      {
          element.remove();
          return;
      }
      templateData = controllerReturnValue;
    } catch (err) {
      logger.error(
        "Error executing controller for " + elementName + ": " + err.message
      );
      return;
    }
  }
  else
  {
    templateData = config.unknownElementController(element, elementName);
  }

  // Template
  const pathToTemplate = config.getTemplatePath(elementName);
  if (fileExistsSync(pathToTemplate))
  {
    const templateSource = fs.readFileSync(pathToTemplate, "utf8");
    const context ={
        data: templateData ?? element,
        elementName,
        query: req?.query,
        headers: req?.headers,
        url: req?.url
      }
    replaceValue(
      element,
      await config.executeTemplate(templateSource, context)
    );
  }
  else
  {
    replaceValue(element, templateData);
  }

  // Replaces the original element with the new content
  function replaceValue(element, newContent) {
    const fragment = config.getResolutionFragment(
      element,
      elementName,
      newContent
    );
    element.replaceWith(fragment);
  }
}

export async function resolveHtml(html)
{
  const dom = new JSDOM(html);
  const document = dom.window.document;
  const allElements = Array.from(document.querySelectorAll("*"));

  let elementsToResolve = allElements.filter((el) =>
    config.isResolvableElement(el)
  );

  await Promise.all(
    elementsToResolve.map((element) => resolveElement(element))
  );
  return document.body.innerHTML;
}

export async function resolveObject(obj)
{
  //await traverseAndModifyAll(obj, "contents/en_US/content", resolveHtml);
  const pathsToResolve = config.getPropertyPaths();
  for(const path of pathsToResolve)
  {
    await traverseAndModifyAll(obj, path, resolveHtml);
  }
  console.log("Returning object");
  return obj;
}

function fileExistsSync(filePath) {
  try {
    return fs.existsSync(filePath) && fs.statSync(filePath).isFile();
  } catch (err) {
    return false;
  }
}

function folderExistsSync(folderPath)
{
    const exists = fs.existsSync(folderPath);
    if(!exists) return false;

    const isDirectory = fs.statSync(folderPath).isDirectory();
    if(!isDirectory) return false;

    return true;
}

// This sucks...
async function traverseAndModifyAll(obj, pathStr, callback) {
  // Clean up the path string: remove leading/trailing slashes and split
  const pathSegments = pathStr.replace(/^\/+|\/+$/g, "").split("/");

  async function search(current, pathIndex) {
    if (typeof current !== "object" || current === null) return;

    for (const [key, value] of Object.entries(current)) {
      if (key === pathSegments[pathIndex]) {
        if (pathIndex === pathSegments.length - 1) {
          current[key] = await callback(value); // full match
        } else if (typeof value === "object" && value !== null) {
          await search(value, pathIndex + 1);
        }
      }

      // Search unrelated branches too
      if (typeof value === "object" && value !== null) {
        await search(value, 0);
      }
    }
  }

  await search(obj, 0);
}
