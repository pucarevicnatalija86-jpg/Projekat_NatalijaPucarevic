let patients = [];
let editingId = null;
let currentUser = null;

function maskJmbg(jmbg) {
  if (!jmbg) return '<span class="small-note">—</span>';
  const last4 = jmbg.slice(-4);
  return '•'.repeat(Math.max(0, jmbg.length - 4)) + last4;
}

function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function renderRoleBadge() {
  const badge = document.getElementById('roleBadge');
  badge.textContent = `${currentUser.username} · ${currentUser.role}`;
  badge.classList.add(currentUser.role);

  if (currentUser.role === 'administrator') {
    document.getElementById('adminLink').style.display = 'inline-block';
  }
}

function renderPatients() {
  const tbody = document.getElementById('patientsBody');
  const emptyState = document.getElementById('emptyState');

  if (patients.length === 0) {
    tbody.innerHTML = '';
    emptyState.style.display = 'block';
    return;
  }
  emptyState.style.display = 'none';

  const isAdmin = currentUser.role === 'administrator';

  tbody.innerHTML = patients.map((p) => `
    <tr data-id="${p.id}">
      <td><strong>${escapeHtml(p.ime)} ${escapeHtml(p.prezime)}</strong></td>
      <td class="mono">${escapeHtml(p.datumRodjenja) || '—'}</td>
      <td class="mono">${escapeHtml(p.telefon) || '—'}</td>
      <td class="mono jmbg-cell" data-full="${escapeHtml(p.jmbg || '')}" data-revealed="false">
        ${maskJmbg(p.jmbg)}
        ${p.jmbg ? '<button class="reveal-btn" data-action="reveal-jmbg">prikazi</button>' : ''}
      </td>
      <td>${escapeHtml(p.dijagnoza) || '—'}</td>
      <td class="actions">
        <button class="btn-icon" data-action="edit">Izmeni</button>
        <button class="btn-danger" data-action="delete" ${isAdmin ? '' : 'disabled title="Samo administrator moze brisati zapise"'}>Obrisi</button>
      </td>
    </tr>
  `).join('');
}

async function loadPatients() {
  const data = await Api.get('/api/patients');
  patients = data.patients;
  renderPatients();
}

function openModal(patient) {
  editingId = patient ? patient.id : null;
  document.getElementById('modalTitle').textContent = patient ? 'Izmeni pacijenta' : 'Novi pacijent';
  document.getElementById('f_ime').value = patient ? patient.ime : '';
  document.getElementById('f_prezime').value = patient ? patient.prezime : '';
  document.getElementById('f_datum').value = patient ? (patient.datumRodjenja || '') : '';
  document.getElementById('f_telefon').value = patient ? (patient.telefon || '') : '';
  document.getElementById('f_jmbg').value = patient ? (patient.jmbg || '') : '';
  document.getElementById('f_dijagnoza').value = patient ? (patient.dijagnoza || '') : '';
  document.getElementById('formError').classList.remove('visible');
  document.getElementById('modalBackdrop').classList.add('visible');
}

function closeModal() {
  document.getElementById('modalBackdrop').classList.remove('visible');
  editingId = null;
}

async function handleSave(e) {
  e.preventDefault();
  const saveBtn = document.getElementById('saveBtn');
  const errorBox = document.getElementById('formError');
  errorBox.classList.remove('visible');

  const payload = {
    ime: document.getElementById('f_ime').value.trim(),
    prezime: document.getElementById('f_prezime').value.trim(),
    datumRodjenja: document.getElementById('f_datum').value || null,
    telefon: document.getElementById('f_telefon').value.trim() || null,
    jmbg: document.getElementById('f_jmbg').value.trim() || null,
    dijagnoza: document.getElementById('f_dijagnoza').value.trim() || null,
  };

  saveBtn.disabled = true;
  saveBtn.textContent = 'Cuvanje...';
  try {
    if (editingId) {
      await Api.put(`/api/patients/${editingId}`, payload);
    } else {
      await Api.post('/api/patients', payload);
    }
    closeModal();
    await loadPatients();
  } catch (err) {
    errorBox.textContent = err.message;
    errorBox.classList.add('visible');
  } finally {
    saveBtn.disabled = false;
    saveBtn.textContent = 'Sacuvaj';
  }
}

async function handleTableClick(e) {
  const btn = e.target.closest('button[data-action]');
  if (!btn) return;
  const row = btn.closest('tr');
  const id = Number(row.dataset.id);

  if (btn.dataset.action === 'edit') {
    const patient = patients.find((p) => p.id === id);
    openModal(patient);
  }

  if (btn.dataset.action === 'delete') {
    if (!confirm('Da li sigurno zelite da obrisete ovaj karton? Ova akcija se ne moze opozvati.')) return;
    try {
      await Api.del(`/api/patients/${id}`);
      await loadPatients();
    } catch (err) {
      alert(err.message);
    }
  }

  if (btn.dataset.action === 'reveal-jmbg') {
    const cell = btn.closest('.jmbg-cell');
    const full = cell.dataset.full;
    cell.innerHTML = `${full} <button class="reveal-btn" data-action="hide-jmbg">sakrij</button>`;
  }

  if (btn.dataset.action === 'hide-jmbg') {
    const cell = btn.closest('.jmbg-cell');
    const full = cell.dataset.full;
    cell.innerHTML = `${maskJmbg(full)} <button class="reveal-btn" data-action="reveal-jmbg">prikazi</button>`;
  }
}

document.addEventListener('DOMContentLoaded', async () => {
  if (!Api.requireLoginOrRedirect()) return;
  currentUser = Api.getUser();
  renderRoleBadge();

  document.getElementById('logoutBtn').addEventListener('click', () => {
    Api.clearSession();
    window.location.href = '/index.html';
  });
  document.getElementById('addBtn').addEventListener('click', () => openModal(null));
  document.getElementById('closeModalBtn').addEventListener('click', closeModal);
  document.getElementById('cancelModalBtn').addEventListener('click', closeModal);
  document.getElementById('patientForm').addEventListener('submit', handleSave);
  document.getElementById('patientsBody').addEventListener('click', handleTableClick);

  try {
    await loadPatients();
  } catch (err) {
    alert(err.message);
  }
});
