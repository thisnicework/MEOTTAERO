import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import * as db from './data.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Redirect from mottaero to meottaero
app.use((req, res, next) => {
  const host = req.get('host') || '';
  if (host.includes('mottaero')) {
    const newHost = host.replace('mottaero', 'meottaero');
    return res.redirect(301, `https://${newHost}${req.originalUrl}`);
  }
  next();
});

// Set up template engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Serve static assets with caching headers for media
app.use(express.static(path.join(__dirname, 'public'), {
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('.mp4') || filePath.endsWith('.jpg') || filePath.endsWith('.jpeg') || filePath.endsWith('.png')) {
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    }
  }
}));

// Parse JSON and form request bodies
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Middleware to inject active page and database helpers to templates
app.use((req, res, next) => {
  res.locals.activeMenu = '';
  res.locals.db = db;
  next();
});

// Route: Home Page
app.get('/', (req, res) => {
  const initialProject = db.getRandomProject();
  const initialStudent = initialProject ? db.getStudent(initialProject.studentId) : null;
  res.render('home', {
    title: '// MOTTAERO',
    activeMenu: 'home',
    initialProject,
    initialStudent
  });
});

// Route: Projects Page (Semester list)
app.get('/projects', (req, res) => {
  const initialProject = db.getRandomProject();
  const initialStudent = initialProject ? db.getStudent(initialProject.studentId) : null;
  const semesters = db.getSemesters();
  res.render('projects', {
    title: '// MOTTAERO',
    activeMenu: 'projects',
    semesters,
    initialProject,
    initialStudent
  });
});

// Route: Specific Semester (Projects in that semester)
app.get('/projects/:semester_id', (req, res) => {
  const semesterId = req.params.semester_id;
  const semester = db.getSemester(semesterId);
  if (!semester) {
    return res.status(404).send('Semester not found');
  }
  const semesters = db.getSemesters();
  const projects = db.getProjectsBySemester(semesterId);
  res.render('semester', {
    title: `// MOTTAERO — ${semester.title}`,
    activeMenu: 'projects',
    semesters,
    activeSemester: semester,
    projects
  });
});

// Route: Students Page
app.get('/students', (req, res) => {
  const initialProject = db.getRandomProject();
  const initialStudent = initialProject ? db.getStudent(initialProject.studentId) : null;
  const students = db.getStudents();
  res.render('students', {
    title: '// MOTTAERO',
    activeMenu: 'students',
    students,
    initialProject,
    initialStudent
  });
});

// Route: Specific Student Page (Student details and their projects list)
app.get('/students/:student_id', (req, res) => {
  const studentId = req.params.student_id;
  const student = db.getStudent(studentId);
  if (!student) {
    return res.status(404).send('Student not found');
  }
  const students = db.getStudents();
  const projects = db.getProjectsByStudent(studentId);
  res.render('student', {
    title: `// MOTTAERO — ${student.name}`,
    activeMenu: 'students',
    students,
    activeStudent: student,
    projects
  });
});

// Route: Project Details from Student Context
app.get('/students/:student_id/:project_slug', (req, res) => {
  const { student_id, project_slug } = req.params;
  const student = db.getStudent(student_id);
  const project = db.getProjectBySlug(student_id, project_slug);
  if (!student || !project) {
    return res.status(404).send('Project not found');
  }
  const semester = db.getSemester(project.semesterId);
  const siblingProjects = db.getProjectsByStudent(student_id);
  res.render('project_detail', {
    title: `// MOTTAERO — ${student.name} — ${project.title}`,
    activeMenu: 'students',
    context: 'student',
    student,
    project,
    semester,
    siblingProjects
  });
});

// Route: Project Details from Semester Context
app.get('/projects/:semester_id/:project_slug', (req, res) => {
  const { semester_id, project_slug } = req.params;
  const semester = db.getSemester(semester_id);
  // Find project by slug and semesterId
  const project = db.getProjects().find(p => p.semesterId === semester_id && p.slug === project_slug);
  if (!semester || !project) {
    return res.status(404).send('Project not found');
  }
  const student = db.getStudent(project.studentId);
  const siblingProjects = db.getProjectsBySemester(semester_id);
  res.render('project_detail', {
    title: `// MOTTAERO — ${student.name} — ${project.title}`,
    activeMenu: 'projects',
    context: 'semester',
    student,
    project,
    semester,
    siblingProjects
  });
});

// Route: About Page
app.get('/about', (req, res) => {
  res.render('about', {
    title: '// MOTTAERO — About',
    activeMenu: 'about'
  });
});


// Route: POST Booking Form
app.post('/projects/:semesterId/book', async (req, res) => {
  const { semesterId } = req.params;
  if (semesterId === 'the-sia-vol-2') {
    const { name, phone, type, genre } = req.body;
    if (!name || !phone || !type || !genre) {
      return res.status(400).json({ error: '모든 필드를 올바르게 입력해 주세요.' });
    }
    const studentId = `${type} / ${genre}`;
    try {
      const newBooking = await db.saveBooking({ name, studentId, phone, tickets: 1 });
      res.json({ success: true, booking: newBooking });
    } catch (error) {
      console.error('Error in POST /projects/the-sia-vol-2/book:', error);
      res.status(500).json({ error: '예매 처리 중 서버 오류가 발생했습니다.' });
    }
    return;
  }
  return res.status(400).json({ error: '예매가 마감되었습니다.' });
});

// Auth middleware for admin routes (cookie-based)
function requireAdminAuth(req, res, next) {
  const cookies = req.headers.cookie ? Object.fromEntries(req.headers.cookie.split(';').map(c => c.trim().split('='))) : {};
  if (cookies.admin_session !== 'true') {
    return res.redirect('/login');
  }
  next();
}

// Route: Admin Login Page (GET)
app.get('/login', (req, res) => {
  res.render('login');
});

// Route: Admin Login Submit (POST)
app.post('/login', (req, res) => {
  const { password } = req.body;
  if (password === (process.env.ADMIN_PASSWORD || 'admin')) {
    res.cookie('admin_session', 'true', { httpOnly: true, path: '/' });
    return res.redirect('/admin');
  }
  res.render('login', { error: '비밀번호가 올바르지 않습니다.' });
});

// Route: Admin Bookings Dashboard
app.get('/admin', requireAdminAuth, async (req, res) => {
  try {
    let bookings = await db.getBookings();
    bookings = bookings.map(b => {
      let eventId = '춤출자유vol-2';
      if (b.studentId) {
        if (b.studentId.includes('10대') || b.studentId.includes('20대') || b.studentId.includes('30대') || b.studentId.includes('40대') || b.studentId.includes('50대') || b.studentId.includes('60대')) {
          eventId = 'da-nol-da-nong';
        } else if (b.studentId.includes('참가') || b.studentId.includes('관람')) {
          eventId = 'the-sia-vol-2';
        }
      }
      return { ...b, eventId };
    });
    res.render('bookings', {
      title: '// MOTTAERO — Admin Dashboard',
      activeMenu: 'admin',
      bookings
    });
  } catch (error) {
    console.error('Error in GET /admin:', error);
    res.status(500).send('대시보드를 로드하는 중 오류가 발생했습니다.');
  }
});

// Route: Admin redirect (backward compatibility for old path)
app.get('/admin/bookings', (req, res) => {
  res.redirect('/admin');
});

// Route: Export Bookings as CSV
app.get('/admin/export', requireAdminAuth, async (req, res) => {
  try {
    let bookings = await db.getBookings();
    const { event } = req.query;

    // Classify bookings
    bookings = bookings.map(b => {
      let eventId = '춤출자유vol-2';
      if (b.studentId) {
        if (b.studentId.includes('10대') || b.studentId.includes('20대') || b.studentId.includes('30대') || b.studentId.includes('40대') || b.studentId.includes('50대') || b.studentId.includes('60대')) {
          eventId = 'da-nol-da-nong';
        } else if (b.studentId.includes('참가') || b.studentId.includes('관람')) {
          eventId = 'the-sia-vol-2';
        }
      }
      return { ...b, eventId };
    });

    // Filter if requested
    if (event && event !== 'all') {
      bookings = bookings.filter(b => b.eventId === event);
    }

    const headers = ['공연', '이름', '구분 (학번/참가)', '연락처', '예매일시'];
    const rows = bookings.map(b => [
      b.eventId === 'the-sia-vol-2' ? 'THE SIA Vol.2' : (b.eventId === 'da-nol-da-nong' ? '다놀다농' : '춤 출 자유 Vol.2'),
      b.name,
      b.studentId,
      b.phone,
      b.createdAt || ''
    ]);
    const csv = [headers, ...rows]
      .map(row => row.map(v => `"${String(v).replace(/"/g, '""')}"`).join(','))
      .join('\n');
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    
    const filename = event && event !== 'all' ? `bookings_${event}.csv` : 'bookings_all.csv';
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send('﻿' + csv);
  } catch (error) {
    console.error('Error in GET /admin/export:', error);
    res.status(500).send('내보내기 중 오류가 발생했습니다.');
  }
});

// Route: Update Booking Status (Admin Action)
app.post('/admin/update-status', requireAdminAuth, async (req, res) => {
  const { code, paymentConfirmed, smsSent } = req.body;
  if (!code) {
    return res.status(400).json({ error: '예매 코드가 필요합니다.' });
  }
  try {
    const success = await db.updateBookingStatus(code, { paymentConfirmed, smsSent });
    if (success) {
      res.json({ success: true });
    } else {
      res.status(404).json({ error: '예매 내역을 찾을 수 없습니다.' });
    }
  } catch (error) {
    console.error('Error in POST /admin/update-status:', error);
    res.status(500).json({ error: '상태 업데이트 중 서버 오류가 발생했습니다.' });
  }
});

// Route: DELETE Booking (Admin Action)
app.post('/admin/delete', requireAdminAuth, async (req, res) => {
  const { code } = req.body;
  if (!code) {
    return res.status(400).json({ error: '예매 코드가 필요합니다.' });
  }
  try {
    const success = await db.deleteBooking(code);
    if (success) {
      res.json({ success: true });
    } else {
      res.status(404).json({ error: '예매 내역을 찾을 수 없습니다.' });
    }
  } catch (error) {
    console.error('Error in POST /admin/delete:', error);
    res.status(500).json({ error: '취소 처리 중 서버 오류가 발생했습니다.' });
  }
});

// Export app for serverless environments (Vercel)
export default app;

// Start Server locally
if (process.env.NODE_ENV !== 'production') {
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server is running at http://localhost:${PORT}`);
  });
}
