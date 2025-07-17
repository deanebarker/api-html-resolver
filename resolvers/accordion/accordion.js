export default function handleAccordion(element, elementName, req) {
  const items = [];
  for(const item of element.querySelectorAll("div[data-panel]")) {
    items.push({
      title: item.querySelector("div[data-title]").innerHTML,
      content: item.querySelector("div[data-content]").innerHTML
    });
  }

  return {
    items
  }
}


/* 

Sample element:

<div data-widget-type="Accordion" data-widget-src="internal://staffbase.content.widgets.Accordion">
    <div data-panel="">
        <div data-title="">Foo</div>
        <div data-content="">This is some content for foo.</div>
    </div>
    <div data-panel="">
        <div data-title="">Bar</div>
        <div data-content="">This is some content for bar.</div>
    </div>
</div>

*/