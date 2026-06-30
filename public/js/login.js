document.addEventListener('DOMContentLoaded', () => {
  // Already logged in? Skip straight to the dashboard.
  if (Api.getToken()) {
    window.location.href = '/dashboard.html';
    return;
  }

  const form = document.getElementById('loginForm');
  const errorBanner = document.getElementById('errorBanner');
  const submitBtn = document.getElementById('submitBtn');

  function showError(msg) {
    errorBanner.textContent = msg;
    errorBanner.classList.add('visible');
  }
  function hideError() {
    errorBanner.classList.remove('visible');
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    hideError();
    submitBtn.disabled = true;
    submitBtn.textContent = 'Prijavljivanje...';

    const username = document.getElementById('username').value.trim();
    const password = document.getElementById('password').value;

    try {
      const data = await Api.post('/api/auth/login', { username, password });
      Api.setSession(data.token, data.user);
      window.location.href = '/dashboard.html';
    } catch (err) {
      showError(err.message);
      submitBtn.disabled = false;
      submitBtn.textContent = 'Prijavi se';
    }
  });
});
