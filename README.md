# API Proxy Resolver

This is a web server/service that will:

1. Accept an HTTP request (presumed to be an API request)
2. Proxy that request to another endpoint
3. Inspect and modify the HTML content of the returned JSON object before returning it to the caller

The purpose: to allow the correction or "resolution" of HTML before being returned to the client, in situations where the HTML from the origin API includes element structures not compatible with that client (example: web components which are unsupported in the cient).

Essentially it sits "between" a client and an API to translate HTML included in that respponse.

This is not JSONata -- this doesn't transform the structure of the JSON itself. Rather, it examines that JSON for HTML in specific properties, and it changes _that_.

>Note that this tool was originally developed as a research project around the Staffbase API. However, its purpose and function turned out to be generic to any web-based API.

## The config Object

The object in `config.js` has a set of functions that comprise all necessary customizations to implement the proxy in your own enviroment. You shouldn't need to modify the main app files.

The functions in this file are clearly documented. Most will be discussed below.

## Proxying the Request

Any inbound request is passed to `config.getModifiedRequest()`. That function should return an [Axios config object](https://axios-http.com/docs/req_config) representing the request to be made to the origin API.

Most often, you'll simply change the URL to a new host, but you're free to do whatever you want to the URL, add headers, etc.

## Identifying the objects in the response

The JSON response from the origin will be parsed into an object and passed to `config.getObjectReferences()`. That function should return an array representing the individual objects to be examined.

## Identifying the HTML properties to resolve

`config.getPropertyPaths()` should return an array of "paths" to the properties that need to be examinded the correct. These paths are a series of property names, seperated by forward slashes.

>Note: this is one part I'm not sure about. I considered using JSONata, which has query capabilities, but I need to parse it into an object, so I'm not sure how well that would work. This works for now, but should be examined in the future.

The "leaf" properties at the end of each path string are assumed to be HTML and will be parsed and resolved.

## Identifying the elements in the HTML to resolve

The HTML from each property will be parsed, and every element will be passed to `config.isResolvableElement()`. If this returns `true`, the app will attempt to resolve that element.

## How elements are resolved

This app uses JSDOM under the hood. Element resolution will work off the element as an extracted node.

The element will be passed to `config.getElementName()` to identify the element by a simple text string.

The app will use this name to look for two files:

1. **Controller:** The element name will be passed to `config.getControllerPath()`. That function should return a file path to a JS file, or null if no controller exists. This JS file should have a default export that takes the JSDOM node as input. What it returns depends on whether or not there's a template file. If there's a template file, the controller should return an object representing data to be processed by the template. If there's no template file, the controller should return a string represending the HTML to swap in.

2. **Template:** The element name will be passed to `config.getTemplatePath()`. That function should return a file path to a Liquid file, or null if no template exists. The input to this template will be either the output of the controller, or the entire tag from JSDOM.

Using these two files, the app will calculate an alternative fragment of HTML to swap in for the original element.

The four possible resolution scenarios:

- **Both controller and template:** The app will pass the entire element to the default function of the controller and pass the output to the template under the key of `data`. The template output will be swapped in for the original element.

- **Controller only:** The app will pass the entire element to the default controller function and swap the output in for the original element.

- **Template only:** The app will pass the entire element to the template under the key of `data` and swap the output in for the original element.

- **Neither template nor controller:** The app will pass the entire element to the function in `config.unknownElementController()` and swap the output in for the original element.

## Finishing up

Once all HTML and objects are resolved, a few logging properties are added to the response, and it is sent back as JSON.

## Random Notes

### Can I just resolve raw HTML strings instead of proxying an API call?

Sure. `config.getHtmlEndpoint()` will provide an API to which you can POST your HTML as the raw body of the request. That HTML will be resolved according to the same process defined above, and sent back in the response.

>For some users, this might be the only thing used. It exposes the general HTML transformation logic. In those situations, the API proxy and JSON inspection parts of the app can simply be ignored.

You can shut this feature off by just returning `null` from `config.getHtmlEndpoint()`.

### How can I return different HTML resolutions for different channels?

Yes. The request is globally available, using AsyncLocalStorage. To get the request context in any code:

```
import { request } from "./requestContext.js";
const req = request.get();
```

If you call your API with a querystring argument --

```
https://api.myapp.com/api/get-something/123?channel=mobile
```

Then you can get that querystring argument --

```
let channel = req.query.channel;
```

Using that, you can --

1. Return a different controller or template path from `config.getControllerPath()` or `config.getTemplatePath()`
2. Alter your logic in any controller
3. Use the request values in your template, which are passed in as `query`, `headers`, and `url` (in the example, use `query.channel`)

### Do my controllers and templates have to be part of the project/codebase?

No. `config.getControllerPath()` and `config.getTemplatePath()` can return absolute paths to wherever those files are located.

### What are naming conventions for the controller and template files?

That's up to you. Clearly, you're going to use the element name in some form, but you control what `config.getControllerPath` and `config.getTemplatePath` return, so do whatever you like.

>Should those methods return strings (the file contents) instead of paths? Is it wrong to assume the code will always be on the local file system? Maybe you might want to get code from somewhere else?

### Can I only identify elements by tag name?

Not necesarily. `config.isElementResolvable()` gets the entire element, and it can do whatever it wants to figure out if the element needs to be resolved -- it can examine the tag name, attributes, content, time of day, phases of the moon, whatever.

`config.getElementName()` needs to identify/categorize an element by a text string, as this is passed to the pathing methods to find the controller and template files. This is essentially how you map resolvable elements to logic. But how you derive that text string from the tag structure is totally up to you.

### What if I want to remove elements rather than swap them?

Just return "falsy" (`null`, `false`, `undefined`, etc.) from the controller. The element will be removed and nothing put in its place.

Alterrnately, you can return `null` from `config.unknownEventController()`. This remove any element that doesn't have file-based controller, effectively allowing you to "whitelist" elements you want to handle (by creating controllers for them), and getting rid of everything else.

There will be no trace of the elements that were removed. If you want to retain some record of them, return an HTML comment explaining what happened. For example, `return '<!-- Removed element ${elementName} -->';`

You can also "comment out" the entire element by returning `<!-- ${element.outerHTML} -->`.

### What if I want to leave an element alone?

Well, ideally don't mark it as resolvable -- meaning don't return true from `config.isElementResolvable()` -- and it will be ignored.

If for whatever reason, you need to make a single exception, return `element.outerHTML` from the controller. You'll essentially replace it with itself.