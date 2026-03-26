import React, { useEffect, useState } from 'react';
import api from '../../utils/api';
import { useAuth } from '../../context/AuthContext';

export default function AdminDashboard() {
  const [stats, setStats] = useState(null);
  const [recentStudents, setRecentStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [dashRes, studentsRes] = await Promise.all([
          api.get('/admin/dashboard'),
          api.get('/students?limit=5').catch(() => ({ data: [] }))
        ]);

        const dash = dashRes.data;
        setStats({
          totalStudents:  dash.enrolled         || 0,
          activeStaff:    dash.staff            || 0,
          totalCourses:   dash.courses          || 0,
          totalCollected: dash.fees?.collected  || 0,
          totalPending:   dash.fees?.pending    || 0,
          certEligible:   dash.certEligible     || 0,
          newEnquiries:   dash.newEnquiries     || 0
        });

        const students = Array.isArray(studentsRes.data) ? studentsRes.data : [];
        setRecentStudents(students.slice(0, 5));
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const fmt = (n) => {
    if (!n) return '₹0';
    const num = Number(n);
    if (num >= 10000000) { // 1 crore
      return `₹${(num / 10000000).toFixed(2)}Cr`;
    } else if (num >= 100000) { // 1 lakh
      return `₹${(num / 100000).toFixed(2)}L`;
    }
    return `₹${num.toLocaleString('en-IN')}`;
  };

  if (loading) return (
    <div className="loading-state">
      <div className="spinner"></div>
      <span>Loading dashboard...</span>
    </div>
  );

  return (
    <div>
      <div className="page-header">
        <div className="page-header-left">
          <h1 className="page-title">Welcome back, {user?.name?.split(' ')[0]}! 👋</h1>
          <p className="page-subtitle">Here's what's happening at your institute today.</p>
        </div>
      </div>

      {/* Stats */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon blue">👨‍🎓</div>
          <div className="stat-info">
            <div className="stat-value">{stats?.totalStudents}</div>
            <div className="stat-label">Total Students</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon green">👥</div>
          <div className="stat-info">
            <div className="stat-value">{stats?.activeStaff}</div>
            <div className="stat-label">Active Staff</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon purple">📚</div>
          <div className="stat-info">
            <div className="stat-value">{stats?.totalCourses}</div>
            <div className="stat-label">Courses</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon orange">📋</div>
          <div className="stat-info">
            <div className="stat-value">{stats?.newEnquiries}</div>
            <div className="stat-label">New Enquiries</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon green">💰</div>
          <div className="stat-info">
            <div className="stat-value" style={{ fontSize: '1.1rem' }}>{fmt(stats?.totalCollected)}</div>
            <div className="stat-label">Total Collected</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon red">⏳</div>
          <div className="stat-info">
            <div className="stat-value" style={{ fontSize: '1.1rem' }}>{fmt(stats?.totalPending)}</div>
            <div className="stat-label">Pending Fees</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon cyan">🏆</div>
          <div className="stat-info">
            <div className="stat-value">{stats?.certEligible}</div>
            <div className="stat-label">Certificate Eligible</div>
          </div>
        </div>
      </div>

      {/* Recent Students */}
      <div className="card">
        <div className="card-header">
          <h2 className="card-title">📋 Recent Students</h2>
        </div>
        {recentStudents.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">👨‍🎓</div>
            <div className="empty-title">No students yet</div>
            <div className="empty-text">Add your first student to get started</div>
          </div>
        ) : (
          <div className="table-responsive">
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>Student</th>
                    <th>Course</th>
                    <th>Fees</th>
                    <th>Paid</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {recentStudents.map(s => (
                    <tr key={s._id}>
                      <td data-label="Student">
                        <div className="td-name">{s.firstName} {s.fatherName} {s.lastName}</div>
                        <div className="td-sub">{s.phoneNumber}</div>
                      </td>
                      <td data-label="Course">{s.course?.name}</td>
                      <td data-label="Fees">₹{(s.finalFees || s.totalFees || 0).toLocaleString('en-IN')}</td>
                      <td data-label="Paid"><span className="amount amount-paid">₹{(s.paidFees || 0).toLocaleString('en-IN')}</span></td>
                      <td data-label="Status">
                        <span className={`badge ${s.status === 'active' ? 'badge-success' : 'badge-gray'}`}>
                          {s.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
