export default function handleInfobox(tag) {
  const title = tag.querySelector("h1").textContent;
  tag.querySelector("h1").remove();

  const body = tag.innerHTML;

  return {
    title,
    body,
  };
}
