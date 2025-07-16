export default function handleButton(element)
{
  let href = element.getAttribute("data-widget-conf-href");
  return `<button onclick="document.location='${href}'">${element.textContent}</button>`.toString();
}

//"<div data-widget-type=\"Button\" data-widget-conf-href=\"https://cnn.com/\" data-widget-conf-open-in-mobile-browser=\"false\" data-widget-src=\"internal://staffbase.content.widgets.Button\">Go to CNN</div>"