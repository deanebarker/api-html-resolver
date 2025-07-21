# API Proxy Resolver

This is a web server/service that will:

1. Accept an HTTP request (presumed to be an API request)
2. Proxy that request to another endpoint
3. Inspect and modify the HTML content of the returned JSON object before returning it to the caller

The purpose: to allow the correction or "resolution" of HTML before being returned to the client, in situations where the HTML from the origin API includes element structures not compatible with that client (example: web components which are unsupported in the cient).

Essentially it sits "between" a client and an API to translate HTML included in that respponse.

This is not JSONata -- this doesn't transform the structure of the JSON itself. Rather, it examines that JSON for HTML in specific properties, and it changes _that_.

> Note that this tool was originally developed as a research project around the [Staffbase](https://staffbase.com/) API. However, its purpose and function turned out to be generic to any web-based API, and the logical method of HTML "resolution" is independent of even an API contact -- at its base level, it's just creative string manipulation.

## The config Object

The object in `config.js` has a set of functions that comprise all necessary customizations to implement the app in your own enviroment. You shouldn't need to modify the main app files outside of `config.js`.

The functions in that file are discussed below.

The existing `config.js` has been used against the Staffbase API specifically, but should make sense in the context of anything else.

## Proxying the Request

Any inbound request (except one route; see below) is passed to `config.getModifiedRequest()`. That function should return an [Axios config object](https://axios-http.com/docs/req_config) representing the request to be made to the origin API.

Most often, you'll simply change the URL to a new host, but you're free to modify the URL, the headers, the querystring, whatever.

## Identifying the elements in HTML to resolve

The response object will be inspected and properties containing HTML will be automatically identified.

The HTML from each identified property will be parsed, and every element will be passed to `config.isResolvableElement()`. If this function returns truthy, the app will attempt to resolve that element.

## How elements are resolved

The app uses JSDOM under the hood. Element resolution will work off the element as an extracted node.

The element will be passed to `config.getElementName()` to identify the element by a simple text string.

The app will use this name to look for two files:

1. **Controller:** The element name and request object will be passed to `config.getControllerPath()`. That function should return an array of file paths to a JS file, or an empty array if no controller exists. The app will use the first controller file that it finds.

2. **Template:** The element name and request object will be passed to `config.getTemplatePath()`. That function should return an array of file paths to a template file, or an empty array if no template exists. The app will use the first template file that it finds.

The **controller** is must default export a function that takes the following params, in this order:

1. The entire JSDOM node representing the element
2. The element name, as a string
3. The entire request object from Express

It can return anything. If there's a template file, whatever it returns will be passed to the template as input. If there's no template file, whatever it returns will be swapped for the original element as a string.

If no controller is found, `config.defaultElementController()` will be used.

The **template** is a file containing template source. If this file exists, the app will create an object:

```javascript
{
  data: [whatever the controller output, or the JSDOM node if there's no controller],
  elementName: [the name of the element as a string],
  query: [the querystring from the request object],
  url: [the URL from the request object],
  headers: [the headers from the request object]
}
```

> The request object is broken apart because some templating languages (ahem, Liquid...) have issues allowing access to that object.

This object and the source code from the template file will be passed to `config.executeTemplate()`. That function should execute whatever templating process it likes, then return the resulting string.

So, there are four possible resolution scenarios:

- **Both controller and template:** The app will pass the entire element to the default function of the controller and pass the output to the template under the key of `data`. The template output will be swapped in for the original element.

- **Controller only:** The app will pass the entire element to the default controller function and swap the output in for the original element.

- **Template only:** The app will pass the entire element to the template under the key of `data` and swap the output in for the original element.

- **Neither template nor controller:** The app will pass the entire element to the function in `config.unknownElementController()` and swap the output in for the original element.

Example element to be resolved

```html
<user-profile data-user-id="123"></user-profile>
```

Example controller: **userProfile.js**. This gets the entire element as a JSDOM node, the name of the element as a string, and the inbound request from Express.

```js
export default function handleUserProfile(element, elementName, req)
{
  let id = element.dataset.userId;
  let userData = await fetch("https://myapi.com/users/" + id);
  // { firstName: "Deane", lastName: "Barker" }
  userData.id = id;
  return userData;
}
```

Example Template: **userProfile.liquid**. This gets an object with the output of the controller above as the `data` key, the original element as the `elementName` key, and request data under `query`, `url`, and `headers`.

```twig
<div class="user-card">
    <label>First Name</label> {{ data.firstName }}
    <label>Last Name</label> {{ data.lastName }}
    <p>
      <a href="/profile/{{ data.id}}">View Profile</a>
    </p>
</div>
```

Whatever is produced from the above process will be passed to `config.getResolutionFragment()`. That method needs to return _valid HTML_ which will be swapped in for the original element.

In the example `config.js`, existing HTML is passed back verbatim, while raw text strings are wrapped in a `div`.

## Finishing up

Once all HTML properties are resolved, a few logging properties are added to the response, and it is sent back as JSON.

## Random Notes

### Can I just resolve raw HTML strings instead of proxying an API call?

Sure. `config.getHtmlEndpoint()` will provide a route to which you can POST your HTML as the raw body of the request. That HTML will be resolved according to the same process defined above, and sent back in the response.

This might be handy for non-API processes, like webhook engines, that need to export HTML in some other method.

Note that for some users, this might be the only thing used. It exposes the general HTML transformation logic. In those situations, the API proxy and JSON inspection parts of the app can simply be ignored.

You can shut this feature off by just returning `null` from `config.getHtmlEndpoint()`.

### Can I import the resolution code into my own JavaScript?

...yes? I haven't tried it, but all the resolution stuff is in `resolver.js`, and that exports both `resolveObject()` and `resolveHtml()`. You won't have access to the request object, clearly, but all references to that are null-safe, so it should still work.

### Can I return different HTML resolutions for different channels?

Yes. The request is globally available, using AsyncLocalStorage. To get the request context in any code:

```javascript
import { request } from "./requestContext.js";
const req = request.get();
```

If you call your API with a querystring argument --

`https://api.myapp.com/api/get-something/123?channel=mobile`

Then you can get that querystring argument --

```javascript
let channel = req.query.channel;
```

Using that, you can --

1. Form a different set of potential controller or template paths from `config.getControllerPath()` or `config.getTemplatePath()`
2. Alter your logic in any controller
3. Use the request values in your template, which are passed in as `query`, `headers`, and `url` (in the example, you would reference `query.channel`)

### Do my controllers and templates have to be part of the project/codebase?

No. `config.getControllerPath()` and `config.getTemplatePath()` can return absolute paths to wherever those files are located, they just have to be accessiable to Node.

> QUESTION: Should those methods return strings (the file contents) instead of paths? Is it wrong to assume the code will always be on the local file system? Maybe you might want to get code from somewhere else? However, would importing strings rather than a file path make any imports inside the controller problematic?

### What are naming conventions for the controller and template files?

That's up to you. You're probably going to use the element name in some form, but you control what `config.getControllerPath()` and `config.getTemplatePath()` return, so do whatever you like.

### What templating engine can I use?

Anything you like (the example uses LiquidJS). `config.executeTemplate()` gets the template source and the data object. Do whatever you want in here and return a string.

You can even use more than one. The path to the template file is passed into `config.executeTemplate()` so you can make template engine decisions based on on the file extension of the template.

### Can I only identify resolvable elements by tag name?

Not necesarily. `config.isElementResolvable()` gets the entire element, and it can do whatever it wants to figure out if the element needs to be resolved -- it can examine the tag name, attributes, content, time of day, phases of the moon, whatever.

`config.getElementName()` needs to identify/categorize an element by a text string, as this is passed to the pathing methods to find the controller and template files. This is essentially how you map resolvable elements to logic. But how you derive that text string from the tag structure is totally up to you.

### What if I want to remove elements rather than swap them?

Just return falsy from the controller. The element will be removed and nothing put in its place.

Alternately, you can return falsy from `config.unknownEventController()`. This remove any element that doesn't have file-based controller, effectively allowing you to "whitelist" elements you want to handle (by creating controllers for them), and getting rid of everything else.

There will be no trace of the elements that were removed. If you want to retain some record of them, return an HTML comment explaining what happened. For example

```javascript
return ` <!-- Removed element ${elementName} -->`;
```

You can also "comment out" the entire element by simply returning

```javascript
return ` <!-- ${element.outerHTML} -->`;
```

**Important:** _You must include at least a leading or trailing space when returning an HTML comment_, because JSDOM will not parse a comment all by itself. To JSDOM, a string containing nothing but an HTML content is nothing, and it will parse it as `null`.

### What if I want to leave an element alone?

Well, ideally just don't mark it as resolvable -- meaning don't return truthy from `config.isElementResolvable()` -- and it will be ignored.

If for whatever reason, you need to make a single exception, return `element.outerHTML` from the controller and you'll essentially replace itthe element with itself.

### What if I try to resolve an element that was removed by a previous resolution?

All elements are identified for resolution before any of them are actually resolved.

> QUESTION: Should it be this way? I'm not sure, but I think so, because otherwise I think I'd need to re-parse the HTML after every resolution.

So, if Element A is marked for resolution, and it contains Element B which is _also_ marked for resolution, then resolving Element A will remove Element B from the document, even though Element B is still sitting in the resolution queue.

But ...this should just be inefficient, I think? Element B technically still "exists," but it's no longer attached to the original document -- so, it's just hanging out in memory. So you'll still resolve it, but it won't matter.

> QUESTION: Should I solve for this? How common will this scenario be?

### What if I include a resolvable element in the fragment used for the resolution of another element?

...don't. You certainly can, but the resolvable element you swap in won't be resolved.

> QUESTION: Should I solve for this? Technically, I could keep resolving until no resolvable elements are still present -- so, I could make multiple "passes" over the HTML. But this could lead to a circular reference and infinite loop, and it seems like an edge case.

### How is the performance?

No idea, but it likely depends on what you do in the controllers. Maybe use a caching layer?

(It wouldn't be hard to add crude caching, but the trick is always in the details. Cache subtleties can be really painful...)
