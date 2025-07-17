import { JSDOM } from "jsdom";
import fs from "fs";
import logger from "./logger.js";
import config from "./config.js";
import { request } from "./requestContext.js";

async function resolveElement(element) {
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
  if (fileExistsSync(config.getControllerPath(elementName, req))) {
    // Compile the found controller
    try {
      controller = await import(
        config.getControllerImportPath(elementName, req)
      );
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
      if (!controllerReturnValue) {
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
  } else {
    templateData = config.defaultElementController(element, elementName, req);
  }

  // Template
  const pathToTemplate = config.getTemplatePath(elementName);
  if (fileExistsSync(pathToTemplate)) {
    const templateSource = fs.readFileSync(pathToTemplate, "utf8");
    const context = {
      data: templateData ?? element,
      elementName,
      query: req?.query,
      headers: req?.headers,
      url: req?.url,
    };
    replaceValue(
      element,
      await config.executeTemplate(templateSource, context)
    );
  } else {
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

export async function resolveHtml(html, propertyStack) {

  logger.info(`Resolving HTML with property stack: ${propertyStack ? propertyStack.join(" > ") : "<root>"}`);

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

export async function resolveObject(obj) {
  await traverseAndProcessHTML(obj, resolveHtml);
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

// This iterates every property on an object, recursively, including all elements in arrays, and executes a callback for each property value that is a string containing HTML.
// Disclaimer: this specific function was vibe-coded by ChaptGPT
async function traverseAndProcessHTML(obj, callback) {
  const isObject = (val) =>
    val && typeof val === "object" && !Array.isArray(val);

  async function recurse(current, path = []) {
    for (const key in current) {
      if (!current.hasOwnProperty(key)) continue;
      const value = current[key];
      const newPath = [...path, key];
      if (typeof value === "string" && /<\/?[a-z][\s\S]*>/i.test(value)) {
        current[key] = await callback(value, newPath); // <-- assign result back
      } else if (isObject(value)) {
        await recurse(value, newPath);
      } else if (Array.isArray(value)) {
        for (let index = 0; index < value.length; index++) {
          const item = value[index];
          if (isObject(item)) {
            await recurse(item, [...newPath, index]);
          } else if (
            typeof item === "string" &&
            /<\/?[a-z][\s\S]*>/i.test(item)
          ) {
            value[index] = await callback(item, newPath); // <-- assign result back
          }
        }
      }
    }
  }
  await recurse(obj);
}
