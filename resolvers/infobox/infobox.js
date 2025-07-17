export default function handleInfobox(element) {
  const title = element.querySelector("h1").textContent;
  const onCard = element.dataset.widgetOnCard === "true";
  const type = element.dataset.widgetConfType;
  element.querySelector("h1").remove();

  return {
    title,
    body: element.innerHTML.trim(),
    onCard,
    type
  };
}

/*
Sample tag:

<div data-widget-type=\"Infobox\" data-widget-on-card=\"true\" data-widget-conf-type=\"warning\"
    data-widget-src=\"internal://staffbase.content.widgets.Infobox\">
    <h1>This is an Infobox</h1>
    <p>This is some content inside the infobox.</p>
</div>
*/
