document.addEventListener('DOMContentLoaded', function() {
  // Retrieve affiliate data from localStorage (in a real implementation, this would come from the server)
  const affiliateData = JSON.parse(localStorage.getItem('currentAffiliate'));

  if (affiliateData) {
    // Display affiliate information
    document.getElementById('affiliateId').textContent = affiliateData.affiliateId;
    document.getElementById('affiliateName').textContent = `${affiliateData.firstName} ${affiliateData.lastName}`;
    document.getElementById('affiliateEmail').textContent = affiliateData.email;

    // Generate and display registration link
    const baseUrl = window.location.origin + window.location.pathname.substring(0, window.location.pathname.lastIndexOf('/') + 1);
    const registrationLink = `${baseUrl}customer-register.html?affiliate=${affiliateData.affiliateId}`;
    document.getElementById('registrationLink').value = registrationLink;

    // Set dashboard link
    document.getElementById('dashboardLink').href = `affiliate-dashboard.html?id=${affiliateData.affiliateId}`;
  } else {
    // Fallback if no data is available
    document.getElementById('affiliateId').textContent = 'AFF123456';
    document.getElementById('affiliateName').textContent = 'Demo Affiliate';
    document.getElementById('affiliateEmail').textContent = 'demo@example.com';

    const baseUrl = window.location.origin + window.location.pathname.substring(0, window.location.pathname.lastIndexOf('/') + 1);
    document.getElementById('registrationLink').value = `${baseUrl}customer-register.html?affiliate=AFF123456`;
    document.getElementById('dashboardLink').href = 'affiliate-dashboard.html?id=AFF123456';
  }

  // Copy link to clipboard functionality
  document.getElementById('copyLinkBtn').addEventListener('click', function() {
    const linkInput = document.getElementById('registrationLink');
    linkInput.select();
    document.execCommand('copy');

    this.textContent = 'Copied!';
    setTimeout(() => {
      this.textContent = 'Copy';
    }, 2000);
  });
});