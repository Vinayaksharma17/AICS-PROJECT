import React, { useState, useEffect, useCallback, useRef } from 'react'
import ReactCrop, { centerCrop, makeAspectCrop } from 'react-image-crop'
import 'react-image-crop/dist/ReactCrop.css'
import api from '../../utils/api'

const BASE_URL = import.meta.env.VITE_API_URL?.replace('/api', '') || ''
// 7 days in milliseconds
const CERT_WAIT_MS = 7 * 24 * 60 * 60 * 1000
const emptyDocs = {
  studentPhoto: null,
  qualificationDoc: null,
  aadharCard: null,
}
const emptyPreviews = {
  studentPhoto: null,
  qualificationDoc: null,
  aadharCard: null,
}

/* ── Image Crop ──────────────────────────────────────────────────────────── */
function getCroppedImg(imgEl, pixelCrop) {
  const scaleX = imgEl.naturalWidth / imgEl.width
  const scaleY = imgEl.naturalHeight / imgEl.height
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(pixelCrop.width * scaleX)
  canvas.height = Math.round(pixelCrop.height * scaleY)
  const ctx = canvas.getContext('2d')
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(
    imgEl,
    pixelCrop.x * scaleX,
    pixelCrop.y * scaleY,
    pixelCrop.width * scaleX,
    pixelCrop.height * scaleY,
    0,
    0,
    canvas.width,
    canvas.height,
  )
  return new Promise((resolve) =>
    canvas.toBlob(
      (blob) =>
        resolve(
          new File([blob], `cropped_${Date.now()}.jpg`, { type: 'image/jpeg' }),
        ),
      'image/jpeg',
      0.92,
    ),
  )
}

function ImageCropModal({ imageSrc, fieldName, onCrop, onClose }) {
  const imgRef = useRef(null)
  const isPhoto = fieldName === 'studentPhoto'
  const [crop, setCrop] = useState()
  const [completedCrop, setCompletedCrop] = useState(null)

  const onImageLoad = useCallback(
    (e) => {
      const { naturalWidth: w, naturalHeight: h } = e.currentTarget
      const c = isPhoto
        ? centerCrop(
            makeAspectCrop({ unit: '%', width: 80 }, 4 / 5, w, h),
            w,
            h,
          )
        : centerCrop({ unit: '%', width: 90, height: 90 }, w, h)
      setCrop(c)
    },
    [isPhoto],
  )

  const handleApply = async () => {
    if (!completedCrop || !imgRef.current) return
    const file = await getCroppedImg(imgRef.current, completedCrop)
    onCrop(file)
  }

  return (
    <div className="modal-overlay" style={{ zIndex: 10001 }}>
      <div className="modal" style={{ maxWidth: 500, width: '95%' }}>
        <div className="modal-header">
          <h3 className="modal-title">✂️ Crop Image</h3>
          <button className="modal-close" onClick={onClose}>
            ✕
          </button>
        </div>
        <div className="modal-body" style={{ padding: '1rem' }}>
          <div
            style={{
              textAlign: 'center',
              marginBottom: '0.75rem',
              color: 'var(--gray-600)',
              fontSize: '0.85rem',
            }}
          >
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
          <button className="btn btn-outline" onClick={onClose}>
            Cancel
          </button>
          <button
            className="btn btn-primary"
            onClick={handleApply}
            disabled={!completedCrop}
          >
            ✅ Apply Crop
          </button>
        </div>
      </div>
    </div>
  )
}

/* ── Camera Modal ────────────────────────────────────────────────────────── */
function CameraModal({ label, onCapture, onClose }) {
  const videoRef = useRef(null)
  const canvasRef = useRef(null)
  const streamRef = useRef(null)
  const [ready, setReady] = useState(false)
  const [camError, setCamError] = useState('')

  useEffect(() => {
    ;(async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment' },
          audio: false,
        })
        streamRef.current = stream
        if (videoRef.current) {
          videoRef.current.srcObject = stream
          setReady(true)
        }
      } catch {
        setCamError(
          'Camera access denied or unavailable. Please allow camera permissions and try again.',
        )
      }
    })()
    return () => {
      if (streamRef.current)
        streamRef.current.getTracks().forEach((t) => t.stop())
    }
  }, [])

  const capture = () => {
    const video = videoRef.current,
      canvas = canvasRef.current
    if (!video || !canvas) return
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    canvas.getContext('2d').drawImage(video, 0, 0)
    canvas.toBlob(
      (blob) => {
        if (blob)
          onCapture(
            new File([blob], `photo_${Date.now()}.jpg`, { type: 'image/jpeg' }),
          )
      },
      'image/jpeg',
      0.92,
    )
  }

  return (
    <div
      className="modal-overlay"
      style={{ zIndex: 10000 }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className="modal modal-sm"
        style={{
          maxHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          height: '100%',
        }}
      >
        <div className="modal-header">
          <h3 className="modal-title">📷 Capture — {label}</h3>
          <button className="modal-close" onClick={onClose}>
            ✕
          </button>
        </div>
        <div
          className="modal-body"
          style={{
            textAlign: 'center',
            padding: '1rem',
            flex: 1,
            overflow: 'auto',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {camError ? (
            <div
              style={{
                padding: '1.5rem',
                color: '#dc2626',
                background: '#fef2f2',
                borderRadius: 8,
                fontSize: '0.875rem',
              }}
            >
              {camError}
            </div>
          ) : (
            <>
              <video
                ref={videoRef}
                autoPlay
                playsInline
                style={{
                  width: '100%',
                  maxHeight: 'calc(100vh - 150px)',
                  borderRadius: 8,
                  background: '#000',
                  display: ready ? 'block' : 'none',
                }}
              />
              {!ready && (
                <div style={{ padding: '2rem', color: '#6b7280' }}>
                  Starting camera…
                </div>
              )}
              <canvas ref={canvasRef} style={{ display: 'none' }} />
            </>
          )}
        </div>
        <div className="modal-footer" style={{ flexShrink: 0 }}>
          <button className="btn btn-outline" onClick={onClose}>
            Cancel
          </button>
          {ready && !camError && (
            <button className="btn btn-primary" onClick={capture}>
              📸 Capture Photo
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

const PER_PAGE = 8

export default function Certificates() {
  const [students, setStudents] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('eligible')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [alert, setAlert] = useState(null)
  const [generating, setGenerating] = useState(null)
  const [gradeMap, setGradeMap] = useState({})

  // Edit modal state
  const [showEditModal, setShowEditModal] = useState(false)
  const [editStudent, setEditStudent] = useState(null)
  const [editForm, setEditForm] = useState({})
  const [editDocs, setEditDocs] = useState(emptyDocs)
  const [editPreviews, setEditPreviews] = useState(emptyPreviews)
  const [cropState, setCropState] = useState({ src: null, field: null })
  const [cameraField, setCameraField] = useState(null)
  const [lightboxSrc, setLightboxSrc] = useState(null)
  const [photoLoadErr, setPhotoLoadErr] = useState(false)
  const [courses, setCourses] = useState([])
  const [saving, setSaving] = useState(false)

  const fetchStudents = useCallback(async () => {
    try {
      const [eligibleRes, issuedRes] = await Promise.all([
        api.get('/certificates/eligible'),
        api.get('/certificates/issued'),
      ])
      const eligible = (eligibleRes.data || []).map((s) => ({
        ...s,
        _eligibilityStatus: 'eligible',
      }))
      const issued = (issuedRes.data || []).map((s) => ({
        ...s,
        _eligibilityStatus: 'issued',
      }))
      // Merge: issued takes precedence if student appears in both
      const issuedIds = new Set(issued.map((s) => s._id))
      setStudents([...issued, ...eligible.filter((s) => !issuedIds.has(s._id))])
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchStudents()
  }, [fetchStudents])

  useEffect(() => {
    api
      .get('/courses')
      .then((r) => setCourses(r.data || []))
      .catch(() => {})
  }, [])

  const showAlert = (type, msg) => {
    setAlert({ type, message: msg })
    setTimeout(() => setAlert(null), 4000)
  }

  const openEdit = async (s) => {
    setEditDocs(emptyDocs)
    setEditPreviews(emptyPreviews)
    setPhotoLoadErr(false)
    setShowEditModal(true)

    // Fetch full student record so we always have the latest photo & documents
    try {
      const { data } = await api.get(`/students/${s._id}`)
      setEditStudent(data)
      setEditForm({
        firstName: data.firstName || '',
        fatherName: data.fatherName || '',
        lastName: data.lastName || '',
        certificateName: data.certificateName || '',
        course: data.course?._id || data.course || '',
        certificateNumber: data.certificateNumber || '',
        admissionDate: data.enrollmentDate
          ? data.enrollmentDate.split('T')[0]
          : '',
        courseEndDate: data.courseEndDate
          ? data.courseEndDate.split('T')[0]
          : '',
        certificateIssuedDate: data.certificateIssuedDate
          ? data.certificateIssuedDate.split('T')[0]
          : '',
      })
    } catch {
      // Fallback to list data if fetch fails
      setEditStudent(s)
      setEditForm({
        firstName: s.firstName || '',
        fatherName: s.fatherName || '',
        lastName: s.lastName || '',
        certificateName: s.certificateName || '',
        course: s.course?._id || s.course || '',
        certificateNumber: s.certificateNumber || '',
        admissionDate: s.enrollmentDate ? s.enrollmentDate.split('T')[0] : '',
        courseEndDate: s.courseEndDate ? s.courseEndDate.split('T')[0] : '',
        certificateIssuedDate: s.certificateIssuedDate
          ? s.certificateIssuedDate.split('T')[0]
          : '',
      })
    }
  }

  const handleDocChange = (field, file) => {
    if (!file) return
    if (file.type === 'application/pdf') {
      setEditDocs((prev) => ({ ...prev, [field]: file }))
      setEditPreviews((prev) => ({ ...prev, [field]: 'pdf' }))
    } else {
      // Open crop modal for all images
      const url = URL.createObjectURL(file)
      setCropState({ src: url, field })
    }
  }

  const handleCropDone = (croppedFile) => {
    const { field } = cropState
    if (cropState.src) URL.revokeObjectURL(cropState.src)
    setCropState({ src: null, field: null })
    const previewUrl = URL.createObjectURL(croppedFile)
    setEditDocs((prev) => ({ ...prev, [field]: croppedFile }))
    setEditPreviews((prev) => ({ ...prev, [field]: previewUrl }))
  }

  const handleCameraCapture = (field, label) => {
    setCameraField({ field, label })
  }

  const handleCameraCaptureDone = (file) => {
    const { field } = cameraField
    setCameraField(null)
    // Go straight to crop after camera capture
    const url = URL.createObjectURL(file)
    setCropState({ src: url, field })
  }

  const handleDocDelete = (field) => {
    if (editPreviews[field] && editPreviews[field] !== 'pdf')
      URL.revokeObjectURL(editPreviews[field])
    setEditDocs((prev) => ({ ...prev, [field]: null }))
    setEditPreviews((prev) => ({ ...prev, [field]: null }))
  }

  const saveEdit = async () => {
    setSaving(true)
    try {
      const formData = new FormData()
      formData.append('firstName', editForm.firstName)
      formData.append('fatherName', editForm.fatherName)
      formData.append('lastName', editForm.lastName)
      formData.append('certificateName', editForm.certificateName)
      formData.append('course', editForm.course)
      formData.append('certificateNumber', editForm.certificateNumber)
      if (editForm.admissionDate)
        formData.append('admissionDate', editForm.admissionDate)
      if (editForm.courseEndDate)
        formData.append('courseEndDate', editForm.courseEndDate)
      if (editForm.certificateIssuedDate)
        formData.append('certificateIssuedDate', editForm.certificateIssuedDate)
      if (editDocs.studentPhoto)
        formData.append('studentPhoto', editDocs.studentPhoto)
      if (editDocs.qualificationDoc)
        formData.append('qualificationDoc', editDocs.qualificationDoc)
      if (editDocs.aadharCard)
        formData.append('aadharCard', editDocs.aadharCard)

      await api.put(`/students/${editStudent._id}`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      showAlert('success', 'Student details updated successfully!')
      setShowEditModal(false)
      fetchStudents()
    } catch (err) {
      showAlert(
        'error',
        err.response?.data?.message || 'Failed to save changes',
      )
    } finally {
      setSaving(false)
    }
  }

  const checkEligibility = (s) => {
    const fullPaid = (s.pendingFees || 0) === 0
    const docsUploaded = s.profileComplete === true
    const eligible = fullPaid && docsUploaded
    return { fullPaid, docsUploaded, eligible }
  }

  // Calendar days still remaining in the 7-day waiting period after eligibility
  const getWaitDaysRemaining = (s) => {
    if (s.certificateIssued) return 0
    const since = s.certificateEligibleSince
      ? new Date(s.certificateEligibleSince)
      : new Date()
    const msLeft = CERT_WAIT_MS - (Date.now() - since.getTime())
    return Math.max(0, Math.ceil(msLeft / (24 * 60 * 60 * 1000)))
  }

  const getAvailableOn = (s) => {
    if (!s.certificateEligibleSince) return null
    return new Date(
      new Date(s.certificateEligibleSince).getTime() + CERT_WAIT_MS,
    )
  }

  const getEligibilityStatus = (s) => {
    if (s.certificateIssued) return 'issued'
    const { eligible } = checkEligibility(s)
    if (eligible || s.certificateEligible) return 'eligible'
    return 'not_eligible'
  }

  const filteredStudents = students.filter((s) => {
    const name = `${s.firstName} ${s.fatherName} ${s.lastName}`.toLowerCase()
    const matchSearch =
      !search ||
      name.includes(search.toLowerCase()) ||
      s.phoneNumber.includes(search)
    const status = getEligibilityStatus(s)
    const matchFilter =
      filter === 'all' ||
      filter === status ||
      (filter === 'eligible' && status === 'eligible') ||
      (filter === 'issued' && status === 'issued')
    return matchSearch && matchFilter
  })

  const totalPages = Math.ceil(filteredStudents.length / PER_PAGE)
  const paginated = filteredStudents.slice(
    (page - 1) * PER_PAGE,
    page * PER_PAGE,
  )

  const eligibleCount = students.filter(
    (s) => getEligibilityStatus(s) === 'eligible',
  ).length
  const issuedCount = students.filter((s) => s.certificateIssued).length

  const generateCertificate = async (student) => {
    setGenerating(student._id)
    try {
      // Save selected grade to student record first
      const grade = gradeMap[student._id] || student.grade || 'A'
      await api.put(`/students/${student._id}`, { grade })

      const response = await api.get(
        `/certificates/generate/${student._id}?grade=${encodeURIComponent(grade)}`,
        { responseType: 'blob' },
      )
      const url = window.URL.createObjectURL(
        new Blob([response.data], { type: 'application/pdf' }),
      )
      const link = document.createElement('a')
      link.href = url
      link.download = `Certificate_${student.firstName}_${student.lastName}.pdf`
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.URL.revokeObjectURL(url)
      showAlert('success', 'Certificate generated and downloaded!')
      fetchStudents()
    } catch (err) {
      showAlert(
        'error',
        err.response?.data?.message || 'Failed to generate certificate',
      )
    } finally {
      setGenerating(null)
    }
  }

  return (
    <div>
      {alert && (
        <div
          className={`alert alert-${alert.type}`}
          style={{
            position: 'fixed',
            top: '1rem',
            right: '1rem',
            zIndex: 9999,
            maxWidth: '380px',
          }}
        >
          {alert.type === 'success' ? '✅' : '❌'} {alert.message}
        </div>
      )}

      <div className="page-header">
        <div className="page-header-left">
          <h1 className="page-title">🏆 Certificates</h1>
          <p className="page-subtitle">
            {eligibleCount} eligible, {issuedCount} issued
          </p>
        </div>
      </div>

      {/* Criteria Card */}
      <div
        className="card"
        style={{
          marginBottom: '1.25rem',
          background: 'linear-gradient(135deg, #ede9fe, #dbeafe)',
          border: 'none',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: '1rem',
            flexWrap: 'wrap',
          }}
        >
          <div style={{ fontSize: '2rem' }}>🏆</div>
          <div style={{ flex: 1 }}>
            <div
              style={{
                fontWeight: 700,
                color: 'var(--gray-800)',
                marginBottom: '0.5rem',
              }}
            >
              Certificate Eligibility Criteria
            </div>
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '0.35rem',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  fontSize: '0.875rem',
                  color: 'var(--gray-700)',
                }}
              >
                <span>✅</span> <strong>Full Payment</strong> — All fees must be
                paid (₹0 pending)
              </div>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  fontSize: '0.875rem',
                  color: 'var(--gray-700)',
                }}
              >
                <span>✅</span> <strong>Course Complete</strong> — Full course
                duration must be finished
              </div>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  fontSize: '0.875rem',
                  color: 'var(--gray-700)',
                }}
              >
                <span>✅</span> <strong>7 Days After</strong> — 7 calendar days
                after eligibility is met
              </div>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  fontSize: '0.875rem',
                  color: 'var(--gray-700)',
                }}
              >
                <span>✅</span> <strong>Documents Uploaded</strong> — Student
                profile must be complete with documents
              </div>
            </div>
          </div>
        </div>
      </div>

      <div
        className="stats-grid"
        style={{
          gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
          marginBottom: '1.25rem',
        }}
      >
        <div className="stat-card">
          <div className="stat-icon blue">👨‍🎓</div>
          <div className="stat-info">
            <div className="stat-value">{students.length}</div>
            <div className="stat-label">Total Students</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon orange">🎯</div>
          <div className="stat-info">
            <div className="stat-value">{eligibleCount}</div>
            <div className="stat-label">Eligible</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon green">🏆</div>
          <div className="stat-info">
            <div className="stat-value">{issuedCount}</div>
            <div className="stat-label">Issued</div>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <div className="toolbar">
            <div className="search-box">
              <span className="search-icon">🔍</span>
              <input
                placeholder="Search student..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value)
                  setPage(1)
                }}
              />
            </div>
            <div className="filter-tabs">
              {[
                ['all', 'All'],
                ['eligible', 'Eligible 🎯'],
                ['issued', 'Issued ✅'],
                ['not_eligible', 'Not Ready'],
              ].map(([f, label]) => (
                <button
                  key={f}
                  className={`filter-tab ${filter === f ? 'active' : ''}`}
                  onClick={() => {
                    setFilter(f)
                    setPage(1)
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {loading ? (
          <div className="loading-state">
            <div className="spinner"></div>
          </div>
        ) : paginated.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">🏆</div>
            <div className="empty-title">No students found</div>
            <div className="empty-text">
              {filter === 'eligible'
                ? 'No eligible students yet'
                : 'Try changing the filter'}
            </div>
          </div>
        ) : (
          <div className="table-responsive">
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>Student</th>
                    <th>Course</th>
                    <th>Admission date</th>
                    <th>Payment</th>
                    <th>Documents</th>
                    <th>CR. No</th>
                    <th>Status</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {paginated.map((s) => {
                    const { fullPaid, docsUploaded } = checkEligibility(s)
                    const status = getEligibilityStatus(s)
                    const waitDays = getWaitDaysRemaining(s)
                    return (
                      <tr key={s._id}>
                        <td data-label="Student">
                          <div className="td-name">
                            {s.firstName} {s.fatherName} {s.lastName}
                          </div>
                          {s.certificateName && (
                            <div className="td-sub">
                              Cert. Name: {s.certificateName}
                            </div>
                          )}
                          <div className="td-sub">{s.phoneNumber}</div>
                        </td>
                        <td data-label="Course">{s.course?.name}</td>
                        <td data-label="Enrolled">
                          {s.enrollmentDate
                            ? new Date(s.enrollmentDate).toLocaleDateString(
                                'en-IN',
                              )
                            : '-'}
                        </td>
                        <td data-label="Payment">
                          <span>{fullPaid ? '✅' : '❌'}</span>
                        </td>
                        <td data-label="Documents">
                          <span>{docsUploaded ? '✅' : '❌'}</span>
                        </td>
                        <td data-label="Cert. No.">
                          {s.certificateNumber ? (
                            <span
                              style={{
                                fontFamily: 'monospace',
                                fontSize: '0.8rem',
                                fontWeight: 700,
                                color: 'var(--primary)',
                              }}
                            >
                              {s.certificateNumber}
                            </span>
                          ) : (
                            <span
                              style={{
                                color: 'var(--gray-400)',
                                fontSize: '0.75rem',
                              }}
                            >
                              —
                            </span>
                          )}
                        </td>
                        <td data-label="Status">
                          {status === 'issued' && (
                            <span className="badge badge-success">
                              🏆 Issued
                            </span>
                          )}
                          {status === 'eligible' && (
                            <span className="badge badge-warning">
                              🎯 Eligible
                            </span>
                          )}
                          {status === 'eligible' && waitDays > 0 && (
                            <span
                              className="badge"
                              style={{
                                marginLeft: '4px',
                                background: '#fef3c7',
                                color: '#92400e',
                              }}
                              title={`Available on ${getAvailableOn(s)?.toLocaleDateString('en-IN')}`}
                            >
                              🔒 {waitDays} day{waitDays > 1 ? 's' : ''} left
                            </span>
                          )}
                          {status === 'not_eligible' && (
                            <span className="badge badge-gray">
                              ⏳ Not Ready
                            </span>
                          )}
                          {s.edited && (
                            <span
                              style={{
                                display: 'inline-block',
                                marginLeft: '4px',
                                padding: '2px 6px',
                                background: '#ffedd5',
                                color: '#c2410c',
                                borderRadius: '4px',
                                fontSize: '0.7rem',
                                fontWeight: 600,
                              }}
                            >
                              ✏️ Edited
                            </span>
                          )}
                        </td>
                        <td data-label="Action">
                          <div
                            style={{
                              display: 'flex',
                              flexDirection: 'column',
                              gap: '0.3rem',
                              alignItems: 'flex-start',
                            }}
                          >
                            <button
                              className="btn btn-sm btn-warning"
                              onClick={() => openEdit(s)}
                            >
                              ✏️ Edit
                            </button>
                            {(status === 'eligible' || status === 'issued') && (
                              <>
                                <select
                                  value={gradeMap[s._id] || s.grade || 'A'}
                                  onChange={(e) =>
                                    setGradeMap((m) => ({
                                      ...m,
                                      [s._id]: e.target.value,
                                    }))
                                  }
                                  style={{
                                    fontSize: '0.78rem',
                                    padding: '2px 6px',
                                    borderRadius: 4,
                                    border: '1px solid #ccc',
                                    cursor: 'pointer',
                                  }}
                                >
                                  {['A+', 'A', 'B+', 'B', 'C'].map((g) => (
                                    <option key={g} value={g}>
                                      {g}
                                    </option>
                                  ))}
                                </select>
                                {status === 'eligible' && (
                                  <button
                                    className="btn btn-sm btn-primary"
                                    onClick={() => generateCertificate(s)}
                                    disabled={
                                      generating === s._id || waitDays > 0
                                    }
                                    title={
                                      waitDays > 0
                                        ? `Available on ${getAvailableOn(s)?.toLocaleDateString('en-IN')}`
                                        : ''
                                    }
                                  >
                                    {generating === s._id
                                      ? '⏳'
                                      : waitDays > 0
                                        ? `🔒 ${waitDays}d`
                                        : '📄 Generate'}
                                  </button>
                                )}
                                {status === 'issued' && (
                                  <button
                                    className="btn btn-sm btn-outline"
                                    onClick={() => generateCertificate(s)}
                                    disabled={generating === s._id}
                                  >
                                    {generating === s._id
                                      ? '⏳'
                                      : '🔄 Re-print'}
                                  </button>
                                )}
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {totalPages > 1 && (
          <div className="pagination">
            <span className="pagination-info">
              {(page - 1) * PER_PAGE + 1}–
              {Math.min(page * PER_PAGE, filteredStudents.length)} of{' '}
              {filteredStudents.length}
            </span>
            <div className="pagination-controls">
              <button
                className="page-btn"
                disabled={page === 1}
                onClick={() => setPage((p) => p - 1)}
              >
                ‹
              </button>
              {Array.from({ length: totalPages }, (_, i) => i + 1)
                .filter((p) => Math.abs(p - page) <= 2)
                .map((p) => (
                  <button
                    key={p}
                    className={`page-btn ${p === page ? 'active' : ''}`}
                    onClick={() => setPage(p)}
                  >
                    {p}
                  </button>
                ))}
              <button
                className="page-btn"
                disabled={page === totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                ›
              </button>
            </div>
          </div>
        )}
      </div>
      {/* ── EDIT MODAL ─────────────────────────────────────────────────────── */}
      {showEditModal && editStudent && (
        <div
          className="modal-overlay"
          onClick={(e) =>
            e.target === e.currentTarget && setShowEditModal(false)
          }
        >
          <div className="modal modal-lg">
            <div className="modal-header">
              <h3 className="modal-title">✏️ Edit Certificate Details</h3>
              <button
                className="modal-close"
                onClick={() => setShowEditModal(false)}
              >
                ✕
              </button>
            </div>
            <div className="modal-body">
              <div className="form-grid">
                <div className="form-group">
                  <label className="form-label">First Name</label>
                  <input
                    className="form-input"
                    value={editForm.firstName}
                    onChange={(e) =>
                      setEditForm({ ...editForm, firstName: e.target.value })
                    }
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Father's Name</label>
                  <input
                    className="form-input"
                    value={editForm.fatherName}
                    onChange={(e) =>
                      setEditForm({ ...editForm, fatherName: e.target.value })
                    }
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Last Name</label>
                  <input
                    className="form-input"
                    value={editForm.lastName}
                    onChange={(e) =>
                      setEditForm({ ...editForm, lastName: e.target.value })
                    }
                  />
                </div>
                <div className="form-group full-width">
                  <label className="form-label">
                    Certificate Name
                    <span
                      style={{
                        marginLeft: '6px',
                        fontSize: '0.75rem',
                        color: 'var(--gray-400)',
                        fontWeight: 400,
                      }}
                    >
                      (optional — overrides name printed on certificate)
                    </span>
                  </label>
                  <input
                    className="form-input"
                    placeholder="Leave blank to use First + Last name"
                    value={editForm.certificateName}
                    onChange={(e) =>
                      setEditForm({
                        ...editForm,
                        certificateName: e.target.value,
                      })
                    }
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Course</label>
                  <select
                    className="form-select"
                    value={editForm.course}
                    onChange={(e) =>
                      setEditForm({ ...editForm, course: e.target.value })
                    }
                  >
                    <option value="">— Select Course —</option>
                    {courses.map((c) => (
                      <option key={c._id} value={c._id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Certificate Number</label>
                  <input
                    className="form-input"
                    value={editForm.certificateNumber || '—'}
                    readOnly
                    style={{
                      backgroundColor: 'var(--gray-100, #f3f4f6)',
                      cursor: 'not-allowed',
                      color: 'var(--gray-500, #6b7280)',
                    }}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Admission Date</label>
                  <input
                    type="date"
                    className="form-input"
                    value={editForm.admissionDate}
                    onChange={(e) =>
                      setEditForm({
                        ...editForm,
                        admissionDate: e.target.value,
                      })
                    }
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Course End Date</label>
                  <input
                    type="date"
                    className="form-input"
                    value={editForm.courseEndDate}
                    onChange={(e) =>
                      setEditForm({
                        ...editForm,
                        courseEndDate: e.target.value,
                      })
                    }
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Certificate Issued Date</label>
                  <input
                    type="date"
                    className="form-input"
                    value={editForm.certificateIssuedDate}
                    onChange={(e) =>
                      setEditForm({
                        ...editForm,
                        certificateIssuedDate: e.target.value,
                      })
                    }
                  />
                </div>
              </div>

              {/* ── Documents Upload ─────────────────────────────────────── */}
              <div
                style={{
                  borderTop: '1px solid var(--gray-200)',
                  paddingTop: '1rem',
                  marginTop: '0.5rem',
                }}
              >
                <div
                  style={{
                    fontWeight: 700,
                    fontSize: '0.875rem',
                    color: 'var(--gray-700)',
                    marginBottom: '0.75rem',
                  }}
                >
                  📎 Documents
                </div>
                <div className="form-grid">
                  {[
                    {
                      field: 'studentPhoto',
                      label: '🖼️ Student Photo',
                      hint: 'JPG or PNG · Max 1 MB',
                      accept: 'image/jpeg,image/jpg,image/png',
                    },
                    {
                      field: 'qualificationDoc',
                      label: '📄 Qualification Doc',
                      hint: 'JPG, PNG or PDF · Max 1 MB',
                      accept: '.pdf,.jpg,.jpeg,.png',
                    },
                    {
                      field: 'aadharCard',
                      label: '🪪 Aadhar Card',
                      hint: 'Front side of Aadhar card (JPG, PNG) · Max 1 MB',
                      accept: 'image/jpeg,image/jpg,image/png',
                    },
                  ].map(({ field, label, hint, accept }) => {
                    const existingDoc = editStudent?.[field]
                    const existing = existingDoc?.fileUrl
                    const existingName = existingDoc?.fileName
                    const existingUrl = existing
                      ? `${BASE_URL}${existing}?token=${localStorage.getItem('token')}`
                      : null
                    return (
                      <div className="form-group" key={field}>
                        <label className="form-label">{label}</label>

                        {/* Existing student photo — click to enlarge */}
                        {field === 'studentPhoto' && existingUrl && (
                          <div
                            style={{
                              marginBottom: '0.75rem',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '0.75rem',
                            }}
                          >
                            {photoLoadErr ? (
                              <div
                                style={{
                                  width: 72,
                                  height: 72,
                                  borderRadius: 8,
                                  border: '2px dashed var(--gray-300)',
                                  background: '#f9fafb',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  fontSize: '1.8rem',
                                  flexShrink: 0,
                                }}
                              >
                                🖼️
                              </div>
                            ) : (
                              <img
                                src={existingUrl}
                                alt="Current photo"
                                onClick={() => setLightboxSrc(existingUrl)}
                                onError={() => setPhotoLoadErr(true)}
                                style={{
                                  width: 72,
                                  height: 72,
                                  objectFit: 'cover',
                                  borderRadius: 8,
                                  border: '2px solid var(--gray-300)',
                                  cursor: 'zoom-in',
                                  flexShrink: 0,
                                  display: 'block',
                                }}
                              />
                            )}
                            <div>
                              <div
                                style={{
                                  fontSize: '0.75rem',
                                  fontWeight: 700,
                                  color: 'var(--gray-600)',
                                  marginBottom: 2,
                                }}
                              >
                                Current photo
                              </div>
                              {existingName && (
                                <div
                                  style={{
                                    fontSize: '0.72rem',
                                    color: 'var(--gray-400)',
                                    marginBottom: 4,
                                  }}
                                >
                                  {existingName}
                                </div>
                              )}
                              {!photoLoadErr && (
                                <div
                                  style={{
                                    fontSize: '0.72rem',
                                    color: 'var(--primary)',
                                    cursor: 'pointer',
                                    fontWeight: 600,
                                  }}
                                  onClick={() => setLightboxSrc(existingUrl)}
                                >
                                  🔍 Click to view
                                </div>
                              )}
                            </div>
                          </div>
                        )}

                        {/* Existing doc filename for qualification doc & aadhar card */}
                        {field !== 'studentPhoto' &&
                          existingName &&
                          !editPreviews[field] && (
                            <div
                              style={{
                                marginBottom: '0.4rem',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.4rem',
                                padding: '0.35rem 0.6rem',
                                background: '#f0fdf4',
                                border: '1px solid #bbf7d0',
                                borderRadius: 6,
                              }}
                            >
                              <span style={{ fontSize: '1rem' }}>
                                {existing?.match(/\.pdf$/i) ? '📄' : '🖼️'}
                              </span>
                              <span
                                style={{
                                  fontSize: '0.75rem',
                                  color: '#15803d',
                                  fontWeight: 600,
                                  wordBreak: 'break-all',
                                }}
                              >
                                {existingName}
                              </span>
                              <span
                                style={{
                                  fontSize: '0.7rem',
                                  color: 'var(--gray-400)',
                                  marginLeft: 'auto',
                                  whiteSpace: 'nowrap',
                                }}
                              >
                                Uploaded
                              </span>
                            </div>
                          )}

                        {/* File picker + Camera buttons */}
                        <div
                          style={{
                            display: 'flex',
                            gap: '0.5rem',
                            flexWrap: 'wrap',
                          }}
                        >
                          <label
                            style={{
                              flex: '1 1 45%',
                              cursor: 'pointer',
                              padding: '0.6rem 1rem',
                              border: '1px solid var(--gray-300)',
                              borderRadius: 'var(--radius-sm)',
                              background: '#fff',
                              fontSize: '0.9rem',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              gap: '0.5rem',
                              minHeight: '44px',
                            }}
                          >
                            📁 {editDocs[field] ? 'Change' : 'Choose File'}
                            <input
                              type="file"
                              style={{ display: 'none' }}
                              accept={accept}
                              onChange={(e) =>
                                handleDocChange(field, e.target.files[0])
                              }
                            />
                          </label>
                          <button
                            type="button"
                            onClick={() => handleCameraCapture(field, label)}
                            style={{
                              flex: '1 1 45%',
                              cursor: 'pointer',
                              padding: '0.6rem 1rem',
                              border: '1px solid var(--primary)',
                              borderRadius: 'var(--radius-sm)',
                              background: 'var(--primary-light,#eff6ff)',
                              fontSize: '0.9rem',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              gap: '0.5rem',
                              color: 'var(--primary)',
                              fontWeight: 600,
                              minHeight: '44px',
                            }}
                          >
                            📷 Camera
                          </button>
                        </div>
                        <span
                          style={{
                            fontSize: '0.75rem',
                            color: 'var(--gray-400)',
                            marginTop: '0.25rem',
                            display: 'block',
                          }}
                        >
                          {hint}
                        </span>

                        {/* New file preview */}
                        {editPreviews[field] && (
                          <div
                            style={{
                              marginTop: '0.5rem',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '0.75rem',
                            }}
                          >
                            {editPreviews[field] === 'pdf' ? (
                              <div
                                style={{
                                  padding: '0.5rem',
                                  background: '#dcfce7',
                                  borderRadius: 4,
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: 6,
                                  fontSize: '0.8rem',
                                }}
                              >
                                <span>📄</span>
                                <span
                                  style={{ color: '#15803d', fontWeight: 600 }}
                                >
                                  {editDocs[field]?.name}
                                </span>
                              </div>
                            ) : (
                              <img
                                src={editPreviews[field]}
                                alt={label}
                                onClick={() =>
                                  setLightboxSrc(editPreviews[field])
                                }
                                style={{
                                  width: 80,
                                  height: 80,
                                  objectFit: 'cover',
                                  borderRadius: 6,
                                  border: '2px solid var(--primary)',
                                  cursor: 'zoom-in',
                                }}
                              />
                            )}
                            <button
                              type="button"
                              onClick={() => handleDocDelete(field)}
                              style={{
                                padding: '0.4rem 0.6rem',
                                background: '#fee2e2',
                                border: '1px solid #fecaca',
                                borderRadius: 6,
                                cursor: 'pointer',
                                fontSize: '0.75rem',
                                color: '#dc2626',
                                fontWeight: 600,
                              }}
                            >
                              🗑️ Remove
                            </button>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button
                className="btn btn-outline"
                onClick={() => setShowEditModal(false)}
              >
                Cancel
              </button>
              <button
                className="btn btn-primary"
                onClick={saveEdit}
                disabled={saving}
              >
                {saving ? '⏳ Saving...' : '💾 Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Lightbox ─────────────────────────────────────────────────────────── */}
      {lightboxSrc && (
        <div
          onClick={() => setLightboxSrc(null)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.85)',
            zIndex: 10002,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'zoom-out',
          }}
        >
          <img
            src={lightboxSrc}
            alt="Preview"
            style={{
              maxWidth: '90vw',
              maxHeight: '90vh',
              borderRadius: 8,
              boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
            }}
          />
          <button
            onClick={() => setLightboxSrc(null)}
            style={{
              position: 'absolute',
              top: 16,
              right: 20,
              background: 'rgba(255,255,255,0.15)',
              border: 'none',
              color: '#fff',
              fontSize: '1.5rem',
              cursor: 'pointer',
              borderRadius: '50%',
              width: 40,
              height: 40,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            ✕
          </button>
        </div>
      )}

      {/* ── Crop Modal ───────────────────────────────────────────────────────── */}
      {cropState.src && (
        <ImageCropModal
          imageSrc={cropState.src}
          fieldName={cropState.field}
          onCrop={handleCropDone}
          onClose={() => {
            URL.revokeObjectURL(cropState.src)
            setCropState({ src: null, field: null })
          }}
        />
      )}

      {/* ── Camera Modal ─────────────────────────────────────────────────────── */}
      {cameraField && (
        <CameraModal
          label={cameraField.label}
          onCapture={handleCameraCaptureDone}
          onClose={() => setCameraField(null)}
        />
      )}
    </div>
  )
}
