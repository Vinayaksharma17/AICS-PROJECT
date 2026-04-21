import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../utils/api';

const PER_PAGE = 8;
const emptyForm = {
  firstName: '', fatherName: '', lastName: '', phoneNumber: '', email: '',
  address: '', qualification: '', interestedCourse: '',
  expectedAdmissionDate: '', followUpDate: '', notes: ''
};

export default function StaffEnquiries() {
  const [enquiries,  setEnquiries]  = useState([]);
  const [courses,    setCourses]    = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [showModal,  setShowModal]  = useState(false);
  const [editing,    setEditing]    = useState(null);
  const [form,       setForm]       = useState(emptyForm);
  const [errors,     setErrors]     = useState({});
  const [search,     setSearch]     = useState('');
  const [filter,     setFilter]     = useState('all');
  const [page,       setPage]       = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [alert,      setAlert]      = useState(null);
  const navigate = useNavigate();

  const fetchData = useCallback(async () => {
    try {
      const [eq, co] = await Promise.all([api.get('/enquiries'), api.get('/courses')]);
      setEnquiries(eq.data);
      setCourses(co.data.filter(c => c.isActive !== false));
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const showAlert = (type, msg) => { setAlert({ type, message: msg }); setTimeout(() => setAlert(null), 4000); };

  /* ── Filtering ──────────────────────────────────────────────────────────── */
  const filtered = enquiries.filter(e => {
    const name = `${e.firstName} ${e.fatherName} ${e.lastName}`.toLowerCase();
    const matchSearch = !search || name.includes(search.toLowerCase()) || e.phoneNumber?.includes(search);
    const matchFilter = filter === 'all' || e.status === filter;
    return matchSearch && matchFilter;
  });
  const totalPages = Math.ceil(filtered.length / PER_PAGE);
  const paginated  = filtered.slice((page - 1) * PER_PAGE, page * PER_PAGE);

  const counts = {
    all:       enquiries.length,
    new:       enquiries.filter(e => e.status === 'new').length,
    contacted: enquiries.filter(e => e.status === 'contacted').length,
  };

  const today = new Date().toISOString().split('T')[0];

  /* ── Validation ─────────────────────────────────────────────────────────── */
  const validate = () => {
    const e = {};
    if (!form.firstName.trim())  e.firstName  = 'Required';
    if (!form.fatherName.trim()) e.fatherName = 'Required';
    if (!form.lastName.trim())   e.lastName   = 'Required';
    if (!form.phoneNumber.match(/^[0-9]{10}$/)) e.phoneNumber = 'Enter valid 10-digit number';
    if (!form.interestedCourse)  e.interestedCourse = 'Select a course';
    if (form.expectedAdmissionDate && form.expectedAdmissionDate < today)
      e.expectedAdmissionDate = 'Admission date cannot be in the past';
    if (form.followUpDate && form.followUpDate < today)
      e.followUpDate = 'Follow-up date cannot be in the past';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  /* ── Submit (add / edit) ────────────────────────────────────────────────── */
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;
    setSubmitting(true);
    try {
      if (editing) {
        await api.put(`/enquiries/${editing._id}`, form);
        // Backend will reset to 'new' if a date changed and was 'contacted'
        showAlert('success', 'Enquiry updated!');
      } else {
        await api.post('/enquiries', form);
        showAlert('success', 'Enquiry added!');
      }
      setShowModal(false); setEditing(null); setForm(emptyForm); fetchData();
    } catch (err) { showAlert('error', err.response?.data?.message || 'Error saving enquiry'); }
    finally { setSubmitting(false); }
  };

  /* ── Mark contacted ─────────────────────────────────────────────────────── */
  const handleMarkContacted = async (id) => {
    try {
      await api.put(`/enquiries/${id}`, { status: 'contacted' });
      showAlert('success', 'Marked as contacted!');
      fetchData();
    } catch (err) { showAlert('error', 'Failed to update status'); }
  };

  /* ── Admit → redirect to student admission ──────────────────────────────── */
  const handleAdmit = async (enquiry) => {
    try { await api.put(`/enquiries/${enquiry._id}`, { status: 'converted' }); } catch (e) { console.error('Failed to mark enquiry as converted:', e); }
    sessionStorage.setItem('convertEnquiry', JSON.stringify(enquiry));
    navigate('/staff/students');
  };

  /* ── Open edit modal ─────────────────────────────────────────────────────── */
  const openEdit = (enq) => {
    setEditing(enq);
    setForm({
      firstName:             enq.firstName             || '',
      fatherName:            enq.fatherName            || '',
      lastName:              enq.lastName              || '',
      phoneNumber:           enq.phoneNumber           || '',
      email:                 enq.email                 || '',
      address:               enq.address               || '',
      qualification:         enq.qualification         || '',
      interestedCourse:      enq.interestedCourse?._id || '',
      expectedAdmissionDate: enq.expectedAdmissionDate ? enq.expectedAdmissionDate.split('T')[0] : '',
      followUpDate:          enq.followUpDate          ? enq.followUpDate.split('T')[0]          : '',
      notes:                 enq.notes                 || '',
    });
    setErrors({});
    setShowModal(true);
  };

  const downloadEnquiry = (e) => {
    const fullCourse = courses.find(c => c._id === (e.interestedCourse?._id || e.interestedCourse)) || {};
    const courseName = fullCourse.name || e.interestedCourse?.name || 'N/A';
    const courseDesc = fullCourse.description || '';
    const courseFees = fullCourse.fees ? `₹${Number(fullCourse.fees).toLocaleString('en-IN')}` : '—';
    const courseDuration = fullCourse.duration ? `${fullCourse.duration} Month${fullCourse.duration > 1 ? 's' : ''}` : '—';
    const courseSubjects = (fullCourse.subjects || []).filter(Boolean);

    const fmt = (d) => d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
    const statusLabel = e.status === 'new' ? '🆕 New' : e.status === 'contacted' ? '📞 Contacted' : e.status === 'converted' ? '✅ Converted' : '🔒 Closed';

    const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Enquiry - ${e.firstName} ${e.lastName}</title>
    <style>
      * { box-sizing: border-box; margin: 0; padding: 0; }
      body { font-family: Arial, sans-serif; padding: 32px; color: #1e293b; background: #fff; font-size: 14px; }
      .header { background: #1e40af; color: white; padding: 20px 28px; border-radius: 8px; margin-bottom: 24px; display: flex; justify-content: space-between; align-items: center; }
      .header h1 { font-size: 1.3rem; }
      .header p { margin-top: 4px; font-size: 0.8rem; opacity: 0.85; }
      .badge { display: inline-block; padding: 5px 14px; border-radius: 999px; font-size: 0.78rem; font-weight: 700; background: #dbeafe; color: #1e40af; letter-spacing: 0.04em; }
      .section { margin-bottom: 20px; }
      .section-title { font-size: 0.68rem; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; color: #64748b; border-bottom: 2px solid #e2e8f0; padding-bottom: 5px; margin-bottom: 12px; }
      .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px 32px; }
      .grid.three { grid-template-columns: 1fr 1fr 1fr; }
      .field label { font-size: 0.68rem; color: #94a3b8; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; display: block; margin-bottom: 3px; }
      .field span { font-size: 0.95rem; color: #1e293b; font-weight: 600; }
      .full { grid-column: span 2; }
      .desc-box { background: #f8fafc; border-left: 3px solid #1e40af; border-radius: 4px; padding: 12px 14px; font-size: 0.9rem; color: #475569; line-height: 1.6; white-space: pre-wrap; }
      .subjects { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 4px; }
      .subject-tag { background: #eff6ff; color: #1e40af; border: 1px solid #bfdbfe; border-radius: 4px; padding: 3px 10px; font-size: 0.78rem; font-weight: 600; }
      .notes-box { background: #fffbeb; border-left: 3px solid #f59e0b; border-radius: 4px; padding: 12px 14px; font-size: 0.9rem; color: #78350f; line-height: 1.6; min-height: 48px; }
      .footer { margin-top: 28px; font-size: 0.72rem; color: #94a3b8; text-align: center; border-top: 1px solid #e2e8f0; padding-top: 10px; }
      @media print { body { padding: 16px; } }
    </style></head><body>
    <div class="header">
      <div><h1>📋 Enquiry Record</h1><p>AICS — Downloaded on ${fmt(new Date())}</p></div>
      <span class="badge">${statusLabel}</span>
    </div>
    <div class="section">
      <div class="section-title">Personal Information</div>
      <div class="grid">
        <div class="field"><label>Full Name</label><span>${e.firstName} ${e.fatherName} ${e.lastName}</span></div>
        <div class="field"><label>Mobile</label><span>${e.phoneNumber || '—'}</span></div>
        <div class="field"><label>Email</label><span>${e.email || '—'}</span></div>
        <div class="field"><label>Qualification</label><span>${e.qualification || '—'}</span></div>
        <div class="field full"><label>Address</label><span style="font-weight:400">${e.address || '—'}</span></div>
      </div>
    </div>
    <div class="section">
      <div class="section-title">Course Interest</div>
      <div class="grid three">
        <div class="field"><label>Course Name</label><span>${courseName}</span></div>
        <div class="field"><label>Duration</label><span>${courseDuration}</span></div>
        <div class="field"><label>Fees</label><span>${courseFees}</span></div>
      </div>
      ${courseDesc ? `<div style="margin-top:12px"><div class="field"><label>Course Description</label></div><div class="desc-box" style="margin-top:6px">${courseDesc}</div></div>` : ''}
      ${courseSubjects.length > 0 ? `<div style="margin-top:12px"><div class="field"><label>Subjects / Modules</label></div><div class="subjects" style="margin-top:6px">${courseSubjects.map(s => `<span class="subject-tag">${s}</span>`).join('')}</div></div>` : ''}
    </div>
    <div class="section">
      <div class="section-title">Follow-Up Details</div>
      <div class="grid three">
        <div class="field"><label>Status</label><span>${statusLabel}</span></div>
        <div class="field"><label>Expected Admission</label><span>${fmt(e.expectedAdmissionDate)}</span></div>
        <div class="field"><label>Follow-Up Date</label><span>${fmt(e.followUpDate)}</span></div>
      </div>
    </div>
    <div class="section">
      <div class="section-title">Notes</div>
      <div class="notes-box">${e.notes || 'No notes added for this enquiry.'}</div>
    </div>
    <div class="footer">Generated by AICS Admin Panel &nbsp;•&nbsp; ${new Date().toLocaleString('en-IN')} &nbsp;•&nbsp; Confidential</div>
    </body></html>`;

    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Enquiry_${e.firstName}_${e.lastName}_${e.phoneNumber}.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div>
      {alert && (
        <div className={`alert alert-${alert.type}`} style={{ position:'fixed',top:'1rem',right:'1rem',zIndex:9999,maxWidth:'380px' }}>
          {alert.type === 'success' ? '✅' : '❌'} {alert.message}
        </div>
      )}

      <div className="page-header">
        <div className="page-header-left">
          <h1 className="page-title">📋 Enquiry Management</h1>
          <p className="page-subtitle">{counts.new} new, {counts.contacted} contacted</p>
        </div>
        <button className="btn btn-primary" onClick={() => { setEditing(null); setForm(emptyForm); setErrors({}); setShowModal(true); }}>+ Add Enquiry</button>
      </div>

      {/* Stats row */}
      <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(140px,1fr))', marginBottom: '1rem' }}>
        {['new','contacted'].map(s => (
          <div key={s} className="stat-card" style={{ padding:'1rem',cursor:'pointer' }} onClick={() => { setFilter(s); setPage(1); }}>
            <div style={{ textAlign:'center',width:'100%' }}>
              <div style={{ fontSize:'1.5rem',fontWeight:700 }}>{counts[s]}</div>
              <div style={{ fontSize:'0.75rem',color:'var(--gray-500)',textTransform:'capitalize' }}>{s}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="card">
        <div className="card-header">
          <div className="toolbar">
            <div className="search-box">
              <span className="search-icon">🔍</span>
              <input placeholder="Search name, phone..." value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} />
            </div>
            <div className="filter-tabs">
              {['all','new','contacted'].map(f => (
                <button key={f} className={`filter-tab ${filter === f ? 'active' : ''}`} onClick={() => { setFilter(f); setPage(1); }}>
                  {f.charAt(0).toUpperCase() + f.slice(1)} {f !== 'all' && `(${counts[f]})`}
                </button>
              ))}
            </div>
          </div>
        </div>

        {loading ? <div className="loading-state"><div className="spinner"></div></div>
          : paginated.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">📋</div>
              <div className="empty-title">No enquiries found</div>
              <div className="empty-text">Start tracking potential students</div>
              <button className="btn btn-primary" onClick={() => setShowModal(true)}>Add Enquiry</button>
            </div>
          ) : (
            <div className="table-responsive">
              <div className="table-container">
                <table>
                  <thead>
                    <tr><th>Name</th><th>Phone</th><th>Course</th><th>Expected Date</th><th>Follow Up</th><th>Status</th><th>Actions</th></tr>
                  </thead>
                  <tbody>
                    {paginated.map(e => (
                      <tr key={e._id}>
                        <td data-label="Name">
                          <div className="td-name">{e.firstName} {e.fatherName} {e.lastName}</div>
                          {e.qualification && <div className="td-sub">{e.qualification}</div>}
                        </td>
                        <td data-label="Phone">{e.phoneNumber}</td>
                        <td data-label="Course">{e.interestedCourse?.name}</td>
                        <td data-label="Expected">{e.expectedAdmissionDate ? new Date(e.expectedAdmissionDate).toLocaleDateString('en-IN') : '-'}</td>
                        <td data-label="Follow Up">{e.followUpDate ? new Date(e.followUpDate).toLocaleDateString('en-IN') : '-'}</td>
                        <td data-label="Status">
                          <span className={`badge ${e.status === 'new' ? 'badge-info' : e.status === 'contacted' ? 'badge-warning' : e.status === 'converted' ? 'badge-success' : 'badge-gray'}`}>
                            {e.status === 'new' ? '🆕 New' : e.status === 'contacted' ? '📞 Contacted' : e.status === 'converted' ? '✅ Converted' : '⛔ Closed'}
                          </span>
                        </td>
                        <td className="td-actions" data-label="Actions">
                          {e.status === 'new' && (
                            <button className="btn btn-sm btn-success" onClick={() => handleMarkContacted(e._id)}>✓ Contacted</button>
                          )}
                          <button className="btn btn-sm btn-outline" onClick={() => openEdit(e)}>Edit</button>
                          {e.status !== 'converted' && (
                            <button className="btn btn-sm btn-success" onClick={() => handleAdmit(e)}>➡️ Admit</button>
                          )}
                          <button className="btn btn-sm btn-outline" title="Download Enquiry" onClick={() => downloadEnquiry(e)}>⬇️ Download</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

        {totalPages > 1 && (
          <div className="pagination">
            <span className="pagination-info">Showing {(page-1)*PER_PAGE+1}–{Math.min(page*PER_PAGE,filtered.length)} of {filtered.length}</span>
            <div className="pagination-controls">
              <button className="page-btn" disabled={page===1} onClick={() => setPage(p => p-1)}>‹</button>
              {Array.from({length:totalPages},(_,i)=>i+1).filter(p=>Math.abs(p-page)<=2).map(p=>(
                <button key={p} className={`page-btn ${p===page?'active':''}`} onClick={()=>setPage(p)}>{p}</button>
              ))}
              <button className="page-btn" disabled={page===totalPages} onClick={() => setPage(p => p+1)}>›</button>
            </div>
          </div>
        )}
      </div>

      {/* ── ADD / EDIT MODAL ──────────────────────────────────────────────── */}
      {showModal && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <h3 className="modal-title">{editing ? '✏️ Edit Enquiry' : '➕ Add Enquiry'}</h3>
              <button className="modal-close" onClick={() => setShowModal(false)}>✕</button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="modal-body">
                <div className="form-grid">
                  <div className="form-group"><label className="form-label">First Name <span className="required">*</span></label><input className={`form-input ${errors.firstName?'error':''}`} placeholder="First name" value={form.firstName} onChange={e => setForm({...form, firstName: e.target.value})} />{errors.firstName && <span className="form-error">{errors.firstName}</span>}</div>
                  <div className="form-group"><label className="form-label">Father's Name <span className="required">*</span></label><input className={`form-input ${errors.fatherName?'error':''}`} placeholder="Father's name" value={form.fatherName} onChange={e => setForm({...form, fatherName: e.target.value})} />{errors.fatherName && <span className="form-error">{errors.fatherName}</span>}</div>
                  <div className="form-group"><label className="form-label">Surname <span className="required">*</span></label><input className={`form-input ${errors.lastName?'error':''}`} placeholder="Surname" value={form.lastName} onChange={e => setForm({...form, lastName: e.target.value})} />{errors.lastName && <span className="form-error">{errors.lastName}</span>}</div>
                  <div className="form-group"><label className="form-label">Mobile <span className="required">*</span></label><input className={`form-input ${errors.phoneNumber?'error':''}`} placeholder="10-digit" maxLength={10} value={form.phoneNumber} onChange={e => setForm({...form, phoneNumber: e.target.value.replace(/\D/g,'')})} />{errors.phoneNumber && <span className="form-error">{errors.phoneNumber}</span>}</div>
                  <div className="form-group"><label className="form-label">Email</label><input type="email" className="form-input" placeholder="Optional" value={form.email} onChange={e => setForm({...form, email: e.target.value})} /></div>
                  <div className="form-group"><label className="form-label">Qualification</label><input className="form-input" placeholder="Highest qualification" value={form.qualification} onChange={e => setForm({...form, qualification: e.target.value})} /></div>
                  <div className="form-group full-width"><label className="form-label">Address</label><textarea className="form-textarea" placeholder="Address" rows={2} value={form.address} onChange={e => setForm({...form, address: e.target.value})} /></div>
                  <div className="form-group"><label className="form-label">Interested Course <span className="required">*</span></label><select className={`form-select ${errors.interestedCourse?'error':''}`} value={form.interestedCourse} onChange={e => setForm({...form, interestedCourse: e.target.value})}><option value="">Select Course</option>{courses.map(c => <option key={c._id} value={c._id}>{c.name}</option>)}</select>{errors.interestedCourse && <span className="form-error">{errors.interestedCourse}</span>}</div>
                  <div className="form-group">
                    <label className="form-label">Expected Admission Date</label>
                    <input type="date" className={`form-input ${errors.expectedAdmissionDate?'error':''}`} min={today} value={form.expectedAdmissionDate} onChange={e => setForm({...form, expectedAdmissionDate: e.target.value})} />
                    {errors.expectedAdmissionDate && <span className="form-error">{errors.expectedAdmissionDate}</span>}
                  </div>
                  <div className="form-group">
                    <label className="form-label">Follow Up Date</label>
                    <input type="date" className={`form-input ${errors.followUpDate?'error':''}`} min={today} value={form.followUpDate} onChange={e => setForm({...form, followUpDate: e.target.value})} />
                    {errors.followUpDate && <span className="form-error">{errors.followUpDate}</span>}
                  </div>
                  <div className="form-group full-width"><label className="form-label">Notes</label><textarea className="form-textarea" placeholder="Any additional notes..." rows={2} value={form.notes} onChange={e => setForm({...form, notes: e.target.value})} /></div>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-outline" onClick={() => setShowModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={submitting}>{submitting ? '...' : editing ? '✅ Update' : '✅ Add Enquiry'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
