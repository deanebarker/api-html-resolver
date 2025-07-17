export default async function getUserName(userProfileTag, elementName, req)
{
  let userId = userProfileTag.getAttribute("data-widget-conf-user-id");
  let userData = await fetch("https://app.staffbase.com/api/users/" + userId, {
    method: "GET",
    headers: req.headers, // This will pass through the API key from the original request
  });

  return await userData.json();
}