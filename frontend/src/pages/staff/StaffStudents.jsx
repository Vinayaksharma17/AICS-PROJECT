import React, { useState, useEffect, useCallback, useRef } from 'react';
import ReactCrop, { centerCrop, makeAspectCrop } from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';
import api from '../../utils/api';

const BASE_URL = import.meta.env.VITE_API_URL?.replace('/api', '') || '';

const PER_PAGE = 8;
const PAYMENT_METHODS = ['cash', 'upi'];
const MAX_DOC_SIZE = 1 * 1024 * 1024; // 1 MB

const emptyForm = {
  firstName: '', fatherName: '', lastName: '', certificateName: '',
  address: '', qualification: '', phoneNumber: '', email: '',
  course: '', couponCode: '', courseDuration: '',
  totalFees: '', initialPayment: '0', initialPaymentMethod: 'cash',
  numInstallments: 'none', admissionDate: ''
};
const emptyDocs     = { studentPhoto: null, qualificationDoc: null, aadharCard: null };
const emptyPreviews = { studentPhoto: null, qualificationDoc: null, aadharCard: null };

/* ─── Image Crop Modal ──────────────────────────────────────────────────── */
function getCroppedImg(imgEl, pixelCrop) {
  const scaleX = imgEl.naturalWidth / imgEl.width;
  const scaleY = imgEl.naturalHeight / imgEl.height;
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(pixelCrop.width * scaleX);
  canvas.height = Math.round(pixelCrop.height * scaleY);
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(
    imgEl,
    pixelCrop.x * scaleX, pixelCrop.y * scaleY,
    pixelCrop.width * scaleX, pixelCrop.height * scaleY,
    0, 0, canvas.width, canvas.height,
  );
  return new Promise((resolve) =>
    canvas.toBlob(
      (blob) => resolve(new File([blob], `cropped_${Date.now()}.jpg`, { type: 'image/jpeg' })),
      'image/jpeg',
      0.92,
    )
  );
}

function ImageCropModal({ imageSrc, fieldName, onCrop, onClose }) {
  const imgRef = useRef(null);
  const isPhoto = fieldName === 'studentPhoto';
  const [crop, setCrop] = useState();
  const [completedCrop, setCompletedCrop] = useState(null);

  const onImageLoad = useCallback((e) => {
    const { naturalWidth: w, naturalHeight: h } = e.currentTarget;
    const c = isPhoto
      ? centerCrop(makeAspectCrop({ unit: '%', width: 80 }, 4 / 5, w, h), w, h)
      : centerCrop({ unit: '%', width: 90, height: 90 }, w, h);
    setCrop(c);
  }, [isPhoto]);

  const handleApply = async () => {
    if (!completedCrop || !imgRef.current) return;
    const file = await getCroppedImg(imgRef.current, completedCrop);
    onCrop(file);
  };

  return (
    <div className="modal-overlay" style={{ zIndex: 10001 }}>
      <div className="modal" style={{ maxWidth: 500, width: '95%' }}>
        <div className="modal-header">
          <h3 className="modal-title">✂️ Crop Image</h3>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body" style={{ padding: '1rem' }}>
          <div style={{ textAlign: 'center', marginBottom: '0.75rem', color: 'var(--gray-600)', fontSize: '0.85rem' }}>
            Drag the handles on any side or corner to crop
          </div>
          <div style={{ display: 'flex', justifyContent: 'center' }}>
            <ReactCrop
              crop={crop}
              onChange={(c) => setCrop(c)}
              onComplete={(c) => setCompletedCrop(c)}
              aspect={isPhoto ? 4 / 5 : undefined}
              minWidth={50}
              minHeight={50}
            >
              <img
                ref={imgRef}
                src={imageSrc}
                alt="Crop"
                onLoad={onImageLoad}
                style={{ maxWidth: '100%', maxHeight: 420, display: 'block' }}
              />
            </ReactCrop>
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-outline" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={handleApply} disabled={!completedCrop}>✅ Apply Crop</button>
        </div>
      </div>
    </div>
  );
}

/* ─── Live Camera Modal ──────────────────────────────────────────────────── */
function CameraModal({ label, onCapture, onClose }) {
  const videoRef  = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const [ready,    setReady]    = useState(false);
  const [camError, setCamError] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false });
        if (cancelled) { stream.getTracks().forEach(t => t.stop()); return; }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.onloadedmetadata = () => { if (!cancelled) setReady(true); };
        }
      } catch (err) {
        if (!cancelled) setCamError('Camera access denied or unavailable. Please allow camera permissions in your browser and try again.');
      }
    })();
    return () => {
      cancelled = true;
      if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());
    };
  }, []);

  const capture = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;
    canvas.width  = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext('2d').drawImage(video, 0, 0);
    canvas.toBlob(blob => {
      if (blob) onCapture(new File([blob], `photo_${Date.now()}.jpg`, { type: 'image/jpeg' }));
    }, 'image/jpeg', 0.92);
  };

  return (
    <div className="modal-overlay" style={{ zIndex: 10000 }} onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal modal-sm" style={{ maxHeight: '100vh', display: 'flex', flexDirection: 'column', height: '100%' }}>
        <div className="modal-header">
          <h3 className="modal-title">📷 Capture — {label}</h3>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body" style={{ textAlign: 'center', padding: '1rem', flex: '1', overflow: 'auto', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {camError
            ? <div style={{ padding: '1.5rem', color: '#dc2626', background: '#fef2f2', borderRadius: 8, fontSize: '0.875rem' }}>{camError}</div>
            : <>
                <video ref={videoRef} autoPlay playsInline
                  style={{ width: '100%', maxHeight: 'calc(100vh - 150px)', borderRadius: 8, background: '#000', display: ready ? 'block' : 'none' }} />
                {!ready && !camError && <div style={{ padding: '2rem', color: '#6b7280' }}>Starting camera…</div>}
                <canvas ref={canvasRef} style={{ display: 'none' }} />
              </>
          }
        </div>
        <div className="modal-footer" style={{ flexShrink: 0 }}>
          <button className="btn btn-outline" onClick={onClose}>Cancel</button>
          {ready && !camError && (
            <button className="btn btn-primary" onClick={capture}>📸 Capture Photo</button>
          )}
        </div>
      </div>
    </div>
  );
}

/* ─── Main Component ─────────────────────────────────────────────────────── */
/* ─── Reusable camera-aware doc field (module-level to avoid re-mount) ─────── */
function DocFieldRow({ field, label, hint, accept, preview, docFile, onChange, cameraOk = true, onCamera, onDelete }) {
  return (
    <div className="form-group" key={field}>
      <label className="form-label">{label}</label>
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.25rem', flexWrap: 'wrap' }}>
        <label style={{ flex: '1 1 48%', cursor: 'pointer', padding: '0.6rem 1rem', border: '1px solid var(--gray-300)', borderRadius: 'var(--radius-sm)', background: '#fff', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '0.5rem', justifyContent: 'center', minHeight: '44px' }}>
          📁 Choose File
          <input type="file" style={{ display: 'none' }} accept={accept} onChange={e => onChange(field, e.target.files[0])} />
        </label>
        {cameraOk && (
          <button type="button"
            onClick={() => onCamera && onCamera({ field, label, handler: onChange })}
            style={{ flex: '1 1 48%', cursor: 'pointer', padding: '0.6rem 1rem', border: '1px solid var(--primary)', borderRadius: 'var(--radius-sm)', background: 'var(--primary-light,#eff6ff)', fontSize: '0.9rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', color: 'var(--primary)', fontWeight: 600, minHeight: '44px' }}>
            📷 Camera
          </button>
        )}
      </div>
      <span className="form-hint">{hint}</span>
      {preview && (
        <div style={{ marginTop: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          {preview === 'pdf'
            ? <div style={{ padding: '0.5rem', background: 'var(--success-light)', borderRadius: 4, display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: '0.8rem' }}>
                <span>📄</span><span style={{ color: '#15803d', fontWeight: 600 }}>{docFile?.name}</span>
              </div>
            : <img src={preview} alt={label} style={{ width: 80, height: 80, objectFit: 'cover', borderRadius: 6, border: '2px solid var(--primary)' }} />
          }
          {onDelete && (
            <button type="button" onClick={() => onDelete(field)} style={{ padding: '0.4rem 0.6rem', background: '#fee2e2', border: '1px solid #fecaca', borderRadius: 6, cursor: 'pointer', fontSize: '0.75rem', color: '#dc2626', fontWeight: 600 }}>🗑️ Delete</button>
          )}
        </div>
      )}
    </div>
  );
}

export default function StaffStudents() {
  const [students,          setStudents]          = useState([]);
  const [courses,           setCourses]           = useState([]);
  const [activeDiscounts,   setActiveDiscounts]   = useState([]);
  const [loading,           setLoading]           = useState(true);
  const [showModal,         setShowModal]         = useState(false);
  const [showPaymentModal,  setShowPaymentModal]  = useState(false);
  const [showDetailModal,   setShowDetailModal]   = useState(false);
  const [showDocModal,      setShowDocModal]      = useState(false);
  const [showEditModal,     setShowEditModal]     = useState(false);
  const [editForm,          setEditForm]          = useState(emptyForm);
  const [editDocs,          setEditDocs]          = useState(emptyDocs);
  const [editPreviews,      setEditPreviews]      = useState(emptyPreviews);
  const [editErrors,        setEditErrors]        = useState({});
  const [editCouponInfo,     setEditCouponInfo]   = useState(null);
  const [editCouponLoading,  setEditCouponLoading] = useState(false);
  const [selectedStudent,   setSelectedStudent]   = useState(null);
  const [form,              setForm]              = useState(emptyForm);
  const [docs,              setDocs]              = useState(emptyDocs);
  const [previews,          setPreviews]          = useState(emptyPreviews);
  const [errors,            setErrors]            = useState({});
  const [couponInfo,        setCouponInfo]        = useState(null);
  const [couponLoading,     setCouponLoading]     = useState(false);
  const [,                  setFinalFees]         = useState(0);
  const [paymentForm,       setPaymentForm]       = useState({ amount: '', paymentMethod: 'cash', remarks: '' });
  const [search,            setSearch]            = useState('');
  const [filter,            setFilter]            = useState('all');
  const [page,              setPage]              = useState(1);
  const [submitting,        setSubmitting]        = useState(false);
  const [alert,             setAlert]             = useState(null);
  const [availableInst,     setAvailableInst]     = useState([1, 2, 3, 4, 6, 12]);
  const [cameraField,       setCameraField]       = useState(null);
  const [cropModal,         setCropModal]          = useState(null);
  const [editCropModal,     setEditCropModal]      = useState(null);
  const [uploadDocModal,    setUploadDocModal]    = useState(emptyDocs);
  const [uploadDocPreviews, setUploadDocPreviews] = useState(emptyPreviews);

  /* ── Data fetching ─────────────────────────────────────────────────────── */
  const fetchStudents = useCallback(async () => {
    try { const { data } = await api.get('/students'); setStudents(data); }
    catch (err) { console.error(err); } finally { setLoading(false); }
  }, []);
  const fetchCourses = useCallback(async () => {
    try { const { data } = await api.get('/courses'); setCourses(data.filter(c => c.isActive !== false)); }
    catch (err) { console.error(err); }
  }, []);
  const fetchDiscounts = useCallback(async () => {
    try { const { data } = await api.get('/discounts/active'); setActiveDiscounts(data); }
    catch (err) { console.error(err); }
  }, []);

  useEffect(() => { fetchStudents(); fetchCourses(); fetchDiscounts(); }, [fetchStudents, fetchCourses, fetchDiscounts]);

  /* ── Enquiry → Admission prefill ────────────────────────────────────────── */
  useEffect(() => {
    const raw = sessionStorage.getItem('convertEnquiry');
    if (!raw) return;
    try {
      const enq = JSON.parse(raw);
      sessionStorage.removeItem('convertEnquiry');
      const courseId = enq.interestedCourse?._id || enq.interestedCourse || '';
      setForm(f => ({
        ...f,
        firstName: enq.firstName || '', fatherName: enq.fatherName || '', lastName: enq.lastName || '',
        phoneNumber: enq.phoneNumber || '', email: enq.email || '', address: enq.address || '',
        qualification: enq.qualification || '', course: courseId,
      }));
      setCouponInfo(null); setFinalFees(0); setErrors({}); setDocs(emptyDocs); setPreviews(emptyPreviews);
      setShowModal(true);
    } catch (e) { console.error('Enquiry parse failed', e); }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  /* Auto-fill fees once courses load for pre-selected course */
  useEffect(() => {
    if (!showModal || !form.course || form.totalFees) return;
    const matched = courses.find(c => c._id === form.course);
    if (matched) {
      setForm(f => ({ ...f, totalFees: String(matched.fees || matched.defaultFees || ''), courseDuration: String(matched.duration || '') }));
      setFinalFees(matched.fees || matched.defaultFees || 0);
      setAvailableInst(matched.installmentOptions || [1, 2, 3, 4, 6, 12]);
    }
  }, [courses, showModal, form.course, form.totalFees]);

  const showAlert = (type, message) => { setAlert({ type, message }); setTimeout(() => setAlert(null), 4000); };

  /* ── Filtering & Pagination ─────────────────────────────────────────────── */
  const filtered = students.filter(s => {
    const name = `${s.firstName} ${s.fatherName} ${s.lastName}`.toLowerCase();
    const matchSearch = !search || name.includes(search.toLowerCase()) || s.phoneNumber.includes(search);
    const matchFilter = filter === 'all' || s.status === filter ||
      (filter === 'paid' && s.pendingFees === 0) || (filter === 'pending' && s.pendingFees > 0);
    return matchSearch && matchFilter;
  });
  const totalPages = Math.ceil(filtered.length / PER_PAGE);
  const paginated  = filtered.slice((page - 1) * PER_PAGE, page * PER_PAGE);

  /* ── Handlers ───────────────────────────────────────────────────────────── */
  const handleCourseChange = (courseId) => {
    const c = courses.find(co => co._id === courseId);
    setForm(f => ({ ...f, course: courseId, totalFees: c ? String(c.fees || c.defaultFees || '') : '', courseDuration: c ? String(c.duration || '') : '', numInstallments: 'none', initialPayment: '0' }));
    setCouponInfo(null);
    if (c) { setFinalFees(c.fees || c.defaultFees || 0); setAvailableInst(c.installmentOptions || [1, 2, 3, 4, 6, 12]); }
  };

  const handleDiscountSelect = (e) => {
    const selected = activeDiscounts.find(d => d.couponCode === e.target.value);
    if (!selected) { setForm(f => ({ ...f, couponCode: '', numInstallments: 'none' })); setCouponInfo(null); setFinalFees(Number(form.totalFees)); return; }
    setForm(f => ({ ...f, couponCode: selected.couponCode, numInstallments: 'none', initialPayment: String(couponInfo ? couponInfo.finalFees : Number(form.totalFees)) }));
    setCouponInfo(null);
  };

  const validateCoupon = async () => {
    if (!form.couponCode.trim() || !form.totalFees) return;
    setCouponLoading(true); setCouponInfo(null);
    try {
      const { data } = await api.post('/discounts/validate', { couponCode: form.couponCode, courseFees: Number(form.totalFees) });
      setCouponInfo(data); setFinalFees(data.finalFees);
      setForm(f => ({ ...f, numInstallments: 'none', initialPayment: String(data.finalFees) }));
      showAlert('success', `Coupon applied! Full payment of ₹${data.finalFees.toLocaleString('en-IN')} required.`);
    } catch (err) { showAlert('error', err.response?.data?.message || 'Invalid coupon'); setFinalFees(Number(form.totalFees)); }
    finally { setCouponLoading(false); }
  };

  const buildInstallments = () => {
    const total = couponInfo ? couponInfo.finalFees : Number(form.totalFees);
    if (form.numInstallments === 'none') return [{ amount: total, dueDate: new Date().toISOString().split('T')[0] }];
    const n = parseInt(form.numInstallments) || 1;
    const each = Math.floor(total / n); const rem = total - each * n;
    return Array.from({ length: n }, (_, i) => {
      const d = new Date(); d.setMonth(d.getMonth() + i);
      return { amount: i === n - 1 ? each + rem : each, dueDate: d.toISOString().split('T')[0] };
    });
  };

  const validate = () => {
    const e = {};
    if (!form.firstName.trim()) e.firstName = 'Required';
    // if (!form.fatherName.trim()) e.fatherName = 'Required';
    // if (!form.lastName.trim()) e.lastName = 'Required';
    if (!form.phoneNumber.match(/^[0-9]{10}$/)) e.phoneNumber = 'Enter valid 10-digit number';
    if (!form.address.trim()) e.address = 'Required';
    if (!form.qualification.trim()) e.qualification = 'Required';
    if (!form.course) e.course = 'Select a course';
    if (!form.totalFees) e.totalFees = 'Required';
    setErrors(e); return Object.keys(e).length === 0;
  };

  const handleDocChange = (field, file) => {
    if (!file) return;
    if (file.size > MAX_DOC_SIZE) { showAlert('error', 'File size must be 1 MB or less.'); return; }
    if (file.type.startsWith('image/')) {
      const r = new FileReader();
      r.onload = ev => setCropModal({ field, imageSrc: ev.target.result });
      r.readAsDataURL(file);
    } else {
      setDocs(d => ({ ...d, [field]: file }));
      setPreviews(p => ({ ...p, [field]: 'pdf' }));
    }
  };

  const handleCropApply = (field, croppedFile) => {
    setDocs(d => ({ ...d, [field]: croppedFile }));
    const r = new FileReader();
    r.onload = ev => setPreviews(p => ({ ...p, [field]: ev.target.result }));
    r.readAsDataURL(croppedFile);
    setCropModal(null);
  };

  const handleDocDelete = (field) => {
    setDocs(d => ({ ...d, [field]: null }));
    setPreviews(p => ({ ...p, [field]: null }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault(); if (!validate()) return;
    setSubmitting(true);
    try {
      const installments = buildInstallments();
      const initialPay = Number(form.initialPayment) || 0;
      const fd = new FormData();
      ['firstName','fatherName','lastName','certificateName','address','qualification','phoneNumber','email'].forEach(k => fd.append(k, form[k].trim()));
      fd.append('course', form.course);
      fd.append('totalFees', Number(form.totalFees));
      fd.append('paidFees', initialPay);
      fd.append('initialPaymentMethod', form.initialPaymentMethod || 'cash');
      if (form.couponCode.trim()) fd.append('couponCode', form.couponCode.trim());
      fd.append('courseDuration', Number(form.courseDuration) || 3);
      fd.append('admissionDate', form.admissionDate || '');
      fd.append('installments', JSON.stringify(installments));
      if (docs.studentPhoto)    fd.append('studentPhoto',    docs.studentPhoto);
      if (docs.qualificationDoc) fd.append('qualificationDoc', docs.qualificationDoc);
      if (docs.aadharCard)      fd.append('aadharCard',      docs.aadharCard);
      const { data } = await api.post('/students', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      if (data.invoice?.url) window.open(`${BASE_URL}${data.invoice.url}?token=${localStorage.getItem('token')}`, '_blank');
      showAlert('success', 'Student added successfully!');
      setShowModal(false); setForm(emptyForm); setCouponInfo(null); setFinalFees(0); setDocs(emptyDocs); setPreviews(emptyPreviews);
      fetchStudents();
    } catch (err) { showAlert('error', err.response?.data?.message || 'Failed to add student'); }
    finally { setSubmitting(false); }
  };

  const handleAddPayment = async (e) => {
    e.preventDefault();
    if (!paymentForm.amount || Number(paymentForm.amount) <= 0) return showAlert('error', 'Enter valid amount');
    if (Number(paymentForm.amount) > selectedStudent.pendingFees) return showAlert('error', `Cannot exceed pending (₹${selectedStudent.pendingFees.toLocaleString('en-IN')})`);
    setSubmitting(true);
    try {
      const { data } = await api.post(`/students/${selectedStudent._id}/payment`, { amount: Number(paymentForm.amount), paymentMethod: paymentForm.paymentMethod, remarks: paymentForm.remarks });
      if (data.invoice?.url) window.open(`${BASE_URL}${data.invoice.url}?token=${localStorage.getItem('token')}`, '_blank');
      showAlert('success', 'Payment recorded!'); setShowPaymentModal(false); setPaymentForm({ amount: '', paymentMethod: 'cash', remarks: '' }); fetchStudents();
    } catch (err) { showAlert('error', err.response?.data?.message || 'Failed'); }
    finally { setSubmitting(false); }
  };

  // const handleDelete = async (id) => {
  //   if (!window.confirm('Remove this student?')) return;
  //   try { await api.delete(`/students/${id}`); showAlert('success', 'Student removed'); fetchStudents(); }
  //   catch (err) { showAlert('error', 'Failed to remove student'); }
  // };

  const handleUploadDocChange = (field, file) => {
    if (!file) return;
    if (file.size > MAX_DOC_SIZE) { showAlert('error', 'File size must be 1 MB or less.'); return; }
    setUploadDocModal(d => ({ ...d, [field]: file }));
    if (file.type.startsWith('image/')) {
      const r = new FileReader(); r.onload = ev => setUploadDocPreviews(p => ({ ...p, [field]: ev.target.result })); r.readAsDataURL(file);
    } else { setUploadDocPreviews(p => ({ ...p, [field]: 'pdf' })); }
  };

  const handleDocumentUpload = async (e) => {
    e.preventDefault();
    if (!uploadDocModal.studentPhoto && !uploadDocModal.qualificationDoc && !uploadDocModal.aadharCard) return showAlert('error', 'Select at least one file');
    setSubmitting(true);
    try {
      const fd = new FormData();
      if (uploadDocModal.studentPhoto)    fd.append('studentPhoto',    uploadDocModal.studentPhoto);
      if (uploadDocModal.qualificationDoc) fd.append('qualificationDoc', uploadDocModal.qualificationDoc);
      if (uploadDocModal.aadharCard)      fd.append('aadharCard',      uploadDocModal.aadharCard);
      await api.post(`/students/${selectedStudent._id}/upload-document`, fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      showAlert('success', 'Documents uploaded!'); setShowDocModal(false); setUploadDocModal(emptyDocs); setUploadDocPreviews(emptyPreviews); fetchStudents();
    } catch (err) { showAlert('error', 'Upload failed'); }
    finally { setSubmitting(false); }
  };

  const openDetail    = s => { setSelectedStudent(s); setShowDetailModal(true); };
  const openPayment   = s => { setSelectedStudent(s); setPaymentForm({ amount: '', paymentMethod: 'cash', remarks: '' }); setShowPaymentModal(true); };
  const openDocUpload = s => { setSelectedStudent(s); setUploadDocModal(emptyDocs); setUploadDocPreviews(emptyPreviews); setShowDocModal(true); };
  const openEdit = (student) => {
    setSelectedStudent(student);
    setEditForm({
      firstName: student.firstName || '',
      fatherName: student.fatherName || '',
      lastName: student.lastName || '',
      certificateName: student.certificateName || '',
      phoneNumber: student.phoneNumber || '',
      email: student.email || '',
      address: student.address || '',
      qualification: student.qualification || '',
      course: typeof student.course === 'object' ? student.course._id : student.course || '',
      courseDuration: String(student.courseDuration || ''),
      totalFees: String(student.totalFees || ''),
      couponCode: student.discount?.couponCode || '',
      status: student.status || 'active',
      admissionDate: student.enrollmentDate ? student.enrollmentDate.split('T')[0] : ''
    });
    setEditDocs(emptyDocs);
    setEditPreviews(emptyPreviews);
    setEditErrors({});
    setEditCouponInfo(student.discount ? {
      percentage: student.discount.percentage,
      finalFees: student.finalFees || student.totalFees,
      discountAmount: (student.totalFees - (student.finalFees || student.totalFees)),
    } : null);
    setShowEditModal(true);
  };

  const handleEditDocChange = (field, file) => {
    if (!file) return;
    if (file.size > MAX_DOC_SIZE) { showAlert('error', 'File size must be 1 MB or less.'); return; }
    if (file.type.startsWith('image/')) {
      const r = new FileReader();
      r.onload = ev => setEditCropModal({ field, imageSrc: ev.target.result });
      r.readAsDataURL(file);
    } else {
      setEditDocs(d => ({ ...d, [field]: file }));
      setEditPreviews(p => ({ ...p, [field]: 'pdf' }));
    }
  };

  const handleEditCropApply = (field, croppedFile) => {
    setEditDocs(d => ({ ...d, [field]: croppedFile }));
    const r = new FileReader();
    r.onload = ev => setEditPreviews(p => ({ ...p, [field]: ev.target.result }));
    r.readAsDataURL(croppedFile);
    setEditCropModal(null);
  };

  const handleEditDocDelete = (field) => {
    setEditDocs(d => ({ ...d, [field]: null }));
    setEditPreviews(p => ({ ...p, [field]: null }));
  };

  const handleEditCourseChange = (courseId) => {
    const c = courses.find(co => co._id === courseId);
    setEditForm(f => ({ ...f, course: courseId, totalFees: c ? String(c.fees || c.defaultFees || '') : '', courseDuration: c ? String(c.duration || '') : '' }));
    setEditCouponInfo(null);
  };

  const handleEditDiscountSelect = (e) => {
    const selected = activeDiscounts.find(d => d.couponCode === e.target.value);
    if (!selected) {
      setEditForm(f => ({ ...f, couponCode: '' }));
      setEditCouponInfo(null);
      return;
    }
    setEditForm(f => ({ ...f, couponCode: selected.couponCode }));
    setEditCouponInfo({
      percentage: selected.percentage,
      finalFees: Number(editForm.totalFees) - (Number(editForm.totalFees) * selected.percentage / 100),
      discountAmount: Number(editForm.totalFees) * selected.percentage / 100,
    });
  };

  const validateEditCoupon = async () => {
    if (!editForm.couponCode.trim()) return;
    if (!editForm.totalFees) return showAlert('error', 'Select a course first');
    setEditCouponLoading(true);
    setEditCouponInfo(null);
    try {
      const { data } = await api.post('/discounts/validate', { couponCode: editForm.couponCode, courseFees: Number(editForm.totalFees) });
      setEditCouponInfo(data);
      showAlert('success', `Coupon applied! ${data.percentage}% off → Final: ₹${data.finalFees.toLocaleString('en-IN')}`);
    } catch (err) { showAlert('error', err.response?.data?.message || 'Invalid coupon'); }
    finally { setEditCouponLoading(false); }
  };

  const validateEdit = () => {
    const e = {};
    if (!editForm.firstName.trim()) e.firstName = 'Required';
    // if (!editForm.fatherName.trim()) e.fatherName = 'Required';
    // if (!editForm.lastName.trim()) e.lastName = 'Required';
    if (!editForm.phoneNumber.match(/^[0-9]{10}$/)) e.phoneNumber = 'Enter valid 10-digit number';
    if (!editForm.address.trim()) e.address = 'Required';
    if (!editForm.qualification.trim()) e.qualification = 'Required';
    if (!editForm.course) e.course = 'Select a course';
    if (!editForm.totalFees) e.totalFees = 'Required';
    setEditErrors(e); return Object.keys(e).length === 0;
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault(); if (!validateEdit()) return;
    setSubmitting(true);
    try {
      const fd = new FormData();
      fd.append('firstName', editForm.firstName.trim());
      fd.append('fatherName', editForm.fatherName.trim());
      fd.append('lastName', editForm.lastName.trim());
      if (editForm.certificateName.trim()) fd.append('certificateName', editForm.certificateName.trim());
      fd.append('address', editForm.address.trim());
      fd.append('qualification', editForm.qualification.trim());
      fd.append('phoneNumber', editForm.phoneNumber.trim());
      fd.append('email', editForm.email.trim());
      fd.append('course', editForm.course);
      fd.append('totalFees', Number(editForm.totalFees));
      fd.append('courseDuration', Number(editForm.courseDuration) || 3);
      fd.append('admissionDate', editForm.admissionDate || '');
      fd.append('status', editForm.status);
      if (editForm.couponCode.trim()) fd.append('couponCode', editForm.couponCode.trim());
      if (editDocs.studentPhoto)    fd.append('studentPhoto',    editDocs.studentPhoto);
      if (editDocs.qualificationDoc) fd.append('qualificationDoc', editDocs.qualificationDoc);
      if (editDocs.aadharCard)      fd.append('aadharCard',      editDocs.aadharCard);

      await api.put(`/students/${selectedStudent._id}`, fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      showAlert('success', 'Student updated successfully!');
      setShowEditModal(false); setShowDetailModal(false);
      setEditForm(emptyForm); setEditDocs(emptyDocs); setEditPreviews(emptyPreviews);
      setEditCouponInfo(null);
      fetchStudents();
    } catch (err) { showAlert('error', err.response?.data?.message || 'Failed to update student'); }
    finally { setSubmitting(false); }
  };

  const fmt       = n  => `₹${(n || 0).toLocaleString('en-IN')}`;
  const getDocUrl = (s, field) => s[field]?.fileUrl ? `${BASE_URL}${s[field].fileUrl}?token=${localStorage.getItem('token')}` : null;
  const isImage   = url => url && /\.(jpg|jpeg|png)$/i.test(url);

  const DocThumb = ({ url, label }) => !url
    ? <span style={{ color: 'var(--gray-400)', fontSize: '0.75rem' }}>—</span>
    : isImage(url)
      ? <a href={url} target="_blank" rel="noopener noreferrer"><img src={url} alt={label} style={{ width: 36, height: 36, objectFit: 'cover', borderRadius: 4, border: '1px solid var(--gray-200)' }} /></a>
      : <a href={url} target="_blank" rel="noopener noreferrer" style={{ fontSize: '1.25rem' }}>📄</a>;


  return (
    <div>
      {alert && <div className={`alert alert-${alert.type}`} style={{ position: 'fixed', top: '1rem', right: '1rem', zIndex: 9999, maxWidth: '380px' }}>{alert.type === 'success' ? '✅' : '❌'} {alert.message}</div>}

      <div className="page-header">
        <div className="page-header-left">
          <h1 className="page-title">👨‍🎓 Student Management</h1>
          <p className="page-subtitle">{students.length} total students</p>
        </div>
        <button className="btn btn-primary" onClick={() => { setForm(emptyForm); setCouponInfo(null); setFinalFees(0); setErrors({}); setDocs(emptyDocs); setPreviews(emptyPreviews); setShowModal(true); }}>
          + Student Admission
        </button>
      </div>

      <div className="card">
        <div className="card-header">
          <div className="toolbar">
            <div className="search-box">
              <span className="search-icon">🔍</span>
              <input placeholder="Search name, phone..." value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} />
            </div>
            <div className="filter-tabs">
              {['all','active','inactive','paid','pending'].map(f => (
                <button key={f} className={`filter-tab ${filter === f ? 'active' : ''}`} onClick={() => { setFilter(f); setPage(1); }}>
                  {f.charAt(0).toUpperCase() + f.slice(1)}
                </button>
              ))}
            </div>
          </div>
        </div>

        {loading ? <div className="loading-state"><div className="spinner"></div></div>
          : paginated.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">👨‍🎓</div>
              <div className="empty-title">No students found</div>
              <div className="empty-text">Try adjusting your search or filters</div>
              <button className="btn btn-primary" onClick={() => setShowModal(true)}>Student Admission</button>
            </div>
          ) : (
            <div className="table-responsive">
              <div className="table-container">
                <table>
                  <thead>
                    <tr><th>Student</th><th>Course</th><th>Total Fees</th><th>Paid</th><th>Pending</th><th>Documents</th><th>Status</th><th>Actions</th></tr>
                  </thead>
                  <tbody>
                    {paginated.map(s => (
                      <tr key={s._id}>
                        <td data-label="Student">
                          <div className="td-name">{s.firstName} {s.fatherName} {s.lastName}</div>
                          <div className="td-sub">{s.phoneNumber}</div>
                          {s.discount?.couponCode && <div className="td-sub">🏷️ {s.discount.couponCode} ({s.discount.percentage}%)</div>}
                        </td>
                        <td data-label="Course">
                          <div>{s.course?.name}</div>
                          <div className="td-sub">{s.courseDuration}m</div>
                        </td>
                        <td data-label="Total">{fmt(s.finalFees || s.totalFees)}</td>
                        <td data-label="Paid"><span className="amount amount-paid">{fmt(s.paidFees)}</span></td>
                        <td data-label="Pending"><span className="amount amount-pending">{fmt(s.pendingFees)}</span></td>
                        <td data-label="Documents" style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                          <DocThumb url={getDocUrl(s, 'studentPhoto')} label="Photo" />
                          <DocThumb url={getDocUrl(s, 'qualificationDoc')} label="Qual" />
                          <DocThumb url={getDocUrl(s, 'aadharCard')} label="Aadhar" />
                        </td>
                        <td data-label="Status">
                          <span className={`badge ${s.status === 'active' ? 'badge-success' : 'badge-gray'}`}>{s.status}</span>
                        </td>
                        <td className="td-actions" data-label="Actions">
                          <button className="btn btn-sm btn-outline"  onClick={() => openDetail(s)}>View</button>
                          <button className="btn btn-sm btn-warning"  onClick={() => openDocUpload(s)}>📄 Docs</button>
                          <button className="btn btn-sm btn-success"  onClick={() => openPayment(s)} disabled={s.pendingFees === 0}>Pay</button>

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
            <span className="pagination-info">Showing {(page-1)*PER_PAGE+1}–{Math.min(page*PER_PAGE, filtered.length)} of {filtered.length}</span>
            <div className="pagination-controls">
              <button className="page-btn" disabled={page === 1} onClick={() => setPage(p => p-1)}>‹</button>
              {Array.from({ length: totalPages }, (_, i) => i+1).filter(p => Math.abs(p-page) <= 2).map(p => (
                <button key={p} className={`page-btn ${p === page ? 'active' : ''}`} onClick={() => setPage(p)}>{p}</button>
              ))}
              <button className="page-btn" disabled={page === totalPages} onClick={() => setPage(p => p+1)}>›</button>
            </div>
          </div>
        )}
      </div>

      {/* ── ADD STUDENT MODAL ──────────────────────────────────────────────── */}
      {showModal && (
        <div className="modal-overlay">
          <div className="modal modal-lg">
            <div className="modal-header">
              <h3 className="modal-title">➕ Add New Student</h3>
              <button className="modal-close" onClick={() => setShowModal(false)}>✕</button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="modal-body">
                <div className="form-grid">
                  <div style={{ gridColumn: '1 / -1' }} className="form-section-title">Personal Information</div>
                  <div className="form-group"><label className="form-label">First Name <span className="required">*</span></label><input className={`form-input ${errors.firstName?'error':''}`} placeholder="e.g. Rahul" value={form.firstName} onChange={e => setForm({...form, firstName: e.target.value})} />{errors.firstName && <span className="form-error">{errors.firstName}</span>}</div>
                  <div className="form-group"><label className="form-label">Father's Name</label><input className={`form-input ${errors.fatherName?'error':''}`} placeholder="e.g. Suresh" value={form.fatherName} onChange={e => setForm({...form, fatherName: e.target.value})} />{errors.fatherName && <span className="form-error">{errors.fatherName}</span>}</div>
                  <div className="form-group"><label className="form-label">Surname</label><input className={`form-input ${errors.lastName?'error':''}`} placeholder="e.g. Kumar" value={form.lastName} onChange={e => setForm({...form, lastName: e.target.value})} />{errors.lastName && <span className="form-error">{errors.lastName}</span>}</div>
                  <div className="form-group"><label className="form-label">Certificate Name</label><input className="form-input" placeholder="Name as it should appear on certificate (optional)" value={form.certificateName} onChange={e => setForm({...form, certificateName: e.target.value})} /><span className="form-hint">Leave empty to use First Name + Surname</span></div>
                  <div className="form-group"><label className="form-label">Mobile <span className="required">*</span></label><input className={`form-input ${errors.phoneNumber?'error':''}`} placeholder="10-digit" maxLength={10} value={form.phoneNumber} onChange={e => setForm({...form, phoneNumber: e.target.value.replace(/\D/g,'')})} />{errors.phoneNumber && <span className="form-error">{errors.phoneNumber}</span>}</div>
                  <div className="form-group"><label className="form-label">Email</label><input type="email" className="form-input" placeholder="Optional" value={form.email} onChange={e => setForm({...form, email: e.target.value})} /></div>
                  <div className="form-group"><label className="form-label">Qualification <span className="required">*</span></label><input className={`form-input ${errors.qualification?'error':''}`} placeholder="e.g. B.Tech CSE" value={form.qualification} onChange={e => setForm({...form, qualification: e.target.value.replace(/[^a-zA-Z0-9 .]/g,'')})} />{errors.qualification && <span className="form-error">{errors.qualification}</span>}</div>
                  <div className="form-group full-width"><label className="form-label">Address <span className="required">*</span></label><textarea className={`form-textarea ${errors.address?'error':''}`} placeholder="Full address" rows={2} value={form.address} onChange={e => setForm({...form, address: e.target.value})} />{errors.address && <span className="form-error">{errors.address}</span>}</div>

                  <div style={{ gridColumn: '1 / -1' }} className="form-section-title">Course & Fees</div>
                  <div className="form-group"><label className="form-label">Course <span className="required">*</span></label><select className={`form-select ${errors.course?'error':''}`} value={form.course} onChange={e => handleCourseChange(e.target.value)}><option value="">Select Course</option>{courses.map(c => <option key={c._id} value={c._id}>{c.name}</option>)}</select>{errors.course && <span className="form-error">{errors.course}</span>}</div>
                  <div className="form-group"><label className="form-label">Duration (months)</label><input type="number" className="form-input" placeholder="e.g. 6" value={form.courseDuration} onChange={e => setForm({...form, courseDuration: e.target.value})} /></div>
                  <div className="form-group"><label className="form-label">Admission Date</label><input type="date" className="form-input" value={form.admissionDate} onChange={e => setForm({...form, admissionDate: e.target.value})} /></div>
                  <div className="form-group"><label className="form-label">Course Fees (₹) <span className="required">*</span></label><input type="number" className={`form-input ${errors.totalFees?'error':''}`} placeholder="Total fees" value={form.totalFees} onChange={e => { setForm({...form, totalFees: e.target.value}); setFinalFees(Number(e.target.value)); setCouponInfo(null); }} />{errors.totalFees && <span className="form-error">{errors.totalFees}</span>}</div>
                  <div className="form-group">
                    <label className="form-label">Discount Coupon</label>
                    <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem' }}>
                      <select className="form-select" value={form.couponCode} onChange={handleDiscountSelect} style={{ flex: 1 }}>
                        <option value="">-- Select Discount --</option>
                        {activeDiscounts.map(d => <option key={d._id} value={d.couponCode}>{d.couponCode} — {d.percentage}% off ({d.description})</option>)}
                      </select>
                    </div>
                    <div className="coupon-row">
                      <input className="form-input" placeholder="Or type coupon code" value={form.couponCode} onChange={e => { setForm({...form, couponCode: e.target.value.toUpperCase()}); setCouponInfo(null); setFinalFees(Number(form.totalFees)); }} />
                      <button type="button" className="btn btn-outline" onClick={validateCoupon} disabled={couponLoading || !form.couponCode || !form.totalFees}>{couponLoading ? '...' : 'Apply'}</button>
                    </div>
                    {couponInfo && <div className="discount-badge">🏷️ {couponInfo.percentage}% off → Final: ₹{couponInfo.finalFees.toLocaleString('en-IN')}</div>}
                  </div>

                  {form.totalFees && (
                    <div className="form-group full-width">
                      <div style={{ padding: '0.875rem', background: 'var(--gray-50)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--gray-200)', display: 'flex', gap: '1.5rem', flexWrap: 'wrap' }}>
                        {couponInfo && <span>Original: <s>₹{Number(form.totalFees).toLocaleString('en-IN')}</s></span>}
                        <span style={{ fontWeight: 700, color: 'var(--primary)', fontSize: '1rem' }}>Final Fees: ₹{(couponInfo ? couponInfo.finalFees : Number(form.totalFees)).toLocaleString('en-IN')}</span>
                        {couponInfo && <span style={{ color: 'var(--success)', fontWeight: 600 }}>Save: ₹{couponInfo.discountAmount.toLocaleString('en-IN')}</span>}
                      </div>
                    </div>
                  )}

                  <div style={{ gridColumn: '1 / -1' }} className="form-section-title">Initial Payment & Installments</div>
                  <div className="form-group">
                    <label className="form-label">Initial Payment (₹)</label>
                    <input type="number" className="form-input" placeholder="Amount paid now" min="0" max={couponInfo ? couponInfo.finalFees : form.totalFees} step="1"
                      value={form.initialPayment} readOnly={!!couponInfo} style={couponInfo ? { background: '#f3f4f6', cursor: 'not-allowed', fontWeight: 600 } : {}}
                      onChange={e => {
                        if (couponInfo) return;
                        const v = Number(e.target.value); const max = Number(form.totalFees);
                        if (v <= max) setForm({...form, initialPayment: e.target.value});
                        else showAlert('error', `Cannot exceed ₹${max.toLocaleString('en-IN')}`);
                      }} />
                    <span className="form-hint">{couponInfo ? <span style={{ color: '#b45309', fontWeight: 600 }}>🔒 Full payment locked — discount applied</span> : `Maximum: ₹${(Number(form.totalFees)||0).toLocaleString('en-IN')}`}</span>
                  </div>
                  <div className="form-group"><label className="form-label">Payment Method</label><select className="form-select" value={form.initialPaymentMethod} onChange={e => setForm({...form, initialPaymentMethod: e.target.value})}>{PAYMENT_METHODS.map(m => <option key={m} value={m}>{m.toUpperCase()}</option>)}</select></div>
                  <div className="form-group">
                    <label className="form-label">Number of Installments</label>
                    {couponInfo ? (
                      <div style={{ padding: '0.5rem 0.75rem', background: '#fef3c7', border: '1px solid #f59e0b', borderRadius: 'var(--radius-sm)', fontSize: '0.85rem', color: '#92400e', fontWeight: 600 }}>
                        🔒 Installments not available with discount — Full payment required
                      </div>
                    ) : (
                      <select className="form-select" value={form.numInstallments} onChange={e => {
                          const val = e.target.value;
                          const total = couponInfo ? couponInfo.finalFees : Number(form.totalFees);
                          const auto = val === 'none' ? String(total) : String(Math.floor(total / (parseInt(val) || 1)));
                          setForm(f => ({ ...f, numInstallments: val, initialPayment: auto }));
                        }}>
                        <option value="none">None (Full payment now)</option>
                        <option value="1">1 Installment</option>
                        {availableInst.filter(n => n > 1).map(n => <option key={n} value={n}>{n} installments</option>)}
                      </select>
                    )}
                    <span className="form-hint">
                      {couponInfo ? <span style={{ color: '#b45309', fontWeight: 600 }}>✓ Full discounted amount auto-filled above</span>
                        : form.numInstallments === 'none' ? <span style={{ color: 'var(--primary)', fontWeight: 600 }}>✓ Full fees collected upfront</span>
                        : `≈ ₹${Math.floor((couponInfo ? couponInfo.finalFees : Number(form.totalFees)) / Number(form.numInstallments)).toLocaleString('en-IN')} per installment`}
                    </span>
                  </div>

                  <div style={{ gridColumn: '1 / -1' }} className="form-section-title">Document Uploads</div>
                  <DocFieldRow field="studentPhoto"    label="🖼️ Student Photo"          hint="Clear passport-size photo (JPG, PNG) · Max 1 MB"            accept="image/jpeg,image/jpg,image/png" preview={previews.studentPhoto}    docFile={docs.studentPhoto}    onChange={handleDocChange} cameraOk={true}  onCamera={setCameraField} onDelete={handleDocDelete} />
                  <DocFieldRow field="qualificationDoc" label="📜 Qualification Document" hint="Mark sheet, degree or certificate (JPG, PNG, PDF) · Max 1 MB" accept=".pdf,.jpg,.jpeg,.png"           preview={previews.qualificationDoc} docFile={docs.qualificationDoc} onChange={handleDocChange} cameraOk={true}  onCamera={setCameraField} onDelete={handleDocDelete} />
                  <DocFieldRow field="aadharCard"       label="🪪 Aadhar Card"            hint="Front side of Aadhar card (JPG, PNG) · Max 1 MB"             accept="image/jpeg,image/jpg,image/png" preview={previews.aadharCard}      docFile={docs.aadharCard}      onChange={handleDocChange} cameraOk={true}  onCamera={setCameraField} onDelete={handleDocDelete} />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-outline" onClick={() => setShowModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={submitting}>{submitting ? '⏳ Adding...' : '✅ Student Admission'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── PAYMENT MODAL ─────────────────────────────────────────────────── */}
      {showPaymentModal && selectedStudent && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowPaymentModal(false)}>
          <div className="modal modal-sm">
            <div className="modal-header"><h3 className="modal-title">💰 Add Payment</h3><button className="modal-close" onClick={() => setShowPaymentModal(false)}>✕</button></div>
            <form onSubmit={handleAddPayment}>
              <div className="modal-body">
                <div style={{ padding: '0.875rem', background: 'var(--gray-50)', borderRadius: 'var(--radius-sm)', marginBottom: '1rem' }}>
                  <div style={{ fontWeight: 600 }}>{selectedStudent.firstName} {selectedStudent.fatherName} {selectedStudent.lastName}</div>
                  <div style={{ fontSize: '0.85rem', color: 'var(--gray-500)', marginTop: 4 }}>Pending: <strong style={{ color: 'var(--danger)' }}>₹{(selectedStudent.pendingFees||0).toLocaleString('en-IN')}</strong></div>
                </div>
                <div className="form-group" style={{ marginBottom: '0.875rem' }}><label className="form-label">Amount (₹) <span className="required">*</span></label><input type="number" className="form-input" placeholder="Enter amount" max={selectedStudent.pendingFees} value={paymentForm.amount} onChange={e => setPaymentForm({...paymentForm, amount: e.target.value})} required /></div>
                <div className="form-group" style={{ marginBottom: '0.875rem' }}><label className="form-label">Payment Method</label><select className="form-select" value={paymentForm.paymentMethod} onChange={e => setPaymentForm({...paymentForm, paymentMethod: e.target.value})}>{PAYMENT_METHODS.map(m => <option key={m} value={m}>{m.replace('_',' ')}</option>)}</select></div>
                <div className="form-group"><label className="form-label">Remarks</label><input className="form-input" placeholder="Optional notes" value={paymentForm.remarks} onChange={e => setPaymentForm({...paymentForm, remarks: e.target.value})} /></div>
              </div>
              <div className="modal-footer"><button type="button" className="btn btn-outline" onClick={() => setShowPaymentModal(false)}>Cancel</button><button type="submit" className="btn btn-success" disabled={submitting}>{submitting ? '...' : '✅ Record Payment'}</button></div>
            </form>
          </div>
        </div>
      )}

      {/* ── DETAIL MODAL ──────────────────────────────────────────────────── */}
      {showDetailModal && selectedStudent && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowDetailModal(false)}>
          <div className="modal modal-lg">
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <h3 className="modal-title">👤 Student Details</h3>
                <button className="btn btn-sm btn-warning" onClick={() => { setShowDetailModal(false); openEdit(selectedStudent); }} style={{ marginLeft: 'auto' }}>✏️ Edit</button>
              </div>
              <button className="modal-close" onClick={() => setShowDetailModal(false)}>✕</button>
            </div>
            <div className="modal-body">
              <div className="form-grid">
                <div><div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--gray-500)', textTransform: 'uppercase', marginBottom: 2 }}>Full Name</div><div style={{ fontWeight: 600 }}>{selectedStudent.firstName} {selectedStudent.fatherName} {selectedStudent.lastName}</div></div>
                <div><div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--gray-500)', textTransform: 'uppercase', marginBottom: 2 }}>Phone</div><div>{selectedStudent.phoneNumber}</div></div>
                <div><div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--gray-500)', textTransform: 'uppercase', marginBottom: 2 }}>Course</div><div>{selectedStudent.course?.name}</div></div>
                <div><div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--gray-500)', textTransform: 'uppercase', marginBottom: 2 }}>Qualification</div><div>{selectedStudent.qualification}</div></div>
                <div className="full-width"><div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--gray-500)', textTransform: 'uppercase', marginBottom: 2 }}>Address</div><div>{selectedStudent.address}</div></div>
              </div>
              <div style={{ margin: '1rem 0', padding: '1rem', background: 'var(--gray-50)', borderRadius: 'var(--radius-sm)', display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '1rem' }}>
                <div style={{ textAlign: 'center' }}><div style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--gray-800)' }}>₹{(selectedStudent.finalFees||selectedStudent.totalFees||0).toLocaleString('en-IN')}</div><div style={{ fontSize: '0.72rem', color: 'var(--gray-500)' }}>Total Fees</div></div>
                <div style={{ textAlign: 'center' }}><div style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--success)' }}>₹{(selectedStudent.paidFees||0).toLocaleString('en-IN')}</div><div style={{ fontSize: '0.72rem', color: 'var(--gray-500)' }}>Paid</div></div>
                <div style={{ textAlign: 'center' }}><div style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--danger)' }}>₹{(selectedStudent.pendingFees||0).toLocaleString('en-IN')}</div><div style={{ fontSize: '0.72rem', color: 'var(--gray-500)' }}>Pending</div></div>
              </div>
              <div className="progress-bar"><div className="progress-fill" style={{ width: `${Math.min(100,((selectedStudent.paidFees||0)/(selectedStudent.finalFees||selectedStudent.totalFees||1))*100)}%` }}></div></div>

              <div style={{ marginTop: '1.25rem' }}>
                <div style={{ fontWeight: 700, marginBottom: '0.75rem' }}>📄 Student Documents</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '0.75rem' }}>
                  {[{field:'studentPhoto',label:'🖼️ Student Photo'},{field:'qualificationDoc',label:'📜 Qualification Doc'},{field:'aadharCard',label:'🪪 Aadhar Card'}].map(({field,label}) => {
                    const url = getDocUrl(selectedStudent, field);
                    return (
                      <div key={field} style={{ padding: '0.75rem', background: 'var(--gray-50)', borderRadius: 'var(--radius-sm)', border: `1px solid ${url?'var(--success)':'var(--gray-200)'}`, textAlign: 'center' }}>
                        <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--gray-500)', marginBottom: '0.5rem' }}>{label}</div>
                        {url ? (isImage(url) ? <a href={url} target="_blank" rel="noopener noreferrer"><img src={url} alt={label} style={{ width: '100%', height: 80, objectFit: 'cover', borderRadius: 4 }} /></a> : <a href={url} target="_blank" rel="noopener noreferrer" style={{ fontSize: '2rem' }}>📄</a>) : <div style={{ fontSize: '0.75rem', color: 'var(--gray-400)' }}>Not uploaded</div>}
                      </div>
                    );
                  })}
                </div>
              </div>

              {selectedStudent.installments?.length > 0 && (
                <div style={{ marginTop: '1.25rem' }}>
                  <div style={{ fontWeight: 700, marginBottom: '0.75rem' }}>📅 Installments</div>
                  <div className="table-container"><table>
                    <thead><tr><th>#</th><th>Amount</th><th>Due Date</th><th>Status</th></tr></thead>
                    <tbody>{selectedStudent.installments.map((inst,i) => (
                      <tr key={i}><td>{inst.installmentNumber||i+1}</td><td>₹{(inst.amount||0).toLocaleString('en-IN')}</td><td>{inst.dueDate?new Date(inst.dueDate).toLocaleDateString('en-IN'):'-'}</td><td><span className={`badge ${inst.status==='paid'?'badge-success':inst.status==='overdue'?'badge-danger':'badge-warning'}`}>{inst.status}</span></td></tr>
                    ))}</tbody>
                  </table></div>
                </div>
              )}

              {selectedStudent.payments?.length > 0 && (
                <div style={{ marginTop: '1.25rem' }}>
                  <div style={{ fontWeight: 700, marginBottom: '0.75rem' }}>💳 Payment History</div>
                  <div className="table-container"><table>
                    <thead><tr><th>Amount</th><th>Method</th><th>Date</th><th>Remarks</th></tr></thead>
                    <tbody>{selectedStudent.payments.map((p,i) => (
                      <tr key={i}><td><span className="amount amount-paid">₹{(p.amount||0).toLocaleString('en-IN')}</span></td><td><span className="badge badge-info">{p.paymentMethod}</span></td><td>{p.date?new Date(p.date).toLocaleDateString('en-IN'):'-'}</td><td style={{ color:'var(--gray-500)' }}>{p.remarks||'-'}</td></tr>
                    ))}</tbody>
                  </table></div>
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn btn-outline" onClick={() => setShowDetailModal(false)}>Close</button>
              <button className="btn btn-warning" onClick={() => { setShowDetailModal(false); openDocUpload(selectedStudent); }}>📄 Upload Docs</button>
              {selectedStudent.pendingFees > 0 && <button className="btn btn-success" onClick={() => { setShowDetailModal(false); openPayment(selectedStudent); }}>💰 Add Payment</button>}
            </div>
          </div>
        </div>
      )}

      {/* ── DOCUMENT UPLOAD MODAL ─────────────────────────────────────────── */}
      {showDocModal && selectedStudent && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowDocModal(false)}>
          <div className="modal modal-sm">
            <div className="modal-header"><h3 className="modal-title">📄 Upload Documents</h3><button className="modal-close" onClick={() => setShowDocModal(false)}>✕</button></div>
            <form onSubmit={handleDocumentUpload}>
              <div className="modal-body">
                <div style={{ padding: '0.875rem', background: 'var(--gray-50)', borderRadius: 'var(--radius-sm)', marginBottom: '1rem' }}>
                  <div style={{ fontWeight: 600 }}>{selectedStudent.firstName} {selectedStudent.fatherName} {selectedStudent.lastName}</div>
                </div>
                {[
                  { field:'studentPhoto',    label:'🖼️ Student Photo',          hint:'JPG, PNG (image only) · Max 1 MB', accept:'image/jpeg,image/jpg,image/png', existing:getDocUrl(selectedStudent,'studentPhoto'),    cameraOk: true  },
                  { field:'qualificationDoc', label:'📜 Qualification Document', hint:'JPG, PNG, PDF · Max 1 MB',           accept:'.pdf,.jpg,.jpeg,.png',           existing:getDocUrl(selectedStudent,'qualificationDoc'), cameraOk: true  },
                  { field:'aadharCard',       label:'🪪 Aadhar Card',            hint:'JPG, PNG (image only) · Max 1 MB', accept:'image/jpeg,image/jpg,image/png', existing:getDocUrl(selectedStudent,'aadharCard'),       cameraOk: true  }
                ].map(({ field, label, hint, accept, existing, cameraOk }) => (
                  <div className="form-group" key={field} style={{ marginBottom: '1rem' }}>
                    <label className="form-label">{label}</label>
                    {existing && (
                      <div style={{ marginBottom: '0.5rem' }}>
                        {isImage(existing) ? <img src={existing} alt={label} style={{ width:60,height:60,objectFit:'cover',borderRadius:4,border:'2px solid var(--success)'}} /> : <a href={existing} target="_blank" rel="noopener noreferrer" style={{fontSize:'1.5rem'}}>📄</a>}
                        <span style={{ fontSize:'0.75rem',color:'var(--success)',marginLeft:'0.5rem' }}>✅ Already uploaded</span>
                      </div>
                    )}
                    <div style={{ display:'flex',gap:'0.5rem',marginBottom:'0.25rem',flexWrap:'wrap' }}>
                      <label style={{ flex:'1 1 48%',cursor:'pointer',padding:'0.6rem 1rem',border:'1px solid var(--gray-300)',borderRadius:'var(--radius-sm)',background:'#fff',fontSize:'0.9rem',display:'flex',alignItems:'center',justifyContent:'center',gap:'0.5rem',minHeight:'44px' }}>
                        📁 Choose File<input type="file" style={{display:'none'}} accept={accept} onChange={e => handleUploadDocChange(field, e.target.files[0])} />
                      </label>
                      {cameraOk && (
                        <button type="button"
                          onClick={() => setCameraField({ field, label, handler: handleUploadDocChange })}
                          style={{ flex:'1 1 48%',cursor:'pointer',padding:'0.6rem 1rem',border:'1px solid var(--primary)',borderRadius:'var(--radius-sm)',background:'var(--primary-light,#eff6ff)',fontSize:'0.9rem',display:'flex',alignItems:'center',justifyContent:'center',gap:'0.5rem',color:'var(--primary)',fontWeight:600,minHeight:'44px' }}>
                          📷 Camera
                        </button>
                      )}
                    </div>
                    <span className="form-hint">{hint}</span>
                    {uploadDocPreviews[field] && (
                      <div style={{ marginTop:'0.5rem' }}>
                        {uploadDocPreviews[field]==='pdf' ? <div style={{fontSize:'0.8rem',color:'#15803d',fontWeight:600}}>📄 {uploadDocModal[field]?.name}</div> : <img src={uploadDocPreviews[field]} alt={label} style={{width:60,height:60,objectFit:'cover',borderRadius:4,border:'2px solid var(--primary)'}} />}
                      </div>
                    )}
                  </div>
                ))}
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-outline" onClick={() => setShowDocModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={submitting||(!uploadDocModal.studentPhoto&&!uploadDocModal.qualificationDoc&&!uploadDocModal.aadharCard)}>{submitting?'⏳ Uploading...':'📤 Upload Documents'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── EDIT STUDENT MODAL ───────────────────────────────────────────── */}
      {showEditModal && selectedStudent && (
        <div className="modal-overlay">
          <div className="modal modal-lg">
            <div className="modal-header">
              <h3 className="modal-title">✏️ Edit Student</h3>
              <button className="modal-close" onClick={() => setShowEditModal(false)}>✕</button>
            </div>
            <form onSubmit={handleEditSubmit}>
              <div className="modal-body">
                <div className="form-grid">
                  <div style={{ gridColumn: '1 / -1' }} className="form-section-title">Personal Information</div>
                  <div className="form-group"><label className="form-label">First Name <span className="required">*</span></label><input className={`form-input ${editErrors.firstName?'error':''}`} placeholder="e.g. Rahul" value={editForm.firstName} onChange={e => setEditForm({...editForm, firstName: e.target.value})} />{editErrors.firstName && <span className="form-error">{editErrors.firstName}</span>}</div>
                  <div className="form-group"><label className="form-label">Father's Name</label><input className={`form-input ${editErrors.fatherName?'error':''}`} placeholder="e.g. Suresh" value={editForm.fatherName} onChange={e => setEditForm({...editForm, fatherName: e.target.value})} />{editErrors.fatherName && <span className="form-error">{editErrors.fatherName}</span>}</div>
                  <div className="form-group"><label className="form-label">Surname</label><input className={`form-input ${editErrors.lastName?'error':''}`} placeholder="e.g. Kumar" value={editForm.lastName} onChange={e => setEditForm({...editForm, lastName: e.target.value})} />{editErrors.lastName && <span className="form-error">{editErrors.lastName}</span>}</div>
                  <div className="form-group"><label className="form-label">Certificate Name</label><input className="form-input" placeholder="Name as it should appear on certificate (optional)" value={editForm.certificateName} onChange={e => setEditForm({...editForm, certificateName: e.target.value})} /><span className="form-hint">Leave empty to use First Name + Surname</span></div>
                  <div className="form-group"><label className="form-label">Mobile <span className="required">*</span></label><input className={`form-input ${editErrors.phoneNumber?'error':''}`} placeholder="10-digit" maxLength={10} value={editForm.phoneNumber} onChange={e => setEditForm({...editForm, phoneNumber: e.target.value.replace(/\D/g,'')})} />{editErrors.phoneNumber && <span className="form-error">{editErrors.phoneNumber}</span>}</div>
                  <div className="form-group"><label className="form-label">Email</label><input type="email" className="form-input" placeholder="Optional" value={editForm.email} onChange={e => setEditForm({...editForm, email: e.target.value})} /></div>
                  <div className="form-group"><label className="form-label">Qualification <span className="required">*</span></label><input className={`form-input ${editErrors.qualification?'error':''}`} placeholder="e.g. B.Tech CSE" value={editForm.qualification} onChange={e => setEditForm({...editForm, qualification: e.target.value.replace(/[^a-zA-Z0-9 .]/g,'')})} />{editErrors.qualification && <span className="form-error">{editErrors.qualification}</span>}</div>
                  <div className="form-group full-width"><label className="form-label">Address <span className="required">*</span></label><textarea className={`form-textarea ${editErrors.address?'error':''}`} placeholder="Full address" rows={2} value={editForm.address} onChange={e => setEditForm({...editForm, address: e.target.value})} />{editErrors.address && <span className="form-error">{editErrors.address}</span>}</div>

                  <div style={{ gridColumn: '1 / -1' }} className="form-section-title">Course & Status</div>
                  <div className="form-group"><label className="form-label">Course <span className="required">*</span></label><select className={`form-select ${editErrors.course?'error':''}`} value={editForm.course} onChange={e => handleEditCourseChange(e.target.value)}><option value="">Select Course</option>{courses.map(c => <option key={c._id} value={c._id}>{c.name}</option>)}</select>{editErrors.course && <span className="form-error">{editErrors.course}</span>}</div>
                  <div className="form-group"><label className="form-label">Duration (months)</label><input type="number" className="form-input" placeholder="e.g. 6" value={editForm.courseDuration} onChange={e => setEditForm({...editForm, courseDuration: e.target.value})} /></div>
                  <div className="form-group"><label className="form-label">Admission Date</label><input type="date" className="form-input" value={editForm.admissionDate} onChange={e => setEditForm({...editForm, admissionDate: e.target.value})} /></div>
                  <div className="form-group"><label className="form-label">Course Fees (₹) <span className="required">*</span></label><input type="number" className={`form-input ${editErrors.totalFees?'error':''}`} placeholder="Total fees" value={editForm.totalFees} onChange={e => setEditForm({...editForm, totalFees: e.target.value})} />{editErrors.totalFees && <span className="form-error">{editErrors.totalFees}</span>}</div>
                  <div className="form-group"><label className="form-label">Status</label><select className="form-select" value={editForm.status} onChange={e => setEditForm({...editForm, status: e.target.value})}><option value="active">Active</option><option value="inactive">Inactive</option></select></div>
                  
                  {selectedStudent.discount && (
                    <div className="form-group">
                      <div className="discount-badge" style={{ marginBottom: '0.5rem' }}>🏷️ Applied: {selectedStudent.discount.couponCode} ({selectedStudent.discount.percentage}% off)</div>
                    </div>
                  )}
                  <div className="form-group">
                    <label className="form-label">Discount Coupon</label>
                    <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem' }}>
                      <select className="form-select" value={editForm.couponCode} onChange={handleEditDiscountSelect} style={{ flex: 1 }}>
                        <option value="">-- Select Discount --</option>
                        {activeDiscounts.map(d => <option key={d._id} value={d.couponCode}>{d.couponCode} — {d.percentage}% off ({d.description})</option>)}
                      </select>
                    </div>
                    <div className="coupon-row">
                      <input className="form-input" placeholder="Or type coupon code" value={editForm.couponCode} onChange={e => { setEditForm({...editForm, couponCode: e.target.value.toUpperCase()}); setEditCouponInfo(null); }} />
                      <button type="button" className="btn btn-outline" onClick={validateEditCoupon} disabled={editCouponLoading || !editForm.couponCode || !editForm.totalFees}>{editCouponLoading ? '...' : 'Apply'}</button>
                    </div>
                    {editCouponInfo && <div className="discount-badge">🏷️ {editCouponInfo.percentage}% off → Final: ₹{editCouponInfo.finalFees.toLocaleString('en-IN')}</div>}
                  </div>

                  <div style={{ gridColumn: '1 / -1' }} className="form-section-title">Document Uploads</div>
                  {[
                    { field:'studentPhoto',    label:'🖼️ Student Photo',          hint:'Clear passport-size photo (JPG, PNG) · Max 1 MB',            accept:'image/jpeg,image/jpg,image/png',  existingUrl:getDocUrl(selectedStudent,'studentPhoto'),    cameraOk:true  },
                    { field:'qualificationDoc', label:'📜 Qualification Document', hint:'Mark sheet, degree or certificate (JPG, PNG, PDF) · Max 1 MB', accept:'.pdf,.jpg,.jpeg,.png',           existingUrl:getDocUrl(selectedStudent,'qualificationDoc'), cameraOk:true  },
                    { field:'aadharCard',       label:'🪪 Aadhar Card',            hint:'Front side of Aadhar card (JPG, PNG) · Max 1 MB',             accept:'image/jpeg,image/jpg,image/png',  existingUrl:getDocUrl(selectedStudent,'aadharCard'),       cameraOk:true  }
                  ].map(({ field, label, hint, accept, existingUrl, cameraOk }) => (
                    <div className="form-group" key={field}>
                      <label className="form-label">{label}</label>
                      {existingUrl && !editPreviews[field] && (
                        <div style={{ marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          {isImage(existingUrl) ? <img src={existingUrl} alt={label} style={{ width:60,height:60,objectFit:'cover',borderRadius:4,border:'2px solid var(--success)' }} /> : <a href={existingUrl} target="_blank" rel="noopener noreferrer" style={{ fontSize:'1.5rem' }}>📄</a>}
                          <span style={{ fontSize:'0.75rem', color:'var(--success)' }}>Current file</span>
                        </div>
                      )}
                      <div style={{ display:'flex',gap:'0.5rem',marginBottom:'0.25rem',flexWrap:'wrap' }}>
                        <label style={{ flex:'1 1 48%',cursor:'pointer',padding:'0.6rem 1rem',border:'1px solid var(--gray-300)',borderRadius:'var(--radius-sm)',background:'#fff',fontSize:'0.9rem',display:'flex',alignItems:'center',justifyContent:'center',gap:'0.5rem',minHeight:'44px' }}>
                          📁 Choose File<input type="file" style={{display:'none'}} accept={accept} onChange={e => handleEditDocChange(field, e.target.files[0])} />
                        </label>
                        {cameraOk && (
                          <button type="button"
                            onClick={() => setCameraField({ field, label, handler: handleEditDocChange })}
                            style={{ flex:'1 1 48%',cursor:'pointer',padding:'0.6rem 1rem',border:'1px solid var(--primary)',borderRadius:'var(--radius-sm)',background:'var(--primary-light,#eff6ff)',fontSize:'0.9rem',display:'flex',alignItems:'center',justifyContent:'center',gap:'0.5rem',color:'var(--primary)',fontWeight:600,minHeight:'44px' }}>
                            📷 Camera
                          </button>
                        )}
                      </div>
                      <span className="form-hint">{hint}</span>
                      {editPreviews[field] && (
                        <div style={{ marginTop:'0.5rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                          {editPreviews[field]==='pdf' ? <div style={{fontSize:'0.8rem',color:'#15803d',fontWeight:600}}>📄 {editDocs[field]?.name}</div> : <img src={editPreviews[field]} alt={label} style={{width:80,height:80,objectFit:'cover',borderRadius:6,border:'2px solid var(--primary)'}} />}
                          <button type="button" onClick={() => handleEditDocDelete(field)} style={{ padding: '0.4rem 0.6rem', background: '#fee2e2', border: '1px solid #fecaca', borderRadius: 6, cursor: 'pointer', fontSize: '0.75rem', color: '#dc2626', fontWeight: 600 }}>🗑️ Delete</button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-outline" onClick={() => setShowEditModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={submitting}>{submitting ? '⏳ Saving...' : '💾 Save Changes'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── LIVE CAMERA MODAL ─────────────────────────────────────────────── */}
      {cameraField && (
        <CameraModal
          label={cameraField.label}
          onCapture={file => { cameraField.handler(cameraField.field, file); setCameraField(null); }}
          onClose={() => setCameraField(null)}
        />
      )}

      {/* IMAGE CROP MODAL */}
      {cropModal && (
        <ImageCropModal
          imageSrc={cropModal.imageSrc}
          fieldName={cropModal.field}
          onCrop={file => handleCropApply(cropModal.field, file)}
          onClose={() => setCropModal(null)}
        />
      )}

      {/* IMAGE CROP MODAL FOR EDIT */}
      {editCropModal && (
        <ImageCropModal
          imageSrc={editCropModal.imageSrc}
          fieldName={editCropModal.field}
          onCrop={file => handleEditCropApply(editCropModal.field, file)}
          onClose={() => setEditCropModal(null)}
        />
      )}
    </div>
  );
}
