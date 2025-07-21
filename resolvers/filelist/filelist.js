export default function handleFileList(element, elementName, req) {
  const onCard = element.dataset.widgetOnCard;
  const files = [];

  for (const file of element.querySelectorAll("li")) {
    const href = file.querySelector("a").href;
    const url = new URL(href);
    const filename = url.pathname.split("/").pop();

    files.push({
      name: file.querySelector("a").textContent,
      url: filename,
      type: file.dataset.type,
    });
  }

  return {
    onCard,
    files,
  };
}

/*
Sample element:

<div data-widget-type="FileList" data-widget-on-card="true"
    data-widget-src="internal://staffbase.content.widgets.FileList">
    <ul>
        <li data-type="jpg" data-update-time="2025-04-09T00:00:00-05:00"><a
                href="https://app.staffbase.com/api/media/secure/external/v2/image/upload/67f6cb634f035e05940d6550.jpg?accessorId=token_6878361a875ee8600cc90616&media_token=TJtSeqBsqgSNvFTUEibksnQgWDLIOlUrtrBHJP0pmdk%3D">2025-03-12_19.48.11.jpg</a>
        </li>
        <li data-type="jpg" data-update-time="2024-08-15T00:00:00-05:00"><a
                href="https://app.staffbase.com/api/media/secure/external/v2/image/upload/66bdff6aee04cc72e7fad2f6.jpg?accessorId=token_6878361a875ee8600cc90616&media_token=Q8CWhrW74ZhrMkaqGqJUgqqgevOnR1%2B8JUHhlxEEfy0%3D">istockphoto-1388256628-612x612.jpg</a>
        </li>
    </ul>
</div>

*/
