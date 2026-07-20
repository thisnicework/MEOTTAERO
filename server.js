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
app.get('/projects/:semester_id', async (req, res) => {
  const semesterId = req.params.semester_id;
  const semester = db.getSemester(semesterId);
  if (!semester) {
    return res.status(404).send('Semester not found');
  }
  const semesters = db.getSemesters();
  const projects = db.getProjectsBySemester(semesterId);

  let isSoldOut = false;
  try {
    const capacities = db.getCapacities();
    const bookings = await db.getBookings();
    
    if (semesterId === 'the-sia-vol-2') {
      const siaCount = bookings.filter(b => {
        let eventId = '춤출자유vol-2';
        if (b.studentId) {
          if (b.studentId.includes('10대') || b.studentId.includes('20대') || b.studentId.includes('30대') || b.studentId.includes('40대') || b.studentId.includes('50대') || b.studentId.includes('60대')) {
            eventId = '다놀다농';
          } else if (b.studentId.includes('참가') || b.studentId.includes('관람')) {
            eventId = 'the-sia-vol-2';
          }
        }
        return eventId === 'the-sia-vol-2';
      }).length;
      const maxCapacity = capacities['the-sia-vol-2'] !== undefined ? capacities['the-sia-vol-2'] : 150;
      isSoldOut = siaCount >= maxCapacity;
    } else if (semesterId === '다놀다농') {
      const danongCount = bookings.filter(b => {
        let eventId = '춤출자유vol-2';
        if (b.studentId) {
          if (b.studentId.includes('10대') || b.studentId.includes('20대') || b.studentId.includes('30대') || b.studentId.includes('40대') || b.studentId.includes('50대') || b.studentId.includes('60대')) {
            eventId = '다놀다농';
          } else if (b.studentId.includes('참가') || b.studentId.includes('관람')) {
            eventId = 'the-sia-vol-2';
          }
        }
        return eventId === '다놀다농';
      }).length;
      const maxCapacity = capacities['다놀다농'] !== undefined ? capacities['다놀다농'] : 50;
      isSoldOut = danongCount >= maxCapacity;
    }
  } catch (error) {
    console.error('Error calculating isSoldOut in GET /projects/:semester_id:', error);
  }

  res.render('semester', {
    title: `// MOTTAERO — ${semester.title}`,
    activeMenu: 'projects',
    semesters,
    activeSemester: semester,
    projects,
    isSoldOut
  });
});

// Route: Crew Page
app.get('/crew', (req, res) => {
  const initialProject = db.getRandomProject();
  const initialStudent = initialProject ? db.getStudent(initialProject.studentId) : null;
  const students = db.getStudents();
  res.render('crew', {
    title: '// MOTTAERO',
    activeMenu: 'crew',
    students,
    initialProject,
    initialStudent
  });
});

// Route: Specific Crew Member Page (Crew member details and their projects list)
app.get('/crew/:student_id', (req, res) => {
  const studentId = req.params.student_id;
  const student = db.getStudent(studentId);
  if (!student) {
    return res.status(404).send('Crew member not found');
  }
  const students = db.getStudents();
  const projects = db.getProjectsByStudent(studentId);
  res.render('crew_member', {
    title: `// MOTTAERO — ${student.name}`,
    activeMenu: 'crew',
    students,
    activeStudent: student,
    projects
  });
});

// Route: Project Details from Crew Context
app.get('/crew/:student_id/:project_slug', (req, res) => {
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
    activeMenu: 'crew',
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

// Route: Photo Booth Page
app.get('/booth', (req, res) => {
  res.render('booth', {
    title: '// MOTTAERO — Booth',
    activeMenu: 'booth'
  });
});


// Route: POST Booking Form
app.post('/projects/:semesterId/book', async (req, res) => {
  const { semesterId } = req.params;
  
  try {
    const capacities = db.getCapacities();
    const bookings = await db.getBookings();

    if (semesterId === 'the-sia-vol-2') {
      const count = bookings.filter(b => {
        let eventId = '춤출자유vol-2';
        if (b.studentId) {
          if (b.studentId.includes('10대') || b.studentId.includes('20대') || b.studentId.includes('30대') || b.studentId.includes('40대') || b.studentId.includes('50대') || b.studentId.includes('60대')) {
            eventId = '다놀다농';
          } else if (b.studentId.includes('참가') || b.studentId.includes('관람')) {
            eventId = 'the-sia-vol-2';
          }
        }
        return eventId === 'the-sia-vol-2';
      }).length;
      const maxCapacity = capacities['the-sia-vol-2'] !== undefined ? capacities['the-sia-vol-2'] : 150;
      if (count >= maxCapacity) {
        return res.status(400).json({ error: '예매가 마감되었습니다.' });
      }

      const { name, phone, type, genre } = req.body;
      if (!name || !phone || !type || !genre) {
        return res.status(400).json({ error: '모든 필드를 올바르게 입력해 주세요.' });
      }
      const studentId = `${type} / ${genre}`;
      const newBooking = await db.saveBooking({ name, studentId, phone, tickets: 1 });
      return res.json({ success: true, booking: newBooking });
    }

    if (semesterId === '다놀다농') {
      const count = bookings.filter(b => {
        let eventId = '춤출자유vol-2';
        if (b.studentId) {
          if (b.studentId.includes('10대') || b.studentId.includes('20대') || b.studentId.includes('30대') || b.studentId.includes('40대') || b.studentId.includes('50대') || b.studentId.includes('60대')) {
            eventId = '다놀다농';
          } else if (b.studentId.includes('참가') || b.studentId.includes('관람')) {
            eventId = 'the-sia-vol-2';
          }
        }
        return eventId === '다놀다농';
      }).length;
      const maxCapacity = capacities['다놀다농'] !== undefined ? capacities['다놀다농'] : 50;
      if (count >= maxCapacity) {
        return res.status(400).json({ error: '예매가 마감되었습니다.' });
      }

      const { name, phone, ageGroup, residence, referral, sessions } = req.body;
      if (!name || !phone || !ageGroup || !residence || !referral || !sessions || !Array.isArray(sessions) || sessions.length === 0) {
        return res.status(400).json({ error: '모든 필드를 올바르게 입력하고 신청 회차를 최소 하나 이상 선택해 주세요.' });
      }
      
      const studentId = `${ageGroup} / ${residence} / ${referral} / ${sessions.join(', ')}`;
      const newBooking = await db.saveBooking({ name, studentId, phone, tickets: 1 });
      return res.json({ success: true, booking: newBooking });
    }
  } catch (error) {
    console.error(`Error in POST /projects/${semesterId}/book:`, error);
    return res.status(500).json({ error: '예매 처리 중 서버 오류가 발생했습니다.' });
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
          eventId = '다놀다농';
        } else if (b.studentId.includes('참가') || b.studentId.includes('관람')) {
          eventId = 'the-sia-vol-2';
        }
      }
      return { ...b, eventId };
    });

    // Filter out bookings that belong to inactive/ended events
    bookings = bookings.filter(b => b.eventId === 'the-sia-vol-2' || b.eventId === '다놀다농');

    const capacities = db.getCapacities();
    res.render('bookings', {
      title: '// MOTTAERO — Admin Dashboard',
      activeMenu: 'admin',
      bookings,
      capacities
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
          eventId = '다놀다농';
        } else if (b.studentId.includes('참가') || b.studentId.includes('관람')) {
          eventId = 'the-sia-vol-2';
        }
      }
      return { ...b, eventId };
    });

    // Filter if requested, otherwise exclude inactive events by default
    if (event && event !== 'all') {
      bookings = bookings.filter(b => b.eventId === event);
    } else {
      bookings = bookings.filter(b => b.eventId === 'the-sia-vol-2' || b.eventId === '다놀다농');
    }

    const headers = ['공연', '이름', '구분 (학번/참가)', '연락처', '예매일시'];
    const rows = bookings.map(b => [
      b.eventId === 'the-sia-vol-2' ? 'THE SIA Vol.2' : (b.eventId === '다놀다농' ? '다놀다농' : '춤 출 자유 Vol.2'),
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

// Route: Update Booking Capacity Settings (Admin Action)
app.post('/admin/update-capacity', requireAdminAuth, (req, res) => {
  const { capacities } = req.body;
  if (!capacities || typeof capacities !== 'object') {
    return res.status(400).json({ error: '올바른 설정 데이터가 필요합니다.' });
  }
  try {
    db.saveCapacities(capacities);
    res.json({ success: true });
  } catch (error) {
    console.error('Error in POST /admin/update-capacity:', error);
    res.status(500).json({ error: '인원 제한 설정 저장 중 서버 오류가 발생했습니다.' });
  }
});

// Route: DELETE Booking (Admin Action)
app.post('/admin/delete', requireAdminAuth, async (req, res) => {
  const { code, password } = req.body;
  if (!code) {
    return res.status(400).json({ error: '예매 코드가 필요합니다.' });
  }

  // Verify the admin password
  const adminPassword = process.env.ADMIN_PASSWORD || 'admin';
  if (password !== adminPassword) {
    return res.status(403).json({ error: '비밀번호가 올바르지 않습니다.' });
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
