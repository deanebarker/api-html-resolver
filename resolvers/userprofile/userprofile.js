async function getUserName(userProfileTag)
{
  let userId = userProfileTag.getAttribute('data-widget-conf-user-id')
  let userData = await fetch('https://app.staffbase.com/api/users/' + userId,
    {
      method: 'GET', 
      headers: {
        'Authorization': 'Basic NjViOTNkNTdhZjM3NWYzYTc5M2I1MjMwOjt5ZS57YzQtUS5bVlFzWypLIWpSa3IqW2tYdUtqQmI3X2w3b31seklsVDFGKUp6RSxIeGVPJHNebV5nN0thNXE='
      }
    }
  );

  return await userData.json();
}

export default getUserName;
