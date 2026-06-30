function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function formatTime(iso) {
  const d = new Date(iso);
  return d.toLocaleString('sr-RS');
}

function setupTabs() {
  document.querySelectorAll('.tab-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab-btn').forEach((b) => b.classList.remove('active'));
      document.querySelectorAll('.tab-panel').forEach((p) => p.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById(`tab-${btn.dataset.tab}`).classList.add('active');
    });
  });
}

async function loadAuditLog() {
  const data = await Api.get('/api/admin/audit-log');
  const tbody = document.getElementById('auditBody');
  if (data.entries.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" class="empty-state">Evidencija je prazna.</td></tr>';
    return;
  }
  tbody.innerHTML = data.entries.map((e) => `
    <tr>
      <td class="timestamp">${formatTime(e.timestamp)}</td>
      <td><strong>${escapeHtml(e.username)}</strong></td>
      <td class="mono">${escapeHtml(e.role)}</td>
      <td><span class="audit-action ${e.action}">${e.action}</span></td>
      <td class="mono">${escapeHtml(e.resource)}${e.resourceId ? ' #' + e.resourceId : ''}</td>
      <td>${escapeHtml(e.details)}</td>
    </tr>
  `).join('');
}

async function loadBackups() {
  const data = await Api.get('/api/admin/backups');
  const tbody = document.getElementById('backupsBody');
  if (data.backups.length === 0) {
    tbody.innerHTML = '<tr><td colspan="2" class="empty-state">Jos nema napravljenih rezervnih kopija.</td></tr>';
    return;
  }
  tbody.innerHTML = data.backups.map((name) => `
    <tr>
      <td class="mono">${escapeHtml(name)}</td>
      <td><button class="btn-ghost" data-restore="${escapeHtml(name)}">Vrati iz ove kopije</button></td>
    </tr>
  `).join('');
}

async function loadUsers() {
  const data = await Api.get('/api/admin/users');
  document.getElementById('usersBody').innerHTML = data.users.map((u) => `
    <tr>
      <td><strong>${escapeHtml(u.username)}</strong></td>
      <td class="mono">${escapeHtml(u.role)}</td>
      <td class="timestamp">${formatTime(u.createdAt)}</td>
    </tr>
  `).join('');
}

async function refreshAll() {
  await Promise.all([loadAuditLog(), loadBackups(), loadUsers()]);
}

document.addEventListener('DOMContentLoaded', async () => {
  if (!Api.requireLoginOrRedirect()) return;
  if (!Api.requireAdminOrRedirect()) return;

  const user = Api.getUser();
  const badge = document.getElementById('roleBadge');
  badge.textContent = `${user.username} · ${user.role}`;
  badge.classList.add(user.role);

  document.getElementById('logoutBtn').addEventListener('click', () => {
    Api.clearSession();
    window.location.href = '/index.html';
  });

  setupTabs();

  document.getElementById('refreshAuditBtn').addEventListener('click', loadAuditLog);

  document.getElementById('createBackupBtn').addEventListener('click', async (e) => {
    const btn = e.target;
    btn.disabled = true;
    btn.textContent = 'Kreiranje...';
    try {
      await Api.post('/api/admin/backups');
      await loadBackups();
      await loadAuditLog();
    } catch (err) {
      alert(err.message);
    } finally {
      btn.disabled = false;
      btn.textContent = 'Napravi backup sada';
    }
  });

  document.getElementById('backupsBody').addEventListener('click', async (e) => {
    const btn = e.target.closest('button[data-restore]');
    if (!btn) return;
    const name = btn.dataset.restore;
    if (!confirm(`Vratiti sistem iz kopije "${name}"? Trenutno stanje ce prvo biti sacuvano kao bezbednosna kopija.`)) return;
    try {
      await Api.post('/api/admin/restore', { backupName: name });
      alert('Sistem je vracen iz izabrane rezervne kopije.');
      await refreshAll();
    } catch (err) {
      alert(err.message);
    }
  });

  document.getElementById('userForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const errorBox = document.getElementById('userFormError');
    errorBox.classList.remove('visible');
    const payload = {
      username: document.getElementById('nu_username').value.trim(),
      password: document.getElementById('nu_password').value,
      role: document.getElementById('nu_role').value,
    };
    try {
      await Api.post('/api/admin/users', payload);
      e.target.reset();
      await loadUsers();
      await loadAuditLog();
    } catch (err) {
      errorBox.textContent = err.message;
      errorBox.classList.add('visible');
    }
  });

  try {
    await refreshAll();
  } catch (err) {
    alert(err.message);
  }
});
