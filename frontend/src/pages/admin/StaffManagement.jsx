import React, { useState, useEffect, useCallback } from 'react';
import api from '../../utils/api';

const emptyForm = { name: '', email: '', password: '' };

export default function StaffManagement() {
  const [staff, setStaff] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [selectedStaff, setSelectedStaff] = useState(null);
  const [passwordData, setPasswordData] = useState({ password: '', confirmPassword: '' });
  const [passwordErrors, setPasswordErrors] = useState({});
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [alert, setAlert] = useState(null);

  const fetchStaff = useCallback(async () => {
    try {
      const { data } = await api.get('/admin/staff');
      setStaff(data);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchStaff(); }, [fetchStaff]);

  const showAlert = (type, msg) => { setAlert({ type, message: msg }); setTimeout(() => setAlert(null), 4000); };

  const validate = () => {
    const e = {};
    if (!form.name.trim()) e.name = 'Required';
    if (!form.email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) e.email = 'Valid email required';
    if (!form.password || form.password.length < 6) e.password = 'Min 6 characters';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;
    setSubmitting(true);
    try {
      await api.post('/admin/staff', form);
      showAlert('success', 'Staff member added!');
      setShowModal(false);
      setForm(emptyForm);
      fetchStaff();
    } catch (err) { showAlert('error', err.response?.data?.message || 'Error'); }
    finally { setSubmitting(false); }
  };

  const handleRemove = async (id) => {
    if (!window.confirm('Remove this staff member?')) return;
    try {
      await api.delete(`/admin/staff/${id}`);
      showAlert('success', 'Staff member removed');
      fetchStaff();
    } catch (err) { showAlert('error', 'Failed to remove'); }
  };

  const openPasswordModal = (staffMember) => {
    setSelectedStaff(staffMember);
    setPasswordData({ password: '', confirmPassword: '' });
    setPasswordErrors({});
    setShowPassword(false);
    setShowConfirmPassword(false);
    setShowPasswordModal(true);
  };

  const validatePassword = () => {
    const e = {};
    if (!passwordData.password || passwordData.password.length < 6) e.password = 'Password must be at least 6 characters';
    if (passwordData.password !== passwordData.confirmPassword) e.confirmPassword = 'Passwords do not match';
    setPasswordErrors(e);
    return Object.keys(e).length === 0;
  };

  const handlePasswordUpdate = async (e) => {
    e.preventDefault();
    if (!validatePassword()) return;
    setSubmitting(true);
    try {
      await api.put(`/admin/staff/${selectedStaff._id}/password`, { password: passwordData.password });
      showAlert('success', 'Password updated successfully!');
      setShowPasswordModal(false);
      setSelectedStaff(null);
    } catch (err) { showAlert('error', err.response?.data?.message || 'Failed to update password'); }
    finally { setSubmitting(false); }
  };

  return (
    <div>
      {alert && <div className={`alert alert-${alert.type}`} style={{ position: 'fixed', top: '1rem', right: '1rem', zIndex: 9999, maxWidth: '380px' }}>{alert.type==='success'?'✅':'❌'} {alert.message}</div>}

      <div className="page-header">
        <div className="page-header-left">
          <h1 className="page-title">👥 Staff Management</h1>
          <p className="page-subtitle">{staff.length} staff members</p>
        </div>
        <button className="btn btn-primary" onClick={() => { setForm(emptyForm); setErrors({}); setShowModal(true); }}>+ Add Centre</button>
      </div>

      <div className="card">
        {loading ? <div className="loading-state"><div className="spinner"></div></div>
          : staff.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">👥</div>
              <div className="empty-title">No Centre Added</div>
              <div className="empty-text">Add your first Centre</div>
              <button className="btn btn-primary" onClick={() => setShowModal(true)}>Add Centre</button>
            </div>
          ) : (
            <div className="table-responsive">
              <div className="table-container">
                <table>
                  <thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Joined</th><th>Status</th><th>Actions</th></tr></thead>
                  <tbody>
                    {staff.map(s => (
                      <tr key={s._id}>
                        <td data-label="Name">
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                            <div style={{ width: 36, height: 36, background: 'var(--primary)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 700, fontSize: '0.875rem', flexShrink: 0 }}>{s.name?.charAt(0)}</div>
                            <div className="td-name">{s.name}</div>
                          </div>
                        </td>
                        <td data-label="Email">{s.email}</td>
                        <td data-label="Role"><span className="badge badge-purple">Staff</span></td>
                        <td data-label="Joined">{s.createdAt ? new Date(s.createdAt).toLocaleDateString('en-IN') : '-'}</td>
                        <td data-label="Status"><span className={`badge ${s.isActive !== false ? 'badge-success' : 'badge-gray'}`}>{s.isActive !== false ? '✅ Active' : '⛔ Inactive'}</span></td>
                        <td className="td-actions" data-label="Actions">
                          <button className="btn btn-sm btn-outline" onClick={() => openPasswordModal(s)} title="Change Password">✏️</button>
                          <button className="btn btn-sm btn-danger" onClick={() => handleRemove(s._id)}>Remove</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
      </div>

      {showModal && (
        <div className="modal-overlay">
          <div className="modal modal-sm">
            <div className="modal-header">
              <h3 className="modal-title">👤 Add Centre</h3>
              <button className="modal-close" onClick={() => setShowModal(false)}>✕</button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="modal-body">
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  <div className="form-group">
                    <label className="form-label">Full Name <span className="required">*</span></label>
                    <input className={`form-input ${errors.name?'error':''}`} placeholder="Add Centre name" value={form.name} onChange={e => setForm({...form, name: e.target.value})} />
                    {errors.name && <span className="form-error">{errors.name}</span>}
                  </div>
                  <div className="form-group">
                    <label className="form-label">Email <span className="required">*</span></label>
                    <input type="email" className={`form-input ${errors.email?'error':''}`} placeholder="staff@institute.com" value={form.email} onChange={e => setForm({...form, email: e.target.value})} />
                    {errors.email && <span className="form-error">{errors.email}</span>}
                  </div>
                  <div className="form-group">
                    <label className="form-label">Password <span className="required">*</span></label>
                    <input type="password" className={`form-input ${errors.password?'error':''}`} placeholder="Min 6 characters" value={form.password} onChange={e => setForm({...form, password: e.target.value})} />
                    {errors.password && <span className="form-error">{errors.password}</span>}
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-outline" onClick={() => setShowModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={submitting}>{submitting ? '...' : '✅ Add Centre'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showPasswordModal && selectedStaff && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowPasswordModal(false)}>
          <div className="modal modal-sm">
            <div className="modal-header">
              <h3 className="modal-title">🔑 Change Password</h3>
              <button className="modal-close" onClick={() => setShowPasswordModal(false)}>✕</button>
            </div>
            <form onSubmit={handlePasswordUpdate}>
              <div className="modal-body">
                <div style={{ padding: '0.875rem', background: 'var(--gray-50)', borderRadius: 'var(--radius-sm)', marginBottom: '1rem' }}>
                  <div style={{ fontWeight: 600 }}>{selectedStaff.name}</div>
                  <div style={{ fontSize: '0.85rem', color: 'var(--gray-500)' }}>{selectedStaff.email}</div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  <div className="form-group">
                    <label className="form-label">New Password <span className="required">*</span></label>
                    <div style={{ position: 'relative' }}>
                      <input type={showPassword ? 'text' : 'password'} className={`form-input ${passwordErrors.password?'error':''}`} placeholder="Min 6 characters" value={passwordData.password} onChange={e => setPasswordData({...passwordData, password: e.target.value})} style={{ paddingRight: '2.5rem' }} />
                      <button type="button" onClick={() => setShowPassword(!showPassword)} style={{ position: 'absolute', right: '0.5rem', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.1rem', padding: '0.25rem' }}>{showPassword ? '🙈' : '👁️'}</button>
                    </div>
                    {passwordErrors.password && <span className="form-error">{passwordErrors.password}</span>}
                  </div>
                  <div className="form-group">
                    <label className="form-label">Confirm Password <span className="required">*</span></label>
                    <div style={{ position: 'relative' }}>
                      <input type={showConfirmPassword ? 'text' : 'password'} className={`form-input ${passwordErrors.confirmPassword?'error':''}`} placeholder="Re-enter new password" value={passwordData.confirmPassword} onChange={e => setPasswordData({...passwordData, confirmPassword: e.target.value})} style={{ paddingRight: '2.5rem' }} />
                      <button type="button" onClick={() => setShowConfirmPassword(!showConfirmPassword)} style={{ position: 'absolute', right: '0.5rem', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.1rem', padding: '0.25rem' }}>{showConfirmPassword ? '🙈' : '👁️'}</button>
                    </div>
                    {passwordErrors.confirmPassword && <span className="form-error">{passwordErrors.confirmPassword}</span>}
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-outline" onClick={() => setShowPasswordModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={submitting}>{submitting ? '...' : '✅ Update Password'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
