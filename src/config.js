import { JSDOM } from "jsdom";
import { Liquid } from "liquidjs";

export default {
  getPort: () => {
    return process.env.PORT || 3000;
  },

  getHtmlEndpoint: () => {
    return "/resolve-html";
  },

  // Modifies the request URL if needed
  getModifiedRequest: (req) => {
    const TARGET_URL = "https://app.staffbase.com";
    const url = `${TARGET_URL}${req.originalUrl}`;

    return {
      method: req.method,
      url,
      headers: { ...req.headers, host: new URL(TARGET_URL).host },
      data: req.body,
      validateStatus: () => true, // Allow handling of all status codes
    };
  },

  // This is the controller that executes when no controller can be found
  defaultElementController: (element, elementName, req) => {
    return `<!-- Unknown element: ${elementName} -->`;
  },

  // Returns true if this element needs to be resolved
  isResolvableElement: (element) => {
    return (
      element.hasAttribute("data-widget-type") || element.tagName.includes("-")
    );
  },

  // Returns a string representing the name of the element. This will be used to find the controller and/or the template.
  getElementName: (tag) => {
    let elementName = tag.getAttribute("data-widget-type");
    if (!elementName) {
      elementName = tag.tagName;
    }
    return elementName.toLowerCase();
  },

  // Returns the file path of the controller
  // This is relative to the app root
  getControllerPath: (elementName) => {
    return "./resolvers/" + elementName + "/" + elementName + ".js";
  },

  // Returns the import path of the controller (which might be different than the file path)
  // This has to be relative to the resolver.js file
  getControllerImportPath: (elementName) => {
    return "../resolvers/" + elementName + "/" + elementName + ".js";
  },

  // Returns the file path of the template
  getTemplatePath: (elementName) => {
    return "./resolvers/" + elementName + "/" + elementName + ".liquid";
  },

  // Executes the template with the given source and context and returns the result
  executeTemplate: async (source, context) => {
    const engine = new Liquid();
    return await engine.parseAndRender(source, context);
  },

  // Returns valid HTML to swap for the resolved element
  getResolutionFragment: (element, elementName, content) => {
    if (content[0] === "<" && content[content.length - 1] === ">") {
      // If the content is parsable HTML, we return it as is
      const dom = new JSDOM(content);
      const document = dom.window.document;
      return document.body.firstChild;
    }

    const container = element.ownerDocument.createElement("div");
    container.setAttribute("data-resolved-from", elementName);
    container.innerHTML = content;

    return container;
  }
};
