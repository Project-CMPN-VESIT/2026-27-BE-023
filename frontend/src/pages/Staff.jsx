import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { 
  Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, 
  BarElement, Title, Tooltip, Legend, ArcElement
} from 'chart.js';
import { Doughnut, Bar } from 'react-chartjs-2';
import { 
  UsersThree, Plus, Trash, Key, PencilSimple, ShieldCheck, UserCheck, 
  CurrencyDollar, Clock, WarningCircle, CheckCircle, FileText, 
  CalendarBlank, DownloadSimple, Info, ChartBar
} from '@phosphor-icons/react';

// Register ChartJS
ChartJS.register(
  CategoryScale, LinearScale, PointElement, LineElement, 
  BarElement, Title, Tooltip, Legend, ArcElement
);

const API_BASE = 'http://localhost:5000/api';

const Staff = ({ user: currentUser }) => {
  // Navigation & Core State
  const [activeTab, setActiveTab] = useState('analytics');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Primary Data State
  const [employees, setEmployees] = useState([]);
  const [attendance, setAttendance] = useState([]);
  const [workLogs, setWorkLogs] = useState([]);
  const [salaryRecords, setSalaryRecords] = useState([]);
  const [payments, setPayments] = useState([]);
  const [analytics, setAnalytics] = useState({
    totalStaff: 0,
    totalPaid: 0,
    totalPending: 0,
    attendanceRate: 100,
    monthlyPayroll: []
  });
  
  // Legacy User Accounts State
  const [users, setUsers] = useState([]);

  // --- Filter States ---
  // Work Logs Filters
  const [filterEmployeeId, setFilterEmployeeId] = useState('all');
  const [filterAttStatus, setFilterAttStatus] = useState('all');
  const [filterLogDate, setFilterLogDate] = useState('');
  
  // Calendar View States
  const [calendarView, setCalendarView] = useState(false);
  const [calendarMonth, setCalendarMonth] = useState(new Date().getMonth());
  const [calendarYear, setCalendarYear] = useState(new Date().getFullYear());

  // Payroll Ledger Filters
  const [filterPayEmployeeId, setFilterPayEmployeeId] = useState('all');
  const [filterPayStatus, setFilterPayStatus] = useState('all');
  const [filterPayMonth, setFilterPayMonth] = useState('all');

  // --- Modal Form States ---
  // Employee profile form
  const [isEmployeeModalOpen, setEmployeeModalOpen] = useState(false);
  const [employeeModalType, setEmployeeModalType] = useState('add'); // 'add' or 'edit'
  const [selectedEmployeeId, setSelectedEmployeeId] = useState(null);
  const [employeeForm, setEmployeeForm] = useState({
    full_name: '',
    role: '',
    phone: '',
    email: '',
    joining_date: '',
    monthly_salary: '',
    status: 'Active'
  });

  // Daily Work & Attendance Log Form
  const [isLogModalOpen, setLogModalOpen] = useState(false);
  const [logForm, setLogForm] = useState({
    employee_id: '',
    date: new Date().toISOString().split('T')[0],
    status: 'Present',
    working_hours: '8',
    tasks_completed: '',
    notes: ''
  });

  // Generate Salary Record Form
  const [isSalaryRecordModalOpen, setSalaryRecordModalOpen] = useState(false);
  const [salaryRecordForm, setSalaryRecordForm] = useState({
    employee_id: '',
    month: new Date().toISOString().slice(0, 7), // YYYY-MM
    base_salary: '',
    bonus: '0',
    deductions: '0'
  });

  const [isEditSalaryModalOpen, setEditSalaryModalOpen] = useState(false);
  const [editSalaryForm, setEditSalaryForm] = useState({
    id: '',
    employee_name: '',
    month: '',
    base_salary: '',
    bonus: '0',
    deductions: '0'
  });

  // Record Disbursed Payment Form
  const [isPaymentModalOpen, setPaymentModalOpen] = useState(false);
  const [selectedSalaryRecord, setSelectedSalaryRecord] = useState(null);
  const [paymentForm, setPaymentForm] = useState({
    amount_paid: '',
    payment_date: new Date().toISOString().split('T')[0],
    payment_method: 'Bank Transfer',
    notes: ''
  });

  // Legacy RBAC / User Credentials Modal Forms
  const [isAddModalOpen, setAddModalOpen] = useState(false);
  const [isEditModalOpen, setEditModalOpen] = useState(false);
  const [isPasswordModalOpen, setPasswordModalOpen] = useState(false);
  const [addForm, setAddForm] = useState({ username: '', password: '', role: 'staff' });
  const [selectedUser, setSelectedUser] = useState(null);
  const [editForm, setEditForm] = useState({ role: 'staff' });
  const [passwordForm, setPasswordForm] = useState({ password: '', confirmPassword: '' });

  // JWT Headers
  const getHeaders = () => {
    const token = localStorage.getItem('inventai_token');
    return {
      headers: { Authorization: `Bearer ${token}` }
    };
  };

  // --- API Integrations ---
  const fetchAllData = async () => {
    setLoading(true);
    setErrorMsg('');
    try {
      const headers = getHeaders();
      const [empRes, attRes, logRes, salRes, payRes, anaRes] = await Promise.all([
        axios.get(`${API_BASE}/employees`, headers),
        axios.get(`${API_BASE}/staff/attendance`, headers),
        axios.get(`${API_BASE}/staff/work-logs`, headers),
        axios.get(`${API_BASE}/staff/salary-records`, headers),
        axios.get(`${API_BASE}/staff/payments`, headers),
        axios.get(`${API_BASE}/staff/analytics`, headers)
      ]);

      setEmployees(empRes.data);
      setAttendance(attRes.data);
      setWorkLogs(logRes.data);
      setSalaryRecords(salRes.data);
      setPayments(payRes.data);
      setAnalytics(anaRes.data);

      // Fetch legacy users if current user is admin
      if (currentUser?.role === 'admin') {
        const usersRes = await axios.get(`${API_BASE}/users`, headers);
        setUsers(usersRes.data);
      }
    } catch (err) {
      console.error(err);
      setErrorMsg(err.response?.data?.message || 'Failed to synchronize staff module databases.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAllData();

    const handleBrandChange = () => {
      console.log('🔄 Brand switched, reloading staff & payroll databases...');
      fetchAllData();
    };

    window.addEventListener('inventai_brand_changed', handleBrandChange);
    return () => {
      window.removeEventListener('inventai_brand_changed', handleBrandChange);
    };
  }, [currentUser]);

  // Toast auto-clear
  useEffect(() => {
    if (successMsg) {
      const timer = setTimeout(() => setSuccessMsg(''), 4000);
      return () => clearTimeout(timer);
    }
  }, [successMsg]);

  // --- Actions & Submission Handlers ---

  // 1. Employee Profile CRUD
  const handleEmployeeSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const headers = getHeaders();
      const payload = {
        ...employeeForm,
        monthly_salary: Number(employeeForm.monthly_salary) || 0
      };

      if (employeeModalType === 'add') {
        await axios.post(`${API_BASE}/employees`, payload, headers);
        setSuccessMsg(`Successfully created employee profile for "${employeeForm.full_name}".`);
      } else {
        await axios.put(`${API_BASE}/employees/${selectedEmployeeId}`, payload, headers);
        setSuccessMsg(`Successfully updated employee profile for "${employeeForm.full_name}".`);
      }

      setEmployeeModalOpen(false);
      fetchAllData();
    } catch (err) {
      const errMsg = err.response?.data?.message || '';
      if (errMsg.includes('unique constraint') && errMsg.includes('email')) {
        alert('Operation failed: An employee with this email address is already registered.');
      } else {
        alert(errMsg || 'Operation failed. Please verify your connection and inputs.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleEditEmployeeClick = (emp) => {
    setEmployeeModalType('edit');
    setSelectedEmployeeId(emp.id);
    setEmployeeForm({
      full_name: emp.full_name,
      role: emp.role,
      phone: emp.phone,
      email: emp.email,
      joining_date: emp.joining_date ? emp.joining_date.split('T')[0] : '',
      monthly_salary: emp.monthly_salary,
      status: emp.status
    });
    setEmployeeModalOpen(true);
  };

  const handleDeleteEmployee = async (empId, name) => {
    if (!window.confirm(`Are you absolutely sure you want to permanently delete the profile of "${name}"? This deletes all associated payroll records.`)) return;
    setLoading(true);
    try {
      await axios.delete(`${API_BASE}/employees/${empId}`, getHeaders());
      setSuccessMsg(`Successfully removed "${name}" from directory.`);
      fetchAllData();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to delete employee profile.');
    } finally {
      setLoading(false);
    }
  };

  // 2. Daily Log Attendance & Task Completion
  const handleLogSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const headers = getHeaders();
      
      // Submit attendance record
      await axios.post(`${API_BASE}/staff/attendance`, {
        employee_id: logForm.employee_id,
        date: logForm.date,
        status: logForm.status,
        working_hours: Number(logForm.working_hours) || 0,
        notes: logForm.notes
      }, headers);

      // Submit work task log if present
      if (logForm.tasks_completed.trim()) {
        await axios.post(`${API_BASE}/staff/work-logs`, {
          employee_id: logForm.employee_id,
          date: logForm.date,
          tasks_completed: logForm.tasks_completed,
          notes: logForm.notes
        }, headers);
      }

      setSuccessMsg(`Successfully logged daily record for the employee.`);
      setLogModalOpen(false);
      setLogForm({
        employee_id: '',
        date: new Date().toISOString().split('T')[0],
        status: 'Present',
        working_hours: '8',
        tasks_completed: '',
        notes: ''
      });
      fetchAllData();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to submit work log.');
    } finally {
      setLoading(false);
    }
  };

  // 3. Salary Payroll Record Generation
  const handleSalaryRecordSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await axios.post(`${API_BASE}/staff/salary-records`, {
        employee_id: salaryRecordForm.employee_id,
        month: salaryRecordForm.month,
        base_salary: Number(salaryRecordForm.base_salary) || 0,
        bonus: Number(salaryRecordForm.bonus) || 0,
        deductions: Number(salaryRecordForm.deductions) || 0
      }, getHeaders());

      setSuccessMsg(`Successfully created salary ledger record.`);
      setSalaryRecordModalOpen(false);
      fetchAllData();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to generate payroll record.');
    } finally {
      setLoading(false);
    }
  };

  const handleEditSalarySubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await axios.put(`${API_BASE}/staff/salary-records/${editSalaryForm.id}`, {
        base_salary: Number(editSalaryForm.base_salary) || 0,
        bonus: Number(editSalaryForm.bonus) || 0,
        deductions: Number(editSalaryForm.deductions) || 0
      }, getHeaders());

      setSuccessMsg(`Successfully updated salary ledger record.`);
      setEditSalaryModalOpen(false);
      fetchAllData();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to update payroll record.');
    } finally {
      setLoading(false);
    }
  };

  const handleSalaryRecordAutoFill = (empId) => {
    const emp = employees.find(e => e.id === empId);
    if (emp) {
      setSalaryRecordForm(prev => ({
        ...prev,
        employee_id: empId,
        base_salary: emp.monthly_salary
      }));
    }
  };

  // 4. Payment Disbursement Handler
  const handlePaymentSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await axios.post(`${API_BASE}/staff/payments`, {
        employee_id: selectedSalaryRecord.employee_id,
        salary_record_id: selectedSalaryRecord.id,
        amount_paid: Number(paymentForm.amount_paid) || 0,
        payment_date: paymentForm.payment_date,
        payment_method: paymentForm.payment_method,
        notes: paymentForm.notes
      }, getHeaders());

      setSuccessMsg(`Successfully logged pay dispatch of ₹${paymentForm.amount_paid}.`);
      setPaymentModalOpen(false);
      setPaymentForm({
        amount_paid: '',
        payment_date: new Date().toISOString().split('T')[0],
        payment_method: 'Bank Transfer',
        notes: ''
      });
      fetchAllData();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to dispatch payment.');
    } finally {
      setLoading(false);
    }
  };

  const openPaymentModal = (record) => {
    setSelectedSalaryRecord(record);
    setPaymentForm(prev => ({
      ...prev,
      amount_paid: record.pending_dues
    }));
    setPaymentModalOpen(true);
  };

  // 5. Legacy Access Control (RBAC) Actions
  const handleCreateUser = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await axios.post(`${API_BASE}/users`, addForm, getHeaders());
      setAddModalOpen(false);
      setAddForm({ username: '', password: '', role: 'staff' });
      setSuccessMsg(`Registered credentials for ${addForm.username} successfully.`);
      fetchAllData();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to create user account.');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateRole = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await axios.put(`${API_BASE}/users/${selectedUser.id}`, { role: editForm.role }, getHeaders());
      setEditModalOpen(false);
      setSelectedUser(null);
      setSuccessMsg(`Role updated to ${editForm.role} successfully.`);
      fetchAllData();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to update credentials role.');
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    if (passwordForm.password !== passwordForm.confirmPassword) {
      alert('Passwords do not match.');
      return;
    }
    setLoading(true);
    try {
      await axios.put(`${API_BASE}/users/${selectedUser.id}`, { password: passwordForm.password }, getHeaders());
      setPasswordModalOpen(false);
      setSelectedUser(null);
      setPasswordForm({ password: '', confirmPassword: '' });
      setSuccessMsg(`Password successfully updated.`);
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to reset password.');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteUser = async (userToDelete) => {
    if (userToDelete.username === currentUser.username) {
      alert('You cannot delete your own admin account.');
      return;
    }
    if (!window.confirm(`Are you absolutely sure you want to delete user account "${userToDelete.username}"?`)) {
      return;
    }
    setLoading(true);
    try {
      await axios.delete(`${API_BASE}/users/${userToDelete.id}`, getHeaders());
      setSuccessMsg(`Access credentials for ${userToDelete.username} deleted.`);
      fetchAllData();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to delete user account.');
    } finally {
      setLoading(false);
    }
  };

  // --- Filtering Operations ---

  const formatDateSafe = (dateStr) => {
    if (!dateStr) return 'N/A';
    const parts = dateStr.split('T')[0].split('-');
    if (parts.length < 3) return dateStr;
    const [year, month, day] = parts;
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${monthNames[parseInt(month, 10) - 1]} ${parseInt(day, 10)}, ${year}`;
  };

  // Work Logs Filtered Results (Combined with Attendance)
  const filteredLogs = attendance.map(att => {
    const log = workLogs.find(wl => wl.employee_id === att.employee_id && wl.date?.split('T')[0] === att.date?.split('T')[0]);
    return {
      id: att.id,
      employee_id: att.employee_id,
      date: att.date,
      status: att.status,
      working_hours: att.working_hours,
      notes: att.notes || '',
      tasks_completed: log ? log.tasks_completed : 'N/A'
    };
  }).filter(item => {
    const matchesEmployee = filterEmployeeId === 'all' || item.employee_id === filterEmployeeId;
    const matchesStatus = filterAttStatus === 'all' || item.status === filterAttStatus;
    const matchesDate = !filterLogDate || item.date?.split('T')[0] === filterLogDate;
    return matchesEmployee && matchesStatus && matchesDate;
  });

  // --- Calendar View Helpers ---
  const monthsList = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];
  const yearsList = [2025, 2026, 2027];

  const getDaysInMonth = (year, month) => {
    const firstDay = new Date(year, month, 1);
    const days = [];
    const startDay = firstDay.getDay(); // 0 is Sunday, 6 is Saturday
    
    // Empty cells before the first of the month
    for (let i = 0; i < startDay; i++) {
      days.push(null);
    }
    
    // Actual days of the month
    const numDays = new Date(year, month + 1, 0).getDate();
    for (let i = 1; i <= numDays; i++) {
      days.push(new Date(year, month, i));
    }
    
    return days;
  };

  const getCalendarStats = () => {
    if (filterEmployeeId === 'all') {
      return { present: 0, absent: 0, halfDay: 0, leave: 0, total: 0, rate: 100 };
    }
    
    const monthlyAtt = attendance.filter(a => {
      if (a.employee_id !== filterEmployeeId || !a.date) return false;
      const parts = a.date.split('T')[0].split('-');
      if (parts.length < 2) return false;
      const y = parseInt(parts[0], 10);
      const m = parseInt(parts[1], 10) - 1;
      return y === calendarYear && m === calendarMonth;
    });
    
    let present = 0;
    let absent = 0;
    let halfDay = 0;
    let leave = 0;
    
    monthlyAtt.forEach(a => {
      if (a.status === 'Present') present++;
      else if (a.status === 'Absent') absent++;
      else if (a.status === 'Half Day') halfDay++;
      else if (a.status === 'Leave') leave++;
    });
    
    const total = monthlyAtt.length;
    const rate = total > 0 ? Math.round(((present + halfDay * 0.5) / total) * 100) : 100;
    
    return { present, absent, halfDay, leave, total, rate };
  };

  // Payroll Filtered Results
  const filteredPayroll = salaryRecords.filter(rec => {
    const matchesEmployee = filterPayEmployeeId === 'all' || rec.employee_id === filterPayEmployeeId;
    const matchesStatus = filterPayStatus === 'all' || rec.status === filterPayStatus;
    const matchesMonth = filterPayMonth === 'all' || rec.month === filterPayMonth;
    return matchesEmployee && matchesStatus && matchesMonth;
  });

  // List unique months in records for filters
  const uniqueMonths = Array.from(new Set(salaryRecords.map(r => r.month))).sort();

  // --- Export Implementations ---

  const exportLogsCSV = () => {
    const csvRows = [
      ['Date', 'Employee Name', 'Attendance Status', 'Working Hours', 'Tasks Completed', 'Supervisor Notes'].join(',')
    ];
    filteredLogs.forEach(log => {
      const emp = employees.find(e => e.id === log.employee_id);
      const att = attendance.find(a => a.employee_id === log.employee_id && a.date?.split('T')[0] === log.date?.split('T')[0]);
      csvRows.push([
        log.date ? log.date.split('T')[0] : '',
        emp ? `"${emp.full_name}"` : 'Unknown',
        att ? att.status : 'N/A',
        att ? att.working_hours : 0,
        `"${(log.tasks_completed || '').replace(/"/g, '""')}"`,
        `"${(log.notes || '').replace(/"/g, '""')}"`
      ].join(','));
    });

    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `Daily_Work_Logs_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const exportPayrollCSV = () => {
    const csvRows = [
      ['Month', 'Employee Name', 'Base Salary (₹)', 'Bonus (₹)', 'Deductions (₹)', 'Absent Days', 'Absent Deduction (₹)', 'Net Salary (₹)', 'Amount Paid (₹)', 'Pending Dues (₹)', 'Payroll Status'].join(',')
    ];
    filteredPayroll.forEach(rec => {
      const emp = employees.find(e => e.id === rec.employee_id);
      csvRows.push([
        rec.month,
        emp ? `"${emp.full_name}"` : 'Unknown',
        rec.base_salary,
        rec.bonus,
        rec.deductions,
        rec.absent_days || 0,
        rec.absent_deduction || 0,
        rec.net_salary,
        rec.paid_amount,
        rec.pending_dues,
        rec.status
      ].join(','));
    });

    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `Payroll_Report_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const triggerPDFPrint = () => {
    window.print();
  };

  // --- Chart Setup & Aggregation ---

  // Aggregate stats dynamically in frontend as redundant safe fallbacks
  const computedStats = React.useMemo(() => {
    const totalStaffCount = employees.length;
    const totalWagesPaid = salaryRecords.reduce((sum, s) => sum + Number(s.paid_amount), 0);
    const totalDues = salaryRecords.reduce((sum, s) => sum + Number(s.pending_dues), 0);
    
    const presents = attendance.filter(a => a.status === 'Present' || a.status === 'Half Day').length;
    const absents = attendance.length;
    const presentRatio = absents > 0 ? Math.round((presents / absents) * 100) : 100;

    return {
      totalStaffCount,
      totalWagesPaid,
      totalDues,
      presentRatio
    };
  }, [employees, salaryRecords, attendance]);

  // Bar Chart Configuration: Monthly Wages & Dues
  const payrollMonths = analytics.monthlyPayroll?.map(item => item.month).reverse() || [];
  const payrollPaidData = analytics.monthlyPayroll?.map(item => item.paid_amount).reverse() || [];
  const payrollDuesData = analytics.monthlyPayroll?.map(item => item.pending_dues).reverse() || [];

  const trendChartData = {
    labels: payrollMonths,
    datasets: [
      {
        label: 'Salary Dispatched (₹)',
        data: payrollPaidData,
        backgroundColor: 'rgba(16, 185, 129, 0.85)',
        borderColor: '#10B981',
        borderWidth: 1.5,
        borderRadius: 8,
        barThickness: 24,
      },
      {
        label: 'Pending Balance Dues (₹)',
        data: payrollDuesData,
        backgroundColor: 'rgba(239, 68, 68, 0.85)',
        borderColor: '#EF4444',
        borderWidth: 1.5,
        borderRadius: 8,
        barThickness: 24,
      }
    ]
  };

  const trendChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top',
        labels: {
          color: 'var(--text-main)',
          font: { family: 'Plus Jakarta Sans', weight: '600', size: 12 }
        }
      },
      tooltip: {
        backgroundColor: 'var(--bg-surface)',
        titleColor: 'var(--text-main)',
        bodyColor: 'var(--text-muted)',
        borderColor: 'var(--border)',
        borderWidth: 1,
        padding: 12,
        cornerRadius: 8,
        displayColors: true
      }
    },
    scales: {
      x: {
        ticks: { color: 'var(--text-muted)', font: { family: 'Plus Jakarta Sans' } },
        grid: { color: 'var(--border-light)', drawBorder: false }
      },
      y: {
        ticks: { 
          color: 'var(--text-muted)', 
          font: { family: 'Plus Jakarta Sans' },
          callback: (value) => '₹' + value.toLocaleString()
        },
        grid: { color: 'var(--border-light)', drawBorder: false }
      }
    }
  };

  // Doughnut Chart Configuration: Employee Roles Distribution
  const roleDistribution = React.useMemo(() => {
    const rolesMap = {};
    employees.forEach(e => {
      const r = e.role || 'Unspecified';
      rolesMap[r] = (rolesMap[r] || 0) + 1;
    });
    return {
      labels: Object.keys(rolesMap),
      datasets: [{
        data: Object.values(rolesMap),
        backgroundColor: [
          'rgba(99, 102, 241, 0.85)', // Indigo
          'rgba(236, 72, 153, 0.85)', // Pink
          'rgba(59, 130, 246, 0.85)', // Blue
          'rgba(16, 185, 129, 0.85)', // Green
          'rgba(245, 158, 11, 0.85)'  // Amber
        ],
        borderWidth: 0,
        hoverOffset: 4
      }]
    };
  }, [employees]);

  const roleChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'bottom',
        labels: {
          color: 'var(--text-main)',
          boxWidth: 12,
          padding: 16,
          font: { family: 'Plus Jakarta Sans', weight: '600' }
        }
      }
    },
    cutout: '70%'
  };

  // Find latest absent alert flags
  const absentAlerts = React.useMemo(() => {
    const today = new Date().toISOString().split('T')[0];
    return attendance.filter(a => a.status === 'Absent' && a.date?.split('T')[0] === today).map(a => {
      const emp = employees.find(e => e.id === a.employee_id);
      return emp ? emp.full_name : 'An employee';
    });
  }, [attendance, employees]);

  return (
    <div className="view-section active">
      {/* Dynamic Printing Media Utility Styles */}
      <style dangerouslySetInnerHTML={{__html: `
        @media print {
          *, *::before, *::after {
            box-sizing: border-box !important;
          }
          @page { size: auto; margin: 8mm 6mm !important; }
          body, html { width: 100% !important; height: auto !important; overflow: visible !important; margin: 0 !important; padding: 0 !important; background: white !important; color: black !important; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
          .app-container, .main-content, .dashboard-scroll-area, .view-section {
            display: block !important;
            width: 100% !important;
            max-width: 100% !important;
            height: auto !important;
            min-height: 0 !important;
            overflow: visible !important;
            margin: 0 !important;
            padding: 0 !important;
            position: static !important;
            transform: none !important;
            box-shadow: none !important;
            background: none !important;
          }
          .sidebar, .top-navbar, .no-print, .close-modal, .form-actions, .toast-container, .toast, .ai-chatbot-toggle, .ai-chatbot-panel, .modal, .modal-content, button, .btn, .tab-btn-row, iframe, .no-print * {
            display: none !important;
            visibility: hidden !important;
            opacity: 0 !important;
            height: 0 !important;
            width: 0 !important;
            margin: 0 !important;
            padding: 0 !important;
            border: none !important;
            position: absolute !important;
            top: -9999px !important;
            left: -9999px !important;
          }
          .card, .glass-card { border: none !important; box-shadow: none !important; background: transparent !important; padding: 0 !important; margin: 0 0 20px 0 !important; backdrop-filter: none !important; -webkit-backdrop-filter: none !important; }
          .table-container { overflow: visible !important; width: 100% !important; max-width: 100% !important; padding: 0 !important; margin: 0 !important; }
          .data-table { width: 100% !important; border: 1px solid #ddd !important; border-collapse: collapse !important; table-layout: fixed !important; margin-top: 10px !important; }
          .data-table th { background-color: #f5f5f5 !important; color: black !important; border: 1px solid #ddd !important; font-weight: 700 !important; text-transform: uppercase !important; }
          .data-table td { border: 1px solid #ddd !important; }
          .data-table th, .data-table td { 
            font-size: 6.5pt !important; 
            padding: 4px 2px !important; 
            text-align: left !important;
            word-wrap: break-word !important;
            white-space: normal !important;
            color: black !important;
          }
          /* Custom print widths to ensure all columns fit perfectly */
          .data-table th:nth-child(1), .data-table td:nth-child(1) { width: 9% !important; } /* Month */
          .data-table th:nth-child(2), .data-table td:nth-child(2) { width: 13% !important; } /* Employee Name */
          .data-table th:nth-child(3), .data-table td:nth-child(3) { width: 9% !important; } /* Base Salary */
          .data-table th:nth-child(4), .data-table td:nth-child(4) { width: 8% !important; }  /* Bonus */
          .data-table th:nth-child(5), .data-table td:nth-child(5) { width: 9% !important; } /* Deductions */
          .data-table th:nth-child(6), .data-table td:nth-child(6) { width: 11% !important; } /* Absent Cut */
          .data-table th:nth-child(7), .data-table td:nth-child(7) { width: 11% !important; } /* Net Salary */
          .data-table th:nth-child(8), .data-table td:nth-child(8) { width: 10% !important; } /* Amount Paid */
          .data-table th:nth-child(9), .data-table td:nth-child(9) { width: 10% !important; } /* Outstanding Dues */
          .data-table th:nth-child(10), .data-table td:nth-child(10) { width: 10% !important; } /* Status */
          .print-full-width { width: 100% !important; flex: 100% !important; max-width: 100% !important; }
        }
      `}} />

      {/* Floating Success Toast Alert */}
      {successMsg && (
        <div className="toast success" style={{ position: 'fixed', top: '24px', right: '24px', zIndex: 1000 }}>
          <CheckCircle size={20} color="var(--success)" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Main Glassmorphic Header */}
      <div className="dashboard-header no-print">
        <div>
          <h2 className="page-title text-gradient">Staff & Payroll Hub</h2>
          <p className="page-subtitle">Manage workforce registry profiles, review daily activity timelines, and disburse monthly B2B payroll dues.</p>
        </div>
        <div style={{ display: 'flex', gap: '12px' }}>
          {activeTab === 'employees' && (
            <button className="btn btn-primary" onClick={() => { setEmployeeModalType('add'); setEmployeeForm({ full_name: '', role: '', phone: '', email: '', joining_date: new Date().toISOString().split('T')[0], monthly_salary: '', status: 'Active' }); setEmployeeModalOpen(true); }}>
              <Plus style={{ marginRight: '8px' }} /> Register Staff Profile
            </button>
          )}
          {activeTab === 'logs' && (
            <button className="btn btn-primary" onClick={() => {
              setLogForm({
                employee_id: '',
                date: new Date().toISOString().split('T')[0],
                status: 'Present',
                working_hours: '8',
                tasks_completed: '',
                notes: ''
              });
              setLogModalOpen(true);
            }}>
              <Clock style={{ marginRight: '8px' }} /> Log Daily Activity
            </button>
          )}
          {activeTab === 'payroll' && (
            <button className="btn btn-primary" onClick={() => setSalaryRecordModalOpen(true)}>
              <CurrencyDollar style={{ marginRight: '8px' }} /> Record Month Salary
            </button>
          )}
        </div>
      </div>

      {errorMsg && (
        <div className="card no-print" style={{ padding: '20px', borderLeft: '4px solid var(--danger)', marginBottom: '24px', backgroundColor: 'var(--danger-light)', color: 'var(--danger-text)' }}>
          <p style={{ margin: 0, fontWeight: 'bold' }}>⚠️ Operational Error: {errorMsg}</p>
        </div>
      )}

      {/* Interactive Tabs Row */}
      <div className="tab-btn-row no-print" style={{ display: 'flex', gap: '8px', borderBottom: '1px solid var(--border)', marginBottom: '32px', paddingBottom: '8px' }}>
        <button className={`tab-btn btn ${activeTab === 'analytics' ? 'btn-primary' : 'btn-outline'}`} style={{ border: 'none', background: activeTab === 'analytics' ? 'var(--primary-gradient)' : 'transparent', color: activeTab === 'analytics' ? 'white' : 'var(--text-muted)' }} onClick={() => setActiveTab('analytics')}>
          <ChartBar size={18} style={{ marginRight: '6px' }} /> Dashboard & Charts
        </button>
        <button className={`tab-btn btn ${activeTab === 'employees' ? 'btn-primary' : 'btn-outline'}`} style={{ border: 'none', background: activeTab === 'employees' ? 'var(--primary-gradient)' : 'transparent', color: activeTab === 'employees' ? 'white' : 'var(--text-muted)' }} onClick={() => setActiveTab('employees')}>
          <UsersThree size={18} style={{ marginRight: '6px' }} /> Employee Registry
        </button>
        <button className={`tab-btn btn ${activeTab === 'logs' ? 'btn-primary' : 'btn-outline'}`} style={{ border: 'none', background: activeTab === 'logs' ? 'var(--primary-gradient)' : 'transparent', color: activeTab === 'logs' ? 'white' : 'var(--text-muted)' }} onClick={() => setActiveTab('logs')}>
          <Clock size={18} style={{ marginRight: '6px' }} /> Daily Work Logs
        </button>
        <button className={`tab-btn btn ${activeTab === 'payroll' ? 'btn-primary' : 'btn-outline'}`} style={{ border: 'none', background: activeTab === 'payroll' ? 'var(--primary-gradient)' : 'transparent', color: activeTab === 'payroll' ? 'white' : 'var(--text-muted)' }} onClick={() => setActiveTab('payroll')}>
          <CurrencyDollar size={18} style={{ marginRight: '6px' }} /> Payroll & Ledgers
        </button>
        {currentUser?.role === 'admin' && (
          <button className={`tab-btn btn ${activeTab === 'access' ? 'btn-primary' : 'btn-outline'}`} style={{ border: 'none', background: activeTab === 'access' ? 'var(--primary-gradient)' : 'transparent', color: activeTab === 'access' ? 'white' : 'var(--text-muted)' }} onClick={() => setActiveTab('access')}>
            <Key size={18} style={{ marginRight: '6px' }} /> Database Credentials
          </button>
        )}
      </div>

      {/* =============================================================== */}
      {/* TAB 1: ANALYTICS & DASHBOARD */}
      {/* =============================================================== */}
      {activeTab === 'analytics' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '30px' }} className="print-full-width">
          {/* KPI Widget Cards */}
          <div className="kpi-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '24px' }}>
            <div className="card glass-card" style={{ padding: '24px', position: 'relative' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                <span style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--text-muted)' }}>Total Employees</span>
                <div style={{ padding: '8px', borderRadius: '8px', background: 'var(--purple-light)', color: 'var(--purple-text)', display: 'flex' }}>
                  <UsersThree size={20} />
                </div>
              </div>
              <div className="kpi-value">{computedStats.totalStaffCount}</div>
              <div className="kpi-trend neutral" style={{ fontSize: '0.8rem', color: 'var(--text-light)' }}>
                Registered directory records
              </div>
            </div>

            <div className="card glass-card" style={{ padding: '24px', position: 'relative' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                <span style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--text-muted)' }}>Salary Dispatched</span>
                <div style={{ padding: '8px', borderRadius: '8px', background: 'var(--success-light)', color: 'var(--success-text)', display: 'flex' }}>
                  <CurrencyDollar size={20} />
                </div>
              </div>
              <div className="kpi-value">₹{computedStats.totalWagesPaid.toLocaleString()}</div>
              <div className="kpi-trend positive" style={{ fontSize: '0.8rem', color: 'var(--success)' }}>
                Paid in full current fiscal
              </div>
            </div>

            <div className="card glass-card" style={{ padding: '24px', position: 'relative' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                <span style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--text-muted)' }}>Pending Salary Dues</span>
                <div style={{ padding: '8px', borderRadius: '8px', background: computedStats.totalDues > 0 ? 'var(--danger-light)' : 'var(--success-light)', color: computedStats.totalDues > 0 ? 'var(--danger-text)' : 'var(--success-text)', display: 'flex' }}>
                  <WarningCircle size={20} />
                </div>
              </div>
              <div className="kpi-value" style={{ color: computedStats.totalDues > 0 ? 'var(--danger)' : 'var(--text-main)' }}>₹{computedStats.totalDues.toLocaleString()}</div>
              <div className="kpi-trend" style={{ fontSize: '0.8rem', color: computedStats.totalDues > 0 ? 'var(--danger)' : 'var(--success)', fontWeight: 600 }}>
                {computedStats.totalDues > 0 ? '⚠️ Outstanding balance' : '✅ Ledger fully cleared'}
              </div>
            </div>

            <div className="card glass-card" style={{ padding: '24px', position: 'relative' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                <span style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--text-muted)' }}>Attendance Rate</span>
                <div style={{ padding: '8px', borderRadius: '8px', background: 'var(--blue-light)', color: 'var(--blue-text)', display: 'flex' }}>
                  <CheckCircle size={20} />
                </div>
              </div>
              <div className="kpi-value">{computedStats.presentRatio}%</div>
              <div className="kpi-trend positive" style={{ fontSize: '0.8rem', color: 'var(--blue-brand)' }}>
                Average active turnout
              </div>
            </div>
          </div>

          {/* Alarm Notifications */}
          {computedStats.totalDues > 0 && (
            <div className="card no-print" style={{ padding: '20px', borderLeft: '4px solid var(--danger)', backgroundColor: 'var(--danger-light)', color: 'var(--danger-text)', display: 'flex', alignItems: 'center', gap: '14px' }}>
              <WarningCircle size={28} />
              <div>
                <strong style={{ display: 'block' }}>Outstanding B2B Salary Liability</strong>
                <span>The system currently tracks <strong>₹{computedStats.totalDues.toLocaleString()}</strong> in pending salaries. Please log payments under the Payroll Ledger tab to settle accounts.</span>
              </div>
            </div>
          )}

          {absentAlerts.length > 0 && (
            <div className="card no-print" style={{ padding: '20px', borderLeft: '4px solid var(--warning)', backgroundColor: 'var(--warning-light)', color: 'var(--warning-text)', display: 'flex', alignItems: 'center', gap: '14px' }}>
              <Info size={28} />
              <div>
                <strong style={{ display: 'block' }}>Daily Attendance Absence Alert</strong>
                <span>Today's registered absent staff includes: <strong>{absentAlerts.join(', ')}</strong>. Verify work schedule alignments.</span>
              </div>
            </div>
          )}

          {/* Charts Section */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '30px' }} className="print-full-width">
            {/* Monthly Trend */}
            <div className="card glass-card" style={{ padding: '28px', height: '380px', display: 'flex', flexDirection: 'column' }}>
              <h3 className="card-title" style={{ marginBottom: '20px' }}><ChartBar /> B2B Monthly Payroll Trends</h3>
              <div style={{ flex: 1, position: 'relative' }}>
                {payrollMonths.length > 0 ? (
                  <Bar data={trendChartData} options={trendChartOptions} />
                ) : (
                  <div style={{ height: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center', color: 'var(--text-muted)' }}>
                    No recorded salaries found. Please create payroll records in Tab 4.
                  </div>
                )}
              </div>
            </div>

            {/* Department/Roles Doughnut */}
            <div className="card glass-card" style={{ padding: '28px', height: '380px', display: 'flex', flexDirection: 'column' }}>
              <h3 className="card-title" style={{ marginBottom: '20px' }}><UsersThree /> Staff Position Distributions</h3>
              <div style={{ flex: 1, position: 'relative' }}>
                {employees.length > 0 ? (
                  <Doughnut data={roleDistribution} options={roleChartOptions} />
                ) : (
                  <div style={{ height: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center', color: 'var(--text-muted)' }}>
                    No employees registered. Add staff members in Tab 2.
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =============================================================== */}
      {/* TAB 2: EMPLOYEE REGISTRY */}
      {/* =============================================================== */}
      {activeTab === 'employees' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {employees.length === 0 ? (
            <div className="card" style={{ padding: '48px', textAlignment: 'center', color: 'var(--text-muted)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
              <UsersThree size={48} style={{ color: 'var(--text-light)' }} />
              <h3>The Employee Registry is Empty</h3>
              <p>Register new profiles to track work attendance, log tasks, and record monthly wages.</p>
              <button className="btn btn-primary" onClick={() => { setEmployeeModalType('add'); setEmployeeForm({ full_name: '', role: '', phone: '', email: '', joining_date: new Date().toISOString().split('T')[0], monthly_salary: '', status: 'Active' }); setEmployeeModalOpen(true); }}>
                Register First Profile
              </button>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '24px' }}>
              {employees.map(emp => (
                <div key={emp.id} className="card glass-card" style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden', transition: 'var(--transition)' }}>
                  {/* Top Color Banner */}
                  <div style={{ height: '4px', background: emp.status === 'Active' ? 'var(--primary-gradient)' : '#64748B' }}></div>
                  <div style={{ padding: '24px', flex: 1, display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div>
                        <h3 style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--text-main)' }}>{emp.full_name}</h3>
                        <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 600 }}>{emp.role || 'General Staff'}</span>
                      </div>
                      <span className={`status-badge ${emp.status === 'Active' ? 'status-normal' : 'status-low'}`} style={{ backgroundColor: emp.status === 'Active' ? 'var(--success-light)' : 'var(--border-light)', color: emp.status === 'Active' ? 'var(--success-text)' : 'var(--text-muted)' }}>
                        {emp.status}
                      </span>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '0.9rem', color: 'var(--text-muted)', borderTop: '1px solid var(--border-light)', paddingTop: '14px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span>Email:</span>
                        <a href={`mailto:${emp.email}`} style={{ color: 'var(--primary)', fontWeight: 500, textDecoration: 'none' }}>{emp.email || 'N/A'}</a>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span>Phone:</span>
                        <a href={`tel:${emp.phone}`} style={{ color: 'var(--text-main)', fontWeight: 500, textDecoration: 'none' }}>{emp.phone || 'N/A'}</a>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span>Joined Date:</span>
                        <span style={{ color: 'var(--text-main)', fontWeight: 500 }}>{formatDateSafe(emp.joining_date)}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span>Base Salary:</span>
                        <strong style={{ color: 'var(--success-text)', fontWeight: 700 }}>₹{(emp.monthly_salary || 0).toLocaleString()}/mo</strong>
                      </div>
                    </div>
                  </div>

                  {/* Actions Section */}
                  <div style={{ display: 'flex', borderTop: '1px solid var(--border-light)', background: 'var(--bg-app)', padding: '12px 24px', gap: '10px' }} className="no-print">
                    <button className="btn btn-outline" style={{ flex: 1, padding: '8px', fontSize: '0.8rem' }} onClick={() => handleEditEmployeeClick(emp)}>
                      <PencilSimple size={14} style={{ marginRight: '6px' }} /> Edit
                    </button>
                    <button className="btn btn-outline" style={{ padding: '8px', color: 'var(--danger)', borderColor: 'rgba(239, 68, 68, 0.2)' }} onClick={() => handleDeleteEmployee(emp.id, emp.full_name)}>
                      <Trash size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* =============================================================== */}
      {/* TAB 3: DAILY WORK LOGS */}
      {/* =============================================================== */}
      {activeTab === 'logs' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {/* View Mode Toggle Row */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
            <div className="tab-btn-row no-print" style={{ display: 'flex', gap: '8px', background: 'var(--bg-surface)', padding: '4px', borderRadius: '8px', border: '1px solid var(--border)' }}>
              <button 
                type="button" 
                className={`btn btn-outline`} 
                style={{ 
                  border: 'none', 
                  borderRadius: '6px',
                  padding: '6px 16px',
                  fontSize: '0.88rem',
                  background: !calendarView ? 'var(--primary-gradient)' : 'transparent', 
                  color: !calendarView ? 'white' : 'var(--text-muted)',
                  fontWeight: 600,
                  boxShadow: !calendarView ? '0 2px 6px rgba(99, 102, 241, 0.2)' : 'none'
                }} 
                onClick={() => setCalendarView(false)}
              >
                📋 Timeline List View
              </button>
              <button 
                type="button" 
                className={`btn btn-outline`} 
                style={{ 
                  border: 'none', 
                  borderRadius: '6px',
                  padding: '6px 16px',
                  fontSize: '0.88rem',
                  background: calendarView ? 'var(--primary-gradient)' : 'transparent', 
                  color: calendarView ? 'white' : 'var(--text-muted)',
                  fontWeight: 600,
                  boxShadow: calendarView ? '0 2px 6px rgba(99, 102, 241, 0.2)' : 'none'
                }} 
                onClick={() => setCalendarView(true)}
              >
                📅 Monthly Calendar View
              </button>
            </div>
            
            {calendarView && filterEmployeeId !== 'all' && (
              <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }} className="no-print">
                <select 
                  className="form-input" 
                  style={{ padding: '6px 12px', minWidth: '130px', height: '38px' }} 
                  value={calendarMonth} 
                  onChange={e => setCalendarMonth(parseInt(e.target.value, 10))}
                >
                  {monthsList.map((m, idx) => (
                    <option key={m} value={idx}>{m}</option>
                  ))}
                </select>
                <select 
                  className="form-input" 
                  style={{ padding: '6px 12px', minWidth: '90px', height: '38px' }} 
                  value={calendarYear} 
                  onChange={e => setCalendarYear(parseInt(e.target.value, 10))}
                >
                  {yearsList.map(y => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {!calendarView ? (
            <>
              {/* Filters Row */}
              <div className="card glass-card no-print" style={{ padding: '20px', display: 'flex', flexWrap: 'wrap', gap: '16px', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', flex: 1 }}>
                  <div style={{ minWidth: '180px' }}>
                    <label className="form-label" style={{ marginBottom: '6px' }}>Filter Employee</label>
                    <select className="form-input" style={{ padding: '8px 12px' }} value={filterEmployeeId} onChange={e => setFilterEmployeeId(e.target.value)}>
                      <option value="all">All Employees</option>
                      {employees.map(e => (
                        <option key={e.id} value={e.id}>{e.full_name}</option>
                      ))}
                    </select>
                  </div>

                  <div style={{ minWidth: '160px' }}>
                    <label className="form-label" style={{ marginBottom: '6px' }}>Attendance Status</label>
                    <select className="form-input" style={{ padding: '8px 12px' }} value={filterAttStatus} onChange={e => setFilterAttStatus(e.target.value)}>
                      <option value="all">All Statuses</option>
                      <option value="Present">Present</option>
                      <option value="Absent">Absent</option>
                      <option value="Half Day">Half Day</option>
                      <option value="Leave">On Leave</option>
                    </select>
                  </div>

                  <div style={{ minWidth: '160px' }}>
                    <label className="form-label" style={{ marginBottom: '6px' }}>Specific Date</label>
                    <input type="date" className="form-input" style={{ padding: '8px 12px' }} value={filterLogDate} onChange={e => setFilterLogDate(e.target.value)} />
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '10px', marginTop: '22px' }}>
                  <button className="btn btn-outline" style={{ display: 'inline-flex', gap: '6px' }} onClick={exportLogsCSV}>
                    <DownloadSimple size={16} /> Export CSV
                  </button>
                  <button className="btn btn-outline" style={{ display: 'inline-flex', gap: '6px' }} onClick={triggerPDFPrint}>
                    <FileText size={16} /> Print Report
                  </button>
                </div>
              </div>

              {/* Data Table */}
              <div className="card glass-card">
                <div className="card-header no-print">
                  <h3 className="card-title"><Clock /> Attendance & Work Logs Checklist</h3>
                </div>
                <div className="table-container">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th>Employee Name</th>
                        <th>Attendance Status</th>
                        <th>Hours Logged</th>
                        <th>Completed Task Summary</th>
                        <th>Supervisor Feedback Notes</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredLogs.length === 0 ? (
                        <tr>
                          <td colSpan="6" className="text-center text-muted" style={{ padding: '32px' }}>
                            No attendance activity logs matched selected filters.
                          </td>
                        </tr>
                      ) : (
                        filteredLogs.map(log => {
                          const emp = employees.find(e => e.id === log.employee_id);
                          const att = attendance.find(a => a.employee_id === log.employee_id && a.date?.split('T')[0] === log.date?.split('T')[0]);
                          return (
                            <tr key={log.id}>
                              <td style={{ fontWeight: 600 }}>{formatDateSafe(log.date)}</td>
                              <td style={{ fontWeight: 700 }}>{emp ? emp.full_name : 'Unknown Employee'}</td>
                              <td>
                                <span className={`status-badge ${
                                  att?.status === 'Present' ? 'status-normal' : 
                                  att?.status === 'Absent' ? 'status-high' : 'status-low'
                                }`}>
                                  {att ? att.status : 'Present'}
                                </span>
                              </td>
                              <td>{att ? `${att.working_hours} hours` : '8 hours'}</td>
                              <td style={{ maxWidth: '300px', whiteSpace: 'normal', fontSize: '0.88rem' }}>{log.tasks_completed}</td>
                              <td style={{ fontStyle: 'italic', color: 'var(--text-muted)', fontSize: '0.85rem' }}>{log.notes || 'None'}</td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          ) : (
            // Monthly Calendar View Layout
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              {/* Employee Filter Quick Selector inside Calendar View */}
              <div className="card glass-card no-print" style={{ padding: '20px', display: 'flex', flexWrap: 'wrap', gap: '16px', alignItems: 'center' }}>
                <div style={{ minWidth: '220px' }}>
                  <label className="form-label" style={{ marginBottom: '6px' }}>Select Employee for Calendar</label>
                  <select className="form-input" style={{ padding: '8px 12px' }} value={filterEmployeeId} onChange={e => setFilterEmployeeId(e.target.value)}>
                    <option value="all">-- Select Employee --</option>
                    {employees.map(e => (
                      <option key={e.id} value={e.id}>{e.full_name}</option>
                    ))}
                  </select>
                </div>
                <div style={{ color: 'var(--text-muted)', fontSize: '0.88rem', marginTop: '22px' }}>
                  Choose a staff member to view their interactive monthly attendance layout.
                </div>
              </div>

              {filterEmployeeId === 'all' ? (
                // All-Employees Fallback Info Card
                <div className="card glass-card" style={{ padding: '48px', textAlign: 'center', color: 'var(--text-muted)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
                  <CalendarBlank size={48} style={{ color: 'var(--primary)' }} />
                  <h3 style={{ color: 'var(--text-main)' }}>Select an Employee to View Calendar</h3>
                  <p style={{ maxWidth: '480px', margin: '0 auto', fontSize: '0.92rem', lineHeight: '1.6' }}>
                    To display the interactive monthly attendance turnout grid, custom status maps, and metrics summaries, please select a specific employee from the dropdown above.
                  </p>
                </div>
              ) : (
                // Specific Employee Interactive Calendar Card
                <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                  {/* Calendar Grid Container */}
                  <div className="card glass-card" style={{ padding: '24px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', borderBottom: '1px solid var(--border-light)', paddingBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <CalendarBlank size={24} style={{ color: 'var(--primary)' }} />
                        <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-main)' }}>
                          {monthsList[calendarMonth]} {calendarYear} Turnout Board
                        </h3>
                      </div>
                      
                      {/* Status Legends */}
                      <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', fontSize: '0.82rem' }}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: 'var(--text-muted)' }}>
                          <span style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: '#10B981', boxShadow: '0 0 6px rgba(16, 185, 129, 0.4)' }}></span> Present
                        </span>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: 'var(--text-muted)' }}>
                          <span style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: '#EF4444', boxShadow: '0 0 6px rgba(239, 68, 68, 0.4)' }}></span> Absent
                        </span>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: 'var(--text-muted)' }}>
                          <span style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: '#F59E0B', boxShadow: '0 0 6px rgba(245, 158, 11, 0.4)' }}></span> Half Day
                        </span>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: 'var(--text-muted)' }}>
                          <span style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: '#8B5CF6', boxShadow: '0 0 6px rgba(139, 92, 246, 0.4)' }}></span> Leave
                        </span>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: 'var(--text-muted)' }}>
                          <span style={{ width: '10px', height: '10px', borderRadius: '50%', border: '1px dashed var(--text-muted)', backgroundColor: 'transparent' }}></span> Unlogged
                        </span>
                      </div>
                    </div>

                    {/* 7 Column Calendar Grid Layout */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '12px' }}>
                      {/* Sun to Sat headers */}
                      {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
                        <div key={d} style={{ fontWeight: 700, color: 'var(--text-muted)', fontSize: '0.88rem', padding: '6px', textAlign: 'center' }}>
                          {d}
                        </div>
                      ))}

                      {/* Map active month days */}
                      {getDaysInMonth(calendarYear, calendarMonth).map((day, idx) => {
                        if (!day) {
                          return <div key={`empty-${idx}`} style={{ aspectRatio: '1.3', background: 'transparent' }}></div>;
                        }

                        const dateStr = `${calendarYear}-${String(calendarMonth + 1).padStart(2, '0')}-${String(day.getDate()).padStart(2, '0')}`;
                        const att = attendance.find(a => a.employee_id === filterEmployeeId && a.date?.split('T')[0] === dateStr);
                        const workLog = workLogs.find(w => w.employee_id === filterEmployeeId && w.date?.split('T')[0] === dateStr);
                        
                        let cellStyle = {
                          aspectRatio: '1.3',
                          borderRadius: '10px',
                          padding: '10px',
                          display: 'flex',
                          flexDirection: 'column',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          cursor: 'pointer',
                          border: '1px solid var(--border-light)',
                          background: 'rgba(255, 255, 255, 0.01)',
                          position: 'relative'
                        };

                        let dotStyle = {
                          width: '6px',
                          height: '6px',
                          borderRadius: '50%',
                          marginTop: '4px'
                        };

                        let statusLabel = 'Unlogged';

                        if (att) {
                          if (att.status === 'Present') {
                            cellStyle.background = 'rgba(16, 185, 129, 0.06)';
                            cellStyle.borderColor = 'rgba(16, 185, 129, 0.25)';
                            dotStyle.backgroundColor = '#10B981';
                            dotStyle.boxShadow = '0 0 6px #10B981';
                            statusLabel = 'Present';
                          } else if (att.status === 'Absent') {
                            cellStyle.background = 'rgba(239, 68, 68, 0.06)';
                            cellStyle.borderColor = 'rgba(239, 68, 68, 0.25)';
                            dotStyle.backgroundColor = '#EF4444';
                            dotStyle.boxShadow = '0 0 6px #EF4444';
                            statusLabel = 'Absent';
                          } else if (att.status === 'Half Day') {
                            cellStyle.background = 'rgba(245, 158, 11, 0.06)';
                            cellStyle.borderColor = 'rgba(245, 158, 11, 0.25)';
                            dotStyle.backgroundColor = '#F59E0B';
                            dotStyle.boxShadow = '0 0 6px #F59E0B';
                            statusLabel = 'Half Day';
                          } else if (att.status === 'Leave') {
                            cellStyle.background = 'rgba(139, 92, 246, 0.06)';
                            cellStyle.borderColor = 'rgba(139, 92, 246, 0.25)';
                            dotStyle.backgroundColor = '#8B5CF6';
                            dotStyle.boxShadow = '0 0 6px #8B5CF6';
                            statusLabel = 'On Leave';
                          }
                        } else {
                          cellStyle.borderStyle = 'dashed';
                          cellStyle.borderColor = 'var(--border)';
                        }

                        const onCellAction = () => {
                          if (!att) {
                            // Pre-fill form and open modal
                            setLogForm({
                              employee_id: filterEmployeeId,
                              date: dateStr,
                              status: 'Present',
                              working_hours: '8',
                              tasks_completed: '',
                              notes: ''
                            });
                            setLogModalOpen(true);
                          } else {
                            // Display quick alerts
                            const details = [];
                            details.push(`• Turnout: ${att.status}`);
                            details.push(`• Worked: ${att.working_hours} hours`);
                            if (workLog) details.push(`• Completed: ${workLog.tasks_completed}`);
                            if (att.notes) details.push(`• Notes: ${att.notes}`);
                            alert(`Attendance Summary [${formatDateSafe(dateStr)}]:\n\n${details.join('\n')}`);
                          }
                        };

                        return (
                          <div 
                            key={dateStr} 
                            className="calendar-cell-hover"
                            style={cellStyle}
                            onClick={onCellAction}
                            title={att ? `Turnout: ${statusLabel} (Click to view)` : 'Unlogged Day (Click to add log)'}
                          >
                            <span style={{ fontWeight: 700, fontSize: '1rem', color: att ? 'var(--text-main)' : 'var(--text-muted)' }}>
                              {day.getDate()}
                            </span>
                            
                            {att ? (
                              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}>
                                <span style={dotStyle}></span>
                                {workLog && (
                                  <span style={{ fontSize: '0.62rem', color: 'var(--primary)', fontWeight: 700, letterSpacing: '0.3px', marginTop: '2px' }}>
                                    📝 LOGGED
                                  </span>
                                )}
                              </div>
                            ) : (
                              <span style={{ fontSize: '0.65rem', color: 'var(--text-light)', border: '1px solid var(--border-light)', borderRadius: '4px', padding: '2px 6px', background: 'rgba(255,255,255,0.02)', fontWeight: 600 }}>
                                + LOG
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Attendance Analytics & KPIs Row */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '20px' }}>
                    {/* Turnout Progress Card */}
                    <div className="card glass-card" style={{ padding: '20px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                      <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '4px' }}>Turnout Success Rate</span>
                      <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
                        <strong style={{ fontSize: '1.8rem', color: getCalendarStats().rate >= 80 ? 'var(--success)' : 'var(--warning)', fontWeight: 800 }}>
                          {getCalendarStats().rate}%
                        </strong>
                        <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>of {getCalendarStats().total} logged days</span>
                      </div>
                      <div style={{ width: '100%', height: '8px', background: 'var(--border-light)', borderRadius: '4px', marginTop: '12px', overflow: 'hidden' }}>
                        <div style={{ width: `${getCalendarStats().rate}%`, height: '100%', background: getCalendarStats().rate >= 80 ? 'var(--success)' : 'var(--warning-gradient)', borderRadius: '4px' }}></div>
                      </div>
                    </div>

                    {/* Present Card */}
                    <div className="card glass-card" style={{ padding: '20px', display: 'flex', alignItems: 'center', gap: '16px' }}>
                      <div style={{ padding: '10px', borderRadius: '10px', backgroundColor: 'rgba(16, 185, 129, 0.1)', color: '#10B981', display: 'flex' }}>
                        <CheckCircle size={24} />
                      </div>
                      <div>
                        <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)', display: 'block' }}>Present turnouts</span>
                        <strong style={{ fontSize: '1.35rem', color: 'var(--text-main)', fontWeight: 700 }}>{getCalendarStats().present} days</strong>
                      </div>
                    </div>

                    {/* Absent Card */}
                    <div className="card glass-card" style={{ padding: '20px', display: 'flex', alignItems: 'center', gap: '16px' }}>
                      <div style={{ padding: '10px', borderRadius: '10px', backgroundColor: 'rgba(239, 68, 68, 0.1)', color: '#EF4444', display: 'flex' }}>
                        <WarningCircle size={24} />
                      </div>
                      <div>
                        <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)', display: 'block' }}>Unexcused Absences</span>
                        <strong style={{ fontSize: '1.35rem', color: 'var(--text-main)', fontWeight: 700 }}>{getCalendarStats().absent} days</strong>
                      </div>
                    </div>

                    {/* Half Day Card */}
                    <div className="card glass-card" style={{ padding: '20px', display: 'flex', alignItems: 'center', gap: '16px' }}>
                      <div style={{ padding: '10px', borderRadius: '10px', backgroundColor: 'rgba(245, 158, 11, 0.1)', color: '#F59E0B', display: 'flex' }}>
                        <Clock size={24} />
                      </div>
                      <div>
                        <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)', display: 'block' }}>Half shifts logged</span>
                        <strong style={{ fontSize: '1.35rem', color: 'var(--text-main)', fontWeight: 700 }}>{getCalendarStats().halfDay} days</strong>
                      </div>
                    </div>

                    {/* Leave Card */}
                    <div className="card glass-card" style={{ padding: '20px', display: 'flex', alignItems: 'center', gap: '16px' }}>
                      <div style={{ padding: '10px', borderRadius: '10px', backgroundColor: 'rgba(139, 92, 246, 0.1)', color: '#8B5CF6', display: 'flex' }}>
                        <CalendarBlank size={24} />
                      </div>
                      <div>
                        <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)', display: 'block' }}>Approved Leaves</span>
                        <strong style={{ fontSize: '1.35rem', color: 'var(--text-main)', fontWeight: 700 }}>{getCalendarStats().leave} days</strong>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* =============================================================== */}
      {/* TAB 4: PAYROLL & SALARY LEDGER */}
      {/* =============================================================== */}
      {activeTab === 'payroll' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {/* Filters Row */}
          <div className="card glass-card no-print" style={{ padding: '20px', display: 'flex', flexWrap: 'wrap', gap: '16px', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', flex: 1 }}>
              <div style={{ minWidth: '180px' }}>
                <label className="form-label" style={{ marginBottom: '6px' }}>Filter Employee</label>
                <select className="form-input" style={{ padding: '8px 12px' }} value={filterPayEmployeeId} onChange={e => setFilterPayEmployeeId(e.target.value)}>
                  <option value="all">All Employees</option>
                  {employees.map(e => (
                    <option key={e.id} value={e.id}>{e.full_name}</option>
                  ))}
                </select>
              </div>

              <div style={{ minWidth: '160px' }}>
                <label className="form-label" style={{ marginBottom: '6px' }}>Payment Status</label>
                <select className="form-input" style={{ padding: '8px 12px' }} value={filterPayStatus} onChange={e => setFilterPayStatus(e.target.value)}>
                  <option value="all">All Statuses</option>
                  <option value="Paid">Paid</option>
                  <option value="Partial">Partial</option>
                  <option value="Unpaid">Unpaid</option>
                </select>
              </div>

              <div style={{ minWidth: '140px' }}>
                <label className="form-label" style={{ marginBottom: '6px' }}>Salary Month</label>
                <select className="form-input" style={{ padding: '8px 12px' }} value={filterPayMonth} onChange={e => setFilterPayMonth(e.target.value)}>
                  <option value="all">All Months</option>
                  {uniqueMonths.map(m => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '10px', marginTop: '22px' }}>
              <button className="btn btn-outline" style={{ display: 'inline-flex', gap: '6px' }} onClick={exportPayrollCSV}>
                <DownloadSimple size={16} /> Export CSV
              </button>
              <button className="btn btn-outline" style={{ display: 'inline-flex', gap: '6px' }} onClick={triggerPDFPrint}>
                <FileText size={16} /> Print Report
              </button>
            </div>
          </div>

          {/* Ledger Table */}
          <div className="card glass-card">
            <div className="card-header no-print">
              <h3 className="card-title"><CurrencyDollar /> Active Salary Ledger Sheet</h3>
            </div>
            <div className="table-container">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Month</th>
                    <th>Employee Name</th>
                    <th>Base Salary</th>
                    <th>Bonus</th>
                    <th>Deductions</th>
                    <th>Absent Cut</th>
                    <th>Net Salary</th>
                    <th>Amount Paid</th>
                    <th>Outstanding Dues</th>
                    <th>Status</th>
                    <th className="no-print">Dispatch Pay</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredPayroll.length === 0 ? (
                    <tr>
                      <td colSpan="10" className="text-center text-muted" style={{ padding: '32px' }}>
                        No payroll salary records found. Settle first wages using the "Record Month Salary" button.
                      </td>
                    </tr>
                  ) : (
                    filteredPayroll.map(rec => {
                      const emp = employees.find(e => e.id === rec.employee_id);
                      return (
                        <tr key={rec.id}>
                          <td style={{ fontWeight: 600 }}>{rec.month}</td>
                          <td style={{ fontWeight: 700 }}>{emp ? emp.full_name : 'Unknown Employee'}</td>
                          <td>₹{(rec.base_salary || 0).toLocaleString()}</td>
                          <td style={{ color: 'var(--success-text)', fontWeight: 600 }}>+₹{(rec.bonus || 0).toLocaleString()}</td>
                          <td style={{ color: 'var(--danger-text)', fontWeight: 600 }}>-₹{(rec.deductions || 0).toLocaleString()}</td>
                          <td style={{ color: (rec.absent_deduction > 0) ? 'var(--danger-text)' : 'var(--text-muted)', fontSize: '0.85rem' }}>
                            {rec.absent_deduction > 0 ? (
                              <>
                                <span style={{ fontWeight: 600 }}>-₹{(rec.absent_deduction || 0).toLocaleString()}</span>
                                <span style={{ fontSize: '0.72rem', display: 'block', opacity: 0.8 }}>({rec.absent_days || 0}d absent)</span>
                              </>
                            ) : (
                              <span style={{ opacity: 0.6 }}>₹0 (0d)</span>
                            )}
                          </td>
                          <td style={{ fontWeight: 700 }}>₹{(rec.net_salary || 0).toLocaleString()}</td>
                          <td style={{ color: 'var(--success)', fontWeight: 600 }}>₹{(rec.paid_amount || 0).toLocaleString()}</td>
                          <td style={{ color: rec.pending_dues > 0 ? 'var(--danger)' : 'var(--text-main)', fontWeight: 700 }}>
                            ₹{(rec.pending_dues || 0).toLocaleString()}
                          </td>
                          <td>
                            <span className={`status-badge ${
                              rec.status === 'Paid' ? 'status-normal' : 
                              rec.status === 'Partial' ? 'status-low' : 'status-high'
                            }`}>
                              {rec.status}
                            </span>
                          </td>
                          <td className="no-print">
                            <div style={{ display: 'flex', gap: '6px' }}>
                              {rec.pending_dues > 0 ? (
                                <button className="btn btn-primary" style={{ padding: '6px 12px', fontSize: '0.8rem' }} onClick={() => openPaymentModal(rec)}>
                                  <CurrencyDollar size={14} style={{ marginRight: '4px' }} /> Disburse
                                </button>
                              ) : (
                                <span style={{ fontSize: '0.8rem', color: 'var(--success)', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                                  <CheckCircle size={14} /> Settled
                                </span>
                              )}
                              <button className="btn btn-outline" style={{ padding: '6px 12px', fontSize: '0.8rem', display: 'inline-flex', alignItems: 'center', gap: '4px' }} onClick={() => {
                                const emp = employees.find(e => e.id === rec.employee_id);
                                setEditSalaryForm({
                                  id: rec.id,
                                  employee_name: emp ? emp.full_name : 'Unknown Employee',
                                  month: rec.month,
                                  base_salary: rec.base_salary,
                                  bonus: rec.bonus,
                                  deductions: rec.deductions
                                });
                                setEditSalaryModalOpen(true);
                              }}>
                                <PencilSimple size={12} /> Edit
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* =============================================================== */}
      {/* TAB 5: LEGACY DATABASE USER ACCESS CREDENTIALS */}
      {/* =============================================================== */}
      {activeTab === 'access' && currentUser?.role === 'admin' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          <div className="card glass-card">
            <div className="card-header no-print">
              <h3 className="card-title"><Key /> System Authorization Accounts (RBAC)</h3>
              <button className="btn btn-primary" onClick={() => setAddModalOpen(true)}>
                <Plus style={{ marginRight: '8px' }} /> Add Access Credentials
              </button>
            </div>
            <div className="table-container">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Username</th>
                    <th>Database Authorization Role</th>
                    <th>Created At</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {loading && users.length === 0 ? (
                    <tr>
                      <td colSpan="4" className="text-center text-muted" style={{ padding: '32px' }}>
                        Retrieving credentials directory...
                      </td>
                    </tr>
                  ) : users.length === 0 ? (
                    <tr>
                      <td colSpan="4" className="text-center text-muted" style={{ padding: '32px' }}>
                        No authorization credentials registered.
                      </td>
                    </tr>
                  ) : (
                    users.map(u => (
                      <tr key={u.id} style={u.username === currentUser.username ? { backgroundColor: 'rgba(99, 102, 241, 0.05)' } : {}}>
                        <td style={{ fontWeight: 700 }}>
                          {u.username} {u.username === currentUser.username && <span style={{ fontSize: '0.75rem', padding: '2px 6px', background: 'var(--primary)', color: 'white', borderRadius: '4px', marginLeft: '6px' }}>YOU</span>}
                        </td>
                        <td>
                          <span className={`status-badge ${
                            u.role === 'admin' ? 'status-high' : 
                            u.role === 'warehouse_manager' ? 'status-normal' : 'status-low'
                          }`}>
                            {u.role === 'admin' ? '👑 Admin' : u.role === 'warehouse_manager' ? '📦 Warehouse Manager' : '🏷️ Procurement Staff'}
                          </span>
                        </td>
                        <td>{new Date(u.created_at).toLocaleString()}</td>
                        <td>
                          <div style={{ display: 'flex', gap: '8px' }}>
                            <button className="btn btn-outline" style={{ padding: '6px 12px', fontSize: '0.8rem', gap: '6px' }} onClick={() => { setSelectedUser(u); setPasswordForm({ password: '', confirmPassword: '' }); setPasswordModalOpen(true); }}>
                              <Key size={14} /> Password
                            </button>
                            <button className="btn btn-outline" style={{ padding: '6px 12px', fontSize: '0.8rem', gap: '6px' }} onClick={() => { setSelectedUser(u); setEditForm({ role: u.role }); setEditModalOpen(true); }}>
                              <PencilSimple size={14} /> Role
                            </button>
                            <button 
                              className="btn btn-danger" 
                              style={{ padding: '6px 12px', fontSize: '0.8rem', gap: '6px' }} 
                              onClick={() => handleDeleteUser(u)}
                              disabled={u.username === currentUser.username}
                            >
                              <Trash size={14} /> Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* =============================================================== */}
      {/* MODALS SECTION */}
      {/* =============================================================== */}

      {/* 1. Register/Edit Employee Profile Modal */}
      {isEmployeeModalOpen && (
        <div className="modal active">
          <div className="modal-content" style={{ width: '600px' }}>
            <span className="close-modal" onClick={() => setEmployeeModalOpen(false)}>&times;</span>
            <h2 className="modal-title">{employeeModalType === 'add' ? 'Register New Staff Profile' : 'Update Employee Profile'}</h2>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '24px' }}>Fill in the physical credentials and base B2B contract variables.</p>
            
            <form onSubmit={handleEmployeeSubmit}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div className="form-group">
                  <label className="form-label">Full Name</label>
                  <input type="text" className="form-input" required value={employeeForm.full_name} onChange={e => setEmployeeForm({ ...employeeForm, full_name: e.target.value })} placeholder="e.g. Rohan Sharma" />
                </div>
                
                <div className="form-group">
                  <label className="form-label">Role/Position</label>
                  <input type="text" className="form-input" required value={employeeForm.role} onChange={e => setEmployeeForm({ ...employeeForm, role: e.target.value })} placeholder="e.g. Procurement Specialist" />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div className="form-group">
                  <label className="form-label">Phone Number</label>
                  <input type="tel" className="form-input" value={employeeForm.phone} onChange={e => setEmployeeForm({ ...employeeForm, phone: e.target.value })} placeholder="e.g. +91 98765 43210" />
                </div>

                <div className="form-group">
                  <label className="form-label">Email Address</label>
                  <input type="email" className="form-input" value={employeeForm.email} onChange={e => setEmployeeForm({ ...employeeForm, email: e.target.value })} placeholder="e.g. rohan@inventai.com" />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div className="form-group">
                  <label className="form-label">Monthly Wages Base Salary (₹)</label>
                  <input type="number" className="form-input" required value={employeeForm.monthly_salary} onChange={e => setEmployeeForm({ ...employeeForm, monthly_salary: e.target.value })} placeholder="e.g. 45000" />
                </div>

                <div className="form-group">
                  <label className="form-label">Joining Date</label>
                  <input type="date" className="form-input" required value={employeeForm.joining_date} onChange={e => setEmployeeForm({ ...employeeForm, joining_date: e.target.value })} />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Work Contract Status</label>
                <select className="form-input" value={employeeForm.status} onChange={e => setEmployeeForm({ ...employeeForm, status: e.target.value })}>
                  <option value="Active">Active</option>
                  <option value="Inactive">Inactive</option>
                </select>
              </div>

              <div className="form-actions" style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '24px' }}>
                <button type="button" className="btn btn-outline" onClick={() => setEmployeeModalOpen(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={loading}>{loading ? 'Saving...' : 'Settle Profile'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 2. Log Daily Attendance & Work Log Modal */}
      {isLogModalOpen && (
        <div className="modal active">
          <div className="modal-content" style={{ width: '550px' }}>
            <span className="close-modal" onClick={() => setLogModalOpen(false)}>&times;</span>
            <h2 className="modal-title">Log Daily Attendance & Tasks</h2>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '24px' }}>Log working hours, attendance parameters, and direct project work summaries.</p>

            <form onSubmit={handleLogSubmit}>
              <div className="form-group">
                <label className="form-label">Select Employee</label>
                <select className="form-input" required value={logForm.employee_id} onChange={e => setLogForm({ ...logForm, employee_id: e.target.value })}>
                  <option value="">-- Choose Employee --</option>
                  {employees.filter(emp => emp.status === 'Active').map(e => (
                    <option key={e.id} value={e.id}>{e.full_name}</option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div className="form-group">
                  <label className="form-label">Log Date</label>
                  <input type="date" className="form-input" required value={logForm.date} onChange={e => setLogForm({ ...logForm, date: e.target.value })} />
                </div>

                <div className="form-group">
                  <label className="form-label">Attendance Parameters</label>
                  <select className="form-input" value={logForm.status} onChange={e => setLogForm({ ...logForm, status: e.target.value, working_hours: e.target.value === 'Present' ? '8' : e.target.value === 'Half Day' ? '4' : '0' })}>
                    <option value="Present">Present (Full Day)</option>
                    <option value="Half Day">Half Day</option>
                    <option value="Absent">Absent</option>
                    <option value="Leave">On Leave</option>
                  </select>
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Working Hours</label>
                <input type="number" step="0.5" className="form-input" required value={logForm.working_hours} onChange={e => setLogForm({ ...logForm, working_hours: e.target.value })} placeholder="8" />
              </div>

              <div className="form-group">
                <label className="form-label">Daily Completed Tasks Log</label>
                <textarea className="form-input" style={{ minHeight: '80px', fontFamily: 'inherit', resize: 'vertical' }} value={logForm.tasks_completed} onChange={e => setLogForm({ ...logForm, tasks_completed: e.target.value })} placeholder="e.g. Sourced 15 new supply contracts from Metro Distributors, audited damaged stock lot in Room B." />
              </div>

              <div className="form-group">
                <label className="form-label">Supervisor Comments / Notes</label>
                <input type="text" className="form-input" value={logForm.notes} onChange={e => setLogForm({ ...logForm, notes: e.target.value })} placeholder="e.g. Met shift timeline goals perfectly" />
              </div>

              <div className="form-actions" style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '24px' }}>
                <button type="button" className="btn btn-outline" onClick={() => setLogModalOpen(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={loading}>{loading ? 'Logging...' : 'Save Daily Record'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 3. Record Month Salary Payroll Modal */}
      {isSalaryRecordModalOpen && (
        <div className="modal active">
          <div className="modal-content">
            <span className="close-modal" onClick={() => setSalaryRecordModalOpen(false)}>&times;</span>
            <h2 className="modal-title">Record Monthly Salary Wages</h2>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '24px' }}>Initialize monthly base salary ledger parameters alongside custom bonus/deduction allocations.</p>

            <form onSubmit={handleSalaryRecordSubmit}>
              <div className="form-group">
                <label className="form-label">Select Employee</label>
                <select className="form-input" required value={salaryRecordForm.employee_id} onChange={e => { handleSalaryRecordAutoFill(e.target.value); }}>
                  <option value="">-- Choose Employee --</option>
                  {employees.filter(emp => emp.status === 'Active').map(e => (
                    <option key={e.id} value={e.id}>{e.full_name}</option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div className="form-group">
                  <label className="form-label">Target Payroll Month</label>
                  <input type="month" className="form-input" required value={salaryRecordForm.month} onChange={e => setSalaryRecordForm({ ...salaryRecordForm, month: e.target.value })} />
                </div>

                <div className="form-group">
                  <label className="form-label">Base Contract Salary (₹)</label>
                  <input type="number" className="form-input" required value={salaryRecordForm.base_salary} onChange={e => setSalaryRecordForm({ ...salaryRecordForm, base_salary: e.target.value })} />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div className="form-group">
                  <label className="form-label">Custom Incentive Bonus (₹)</label>
                  <input type="number" className="form-input" value={salaryRecordForm.bonus} onChange={e => setSalaryRecordForm({ ...salaryRecordForm, bonus: e.target.value })} />
                </div>

                <div className="form-group">
                  <label className="form-label">Wages Penalty Deductions (₹)</label>
                  <input type="number" className="form-input" value={salaryRecordForm.deductions} onChange={e => setSalaryRecordForm({ ...salaryRecordForm, deductions: e.target.value })} />
                </div>
              </div>

              <div className="form-actions" style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '24px' }}>
                <button type="button" className="btn btn-outline" onClick={() => setSalaryRecordModalOpen(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={loading}>{loading ? 'Creating...' : 'Record Wages'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Monthly Salary wages Payroll Modal */}
      {isEditSalaryModalOpen && (
        <div className="modal active">
          <div className="modal-content">
            <span className="close-modal" onClick={() => setEditSalaryModalOpen(false)}>&times;</span>
            <h2 className="modal-title">Edit Monthly Salary Ledger</h2>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '24px' }}>
              Updating wages parameters for <strong>{editSalaryForm.employee_name}</strong> for month <strong>{editSalaryForm.month}</strong>.
            </p>

            <form onSubmit={handleEditSalarySubmit}>
              <div className="form-group">
                <label className="form-label">Base Contract Salary (₹)</label>
                <input type="number" className="form-input" required value={editSalaryForm.base_salary} onChange={e => setEditSalaryForm({ ...editSalaryForm, base_salary: e.target.value })} />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div className="form-group">
                  <label className="form-label">Custom Incentive Bonus (₹)</label>
                  <input type="number" className="form-input" value={editSalaryForm.bonus} onChange={e => setEditSalaryForm({ ...editSalaryForm, bonus: e.target.value })} />
                </div>

                <div className="form-group">
                  <label className="form-label">Wages Penalty Deductions (₹)</label>
                  <input type="number" className="form-input" value={editSalaryForm.deductions} onChange={e => setEditSalaryForm({ ...editSalaryForm, deductions: e.target.value })} />
                </div>
              </div>

              <div className="form-actions" style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '24px' }}>
                <button type="button" className="btn btn-outline" onClick={() => setEditSalaryModalOpen(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={loading}>{loading ? 'Saving...' : 'Update Wages'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 4. Record Disbursed Payment Modal */}
      {isPaymentModalOpen && selectedSalaryRecord && (
        <div className="modal active">
          <div className="modal-content">
            <span className="close-modal" onClick={() => setPaymentModalOpen(false)}>&times;</span>
            <h2 className="modal-title">Disburse Salary Payment</h2>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '24px' }}>
              Recording a payment transaction to <strong>{employees.find(e => e.id === selectedSalaryRecord.employee_id)?.full_name}</strong> for month <strong>{selectedSalaryRecord.month}</strong>.
            </p>

            <form onSubmit={handlePaymentSubmit}>
              <div className="form-group">
                <label className="form-label">Total Net Salary</label>
                <input type="text" className="form-input" disabled value={`₹${selectedSalaryRecord.net_salary.toLocaleString()}`} />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div className="form-group">
                  <label className="form-label">Outstanding Balance Dues</label>
                  <input type="text" className="form-input" disabled value={`₹${selectedSalaryRecord.pending_dues.toLocaleString()}`} />
                </div>

                <div className="form-group">
                  <label className="form-label">Disburse Amount Paid (₹)</label>
                  <input type="number" max={selectedSalaryRecord.pending_dues} className="form-input" required value={paymentForm.amount_paid} onChange={e => setPaymentForm({ ...paymentForm, amount_paid: e.target.value })} />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div className="form-group">
                  <label className="form-label">Disbursement Date</label>
                  <input type="date" className="form-input" required value={paymentForm.payment_date} onChange={e => setPaymentForm({ ...paymentForm, payment_date: e.target.value })} />
                </div>

                <div className="form-group">
                  <label className="form-label">Transaction Method</label>
                  <select className="form-input" value={paymentForm.payment_method} onChange={e => setPaymentForm({ ...paymentForm, payment_method: e.target.value })}>
                    <option value="UPI">UPI (Instant Dispatch)</option>
                    <option value="Bank Transfer">Bank Wire Transfer</option>
                    <option value="Cash">Physical Cash</option>
                  </select>
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Reference Notes</label>
                <input type="text" className="form-input" value={paymentForm.notes} onChange={e => setPaymentForm({ ...paymentForm, notes: e.target.value })} placeholder="UPI Transaction ID / Wire Reference" />
              </div>

              <div className="form-actions" style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '24px' }}>
                <button type="button" className="btn btn-outline" onClick={() => setPaymentModalOpen(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={loading}>{loading ? 'Disbursing...' : 'Log Settle Payment'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =============================================================== */}
      {/* LEGACY CREDENTIALS MODALS */}
      {/* =============================================================== */}

      {/* Legacy Add User Modal */}
      {isAddModalOpen && (
        <div className="modal active">
          <div className="modal-content">
            <span className="close-modal" onClick={() => setAddModalOpen(false)}>&times;</span>
            <h2 className="modal-title">Register User Access Accounts</h2>
            <form onSubmit={handleCreateUser}>
              <div className="form-group">
                <label className="form-label">Database Username</label>
                <input type="text" className="form-input" required value={addForm.username} onChange={e => setAddForm({ ...addForm, username: e.target.value })} placeholder="e.g. rohansharma" />
              </div>
              
              <div className="form-group">
                <label className="form-label">Temporary Account Password</label>
                <input type="password" minLength="6" className="form-input" required value={addForm.password} onChange={e => setAddForm({ ...addForm, password: e.target.value })} placeholder="At least 6 characters" />
              </div>

              <div className="form-group">
                <label className="form-label">System Authorization Role (RBAC)</label>
                <select className="form-input" required value={addForm.role} onChange={e => setAddForm({ ...addForm, role: e.target.value })}>
                  <option value="admin">👑 Admin (Full Access & Settings)</option>
                  <option value="staff">🏷️ Procurement Staff (Catalog & Sales)</option>
                  <option value="warehouse_manager">📦 Warehouse Manager (PO & Stock Audits)</option>
                </select>
              </div>

              <div className="form-actions" style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                <button type="button" className="btn btn-outline" onClick={() => setAddModalOpen(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={loading}>{loading ? 'Registering...' : 'Register User'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Legacy Edit Role Modal */}
      {isEditModalOpen && (
        <div className="modal active">
          <div className="modal-content">
            <span className="close-modal" onClick={() => setEditModalOpen(false)}>&times;</span>
            <h2 className="modal-title">Update Authorization Role</h2>
            <p className="text-muted" style={{ marginBottom: '16px', fontSize: '0.9rem' }}>Modify system role and dashboard access permissions for <strong>{selectedUser?.username}</strong>.</p>
            <form onSubmit={handleUpdateRole}>
              <div className="form-group">
                <label className="form-label">Select System Role (RBAC)</label>
                <select className="form-input" required value={editForm.role} onChange={e => setEditForm({ ...editForm, role: e.target.value })}>
                  <option value="admin">👑 Admin (Full Access & Settings)</option>
                  <option value="staff">🏷️ Procurement Staff (Catalog & Sales)</option>
                  <option value="warehouse_manager">📦 Warehouse Manager (PO & Stock Audits)</option>
                </select>
              </div>

              <div className="form-actions" style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                <button type="button" className="btn btn-outline" onClick={() => setEditModalOpen(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={loading}>{loading ? 'Saving...' : 'Update Authorization'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Legacy Reset Password Modal */}
      {isPasswordModalOpen && (
        <div className="modal active">
          <div className="modal-content">
            <span className="close-modal" onClick={() => setPasswordModalOpen(false)}>&times;</span>
            <h2 className="modal-title">Reset User Credentials</h2>
            <p className="text-muted" style={{ marginBottom: '16px', fontSize: '0.9rem' }}>Set a new, secure password for <strong>{selectedUser?.username}</strong>.</p>
            <form onSubmit={handleResetPassword}>
              <div className="form-group">
                <label className="form-label">New Password</label>
                <input type="password" minLength="6" className="form-input" required value={passwordForm.password} onChange={e => setPasswordForm({ ...passwordForm, password: e.target.value })} placeholder="At least 6 characters" />
              </div>

              <div className="form-group">
                <label className="form-label">Confirm New Password</label>
                <input type="password" minLength="6" className="form-input" required value={passwordForm.confirmPassword} onChange={e => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })} placeholder="Re-enter password" />
              </div>

              <div className="form-actions" style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                <button type="button" className="btn btn-outline" onClick={() => setPasswordModalOpen(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={loading}>{loading ? 'Resetting...' : 'Change Password'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Staff;
