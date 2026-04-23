export const onRequestGet = async ({ request }) => {
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Thank You - Claim Your Listing</title>
  <meta name="robots" content="noindex, nofollow">
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      background: linear-gradient(135deg, #0a192f 0%, #081428 100%);
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
    }
    .container {
      max-width: 600px;
      width: 100%;
      background: white;
      border-radius: 12px;
      box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
      padding: 60px 40px;
      text-align: center;
    }
    .checkmark {
      width: 80px;
      height: 80px;
      margin: 0 auto 30px;
      background: #c5a059;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 48px;
    }
    h1 {
      font-size: 2rem;
      color: #0a192f;
      margin-bottom: 20px;
      font-weight: 700;
      letter-spacing: -0.01em;
    }
    .subtitle {
      font-size: 1.125rem;
      color: #6b7280;
      margin-bottom: 30px;
      line-height: 1.6;
    }
    .content {
      background: #f9fafb;
      border-left: 4px solid #c5a059;
      padding: 20px;
      margin: 30px 0;
      text-align: left;
      border-radius: 6px;
    }
    .content h2 {
      font-size: 1rem;
      color: #0a192f;
      margin-bottom: 12px;
      font-weight: 600;
    }
    .content ul {
      list-style: none;
      padding: 0;
    }
    .content li {
      color: #374151;
      margin-bottom: 10px;
      display: flex;
      align-items: flex-start;
      gap: 10px;
      font-size: 0.95rem;
    }
    .content li::before {
      content: "✓";
      color: #c5a059;
      font-weight: bold;
      flex-shrink: 0;
    }
    .cta-button {
      display: inline-block;
      background: #0a192f;
      color: white;
      padding: 14px 32px;
      border-radius: 6px;
      text-decoration: none;
      font-weight: 600;
      margin-top: 30px;
      transition: background 0.2s ease;
      border: none;
      cursor: pointer;
      font-size: 1rem;
    }
    .cta-button:hover {
      background: #0f2543;
    }
    .footer-text {
      margin-top: 40px;
      font-size: 0.875rem;
      color: #9ca3af;
    }
    @media (max-width: 600px) {
      .container {
        padding: 40px 24px;
      }
      h1 {
        font-size: 1.5rem;
      }
      .checkmark {
        width: 70px;
        height: 70px;
        font-size: 40px;
      }
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="checkmark">✓</div>

    <h1>Thank You!</h1>
    <p class="subtitle">Your listing claim has been received. We're reviewing your submission.</p>

    <div class="content">
      <h2>What Happens Next</h2>
      <ul>
        <li>We'll verify your information within 1-2 business days</li>
        <li>You'll receive a confirmation email at the address you provided</li>
        <li>Once approved, you can manage your full listing details</li>
        <li>Your business will be featured prominently in the directory</li>
      </ul>
    </div>

    <p class="subtitle">Questions? Contact us at support@mineralrightsforum.com</p>

    <button onclick="goBack()" class="cta-button" style="background: #0a192f; color: white; padding: 14px 32px; border-radius: 6px; text-decoration: none; font-weight: 600; margin-top: 30px; transition: background 0.2s ease; border: none; cursor: pointer; font-size: 1rem;">Return to Directory</button>
    <script>
      function goBack() {
        const sourceUrl = sessionStorage.getItem('claimSourcePage');
        if (sourceUrl) {
          sessionStorage.removeItem('claimSourcePage');
          window.location.href = sourceUrl;
        } else {
          window.location.href = '/';
        }
      }
    </script>

    <div class="footer-text">
      <p>Mineral Rights Forum Directory</p>
    </div>
  </div>
</body>
</html>`;

  return new Response(html, {
    status: 200,
    headers: { 'content-type': 'text/html; charset=utf-8' }
  });
};
