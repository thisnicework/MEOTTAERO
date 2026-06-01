import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize Supabase Client
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;
const isSupabaseConfigured = supabaseUrl && supabaseUrl !== 'your_supabase_project_url' && supabaseKey && supabaseKey !== 'your_supabase_anon_key';
export const supabase = isSupabaseConfigured ? createClient(supabaseUrl, supabaseKey) : null;

if (!isSupabaseConfigured) {
  console.log('Supabase credentials not configured. Falling back to local bookings.json storage.');
}

// Read JSON files dynamically in helper functions

// Define detailed projects (Empty, as MOTTAERO project files are replaced by event details)
const projectDetails = [];

// Helper to read and enrich students dynamically
function loadStudents() {
  const studentsRaw = JSON.parse(fs.readFileSync(path.resolve(__dirname, 'students.json'), 'utf8'));
  return studentsRaw.map(s => {
    return {
      ...s,
      links: [
        { type: 'globe', text: `${s.id}.com`, url: '#' },
        { type: 'email', text: `${s.id}@mottaero.com`, url: `mailto:${s.id}@mottaero.com` }
      ]
    };
  });
}

// Helper to read semesters dynamically
function loadSemesters() {
  const semestersRaw = JSON.parse(fs.readFileSync(path.resolve(__dirname, 'semesters.json'), 'utf8'));
  return semestersRaw.map(sem => {
    if (sem.id === 'vol-2') {
      return {
        ...sem,
        description: `
          <div class="project-text" style="max-width: 480px; margin-bottom: 2rem;">
            <p>학기도 끝나가는데 다시 한번 같이 춤추자 ! 이번엔 진짜 마지막처럼 놀자 ! 매일 밥만 먹던 학식당에서 오늘 밤만큼은 불빛과 음악이 뒤섞입니다.</p>
            <br>
            <p class="bold">FUNK & SOUL PARTY &lt;춤 출 자유 vol.2&gt;</p>
            <p>익숙한 공간이 낯설게 반짝이는 밤, 각자 마음 가는 대로 움직일 시간</p>
            <br>
            <p><strong>DATE:</strong> 2026.06.02 (TUE) 9PM</p>
            <p><strong>LOCATION:</strong> 서울예술대학교 지원동 학식당</p>
            <br>
            <p><strong>DJ:</strong> DAEUN <a href="https://instagram.com/t0r1nsight" target="_blank" rel="noopener noreferrer">@t0r1nsight</a> with <a href="https://instagram.com/98.0811" target="_blank" rel="noopener noreferrer">@98.0811</a> / UIHWA <a href="https://instagram.com/_h_wai" target="_blank" rel="noopener noreferrer">@_h_wai</a></p>
            <br>
            <p class="bold">SHOWCASE</p>
            <p><strong>대희와 가람:</strong> 김대희 <a href="https://instagram.com/daehyi__" target="_blank" rel="noopener noreferrer">@daehyi__</a>, 김가람 <a href="https://instagram.com/__r.am_" target="_blank" rel="noopener noreferrer">@__r.am_</a></p>
            <p><strong>SIA Waackers:</strong> <a href="https://instagram.com/inkayyka" target="_blank" rel="noopener noreferrer">@inkayyka</a>, <a href="https://instagram.com/mseunghy" target="_blank" rel="noopener noreferrer">@mseunghy</a>, <a href="https://instagram.com/seoyoungiin" target="_blank" rel="noopener noreferrer">@seoyoungiin</a>, <a href="https://instagram.com/liimeumvin" target="_blank" rel="noopener noreferrer">@liimeumvin</a>, <a href="https://instagram.com/dltpdus3_" target="_blank" rel="noopener noreferrer">@dltpdus3_</a>, <a href="https://instagram.com/heathe.r" target="_blank" rel="noopener noreferrer">@heathe.r</a>, <a href="https://instagram.com/geungjxng" target="_blank" rel="noopener noreferrer">@geungjxng</a>, <a href="https://instagram.com/1msound" target="_blank" rel="noopener noreferrer">@1msound</a>, <a href="https://instagram.com/sssimuri" target="_blank" rel="noopener noreferrer">@sssimuri</a></p>
            <p><strong>SIA Unlimited:</strong> <a href="https://instagram.com/troydi__ulmtd" target="_blank" rel="noopener noreferrer">@troydi__ulmtd</a>, <a href="https://instagram.com/c_s__lee_" target="_blank" rel="noopener noreferrer">@c_s__lee_</a>, <a href="https://instagram.com/dlm0teo_" target="_blank" rel="noopener noreferrer">@dlm0teo_</a></p>
            <br>
            <p>Presented by <a href="https://instagram.com/meottaero__" target="_blank" rel="noopener noreferrer">@meottaero__</a></p>
            <p class="small" style="font-size: 0.85em; opacity: 0.8;">
              <a href="https://instagram.com/__jon_ji" target="_blank" rel="noopener noreferrer">@__jon_ji</a>, 
              <a href="https://instagram.com/rock.bawe" target="_blank" rel="noopener noreferrer">@rock.bawe</a>, 
              <a href="https://instagram.com/thisnicework" target="_blank" rel="noopener noreferrer">@thisnicework</a>, 
              <a href="https://instagram.com/t0r1nsight" target="_blank" rel="noopener noreferrer">@t0r1nsight</a>, 
              <a href="https://instagram.com/98.0811" target="_blank" rel="noopener noreferrer">@98.0811</a>, 
              <a href="https://instagram.com/jang_peace" target="_blank" rel="noopener noreferrer">@jang_peace</a>, 
              <a href="https://instagram.com/hvv1ni" target="_blank" rel="noopener noreferrer">@hvv1ni</a>, 
              <a href="https://instagram.com/ye0min" target="_blank" rel="noopener noreferrer">@ye0min</a>
            </p>
          </div>
        `
      };
    }
    if (sem.id === 'vol-1') {
      return {
        ...sem,
        description: `
          <div class="project-text" style="max-width: 480px; margin-bottom: 2rem;">
            <p>수업 듣지말고 그냥 놀자.. 근데 쨀 수는 없으니깐.. 몰래 수업 끝나고 같이 춤추자 ! 싫으면 오지말고 재밌어 할 만한 사람만 부를려니까..</p>
            <p>어두운 라동 106, 70–80’s 펑크와 디스코가 뒤섞인 밤이 시작됩니다. 반짝이는 미러볼 아래, 멋대로 움직이는 자유.</p>
            <br>
            <p class="bold">meottaero 첫 번째 파티 &lt;춤 출 자유&gt;</p>
            <p>틀어놓은 음악 위에서 각자 다른 방식으로 반짝일 시간</p>
            <br>
            <p><strong>DATE:</strong> 2026.03.31 (TUE) 9PM</p>
            <p><strong>LOCATION:</strong> 서울예술대학교 라동 106호 (예술대학로 171)</p>
            <p><strong>🎟️ FREE ENTRY:</strong> 프로필 상단 구글폼으로 신청 가능</p>
            <br>
            <p><strong>DJ:</strong> <a href="https://instagram.com/t0r1nsight" target="_blank" rel="noopener noreferrer">@t0r1nsight</a>, <a href="https://instagram.com/dearcoralinee" target="_blank" rel="noopener noreferrer">@dearcoralinee</a></p>
            <br>
            <p class="bold">SHOWCASE</p>
            <p><strong>SIA TUTTING:</strong> <a href="https://instagram.com/hachi_y_" target="_blank" rel="noopener noreferrer">@hachi_y_</a>, <a href="https://instagram.com/jseuki_" target="_blank" rel="noopener noreferrer">@jseuki_</a></p>
            <p><strong>ISSEORA:</strong> <a href="https://instagram.com/rishaat__" target="_blank" rel="noopener noreferrer">@rishaat__</a>, <a href="https://instagram.com/suuak_" target="_blank" rel="noopener noreferrer">@suuak_</a>, <a href="https://instagram.com/elfklm__" target="_blank" rel="noopener noreferrer">@elfklm__</a>, <a href="https://instagram.com/x_unseo" target="_blank" rel="noopener noreferrer">@x_unseo</a></p>
            <p><strong>SIA HOUSE:</strong> <a href="https://instagram.com/0xuxiii" target="_blank" rel="noopener noreferrer">@0xuxiii</a>, <a href="https://instagram.com/xzxz_sy" target="_blank" rel="noopener noreferrer">@xzxz_sy</a>, <a href="https://instagram.com/troydi__ulmtd" target="_blank" rel="noopener noreferrer">@troydi__ulmtd</a>, <a href="https://instagram.com/xdpfla" target="_blank" rel="noopener noreferrer">@xdpfla</a>, <a href="https://instagram.com/taekyung.sss" target="_blank" rel="noopener noreferrer">@taekyung.sss</a>, <a href="https://instagram.com/c_s__lee_" target="_blank" rel="noopener noreferrer">@c_s__lee_</a>, <a href="https://instagram.com/obvlque" target="_blank" rel="noopener noreferrer">@obvlque</a>, <a href="https://instagram.com/dlm0teo_" target="_blank" rel="noopener noreferrer">@dlm0teo_</a>, <a href="https://instagram.com/aaarxxm" target="_blank" rel="noopener noreferrer">@aaarxxm</a></p>
            <br>
            <p>Presented by <a href="https://instagram.com/meottaero__" target="_blank" rel="noopener noreferrer">@meottaero__</a></p>
            <p class="small" style="font-size: 0.85em; opacity: 0.8;">
              <a href="https://instagram.com/__jon_ji" target="_blank" rel="noopener noreferrer">@__jon_ji</a>, 
              <a href="https://instagram.com/rock.bawe" target="_blank" rel="noopener noreferrer">@rock.bawe</a>, 
              <a href="https://instagram.com/thisnicework" target="_blank" rel="noopener noreferrer">@thisnicework</a>, 
              <a href="https://instagram.com/t0r1nsight" target="_blank" rel="noopener noreferrer">@t0r1nsight</a>, 
              <a href="https://instagram.com/98.0811" target="_blank" rel="noopener noreferrer">@98.0811</a>
            </p>
          </div>
        `
      };
    }
    return sem;
  });
}

// Helper queries
export function getStudents() {
  return loadStudents();
}

export function getStudent(id) {
  return loadStudents().find(s => s.id === id);
}

export function getSemesters() {
  return loadSemesters();
}

export function getSemester(id) {
  return loadSemesters().find(sem => sem.id === id);
}

export function getProjects() {
  return projectDetails;
}

export function getProjectsBySemester(semesterId) {
  return projectDetails.filter(p => p.semesterId === semesterId);
}

export function getProjectsByStudent(studentId) {
  return projectDetails.filter(p => p.studentId === studentId);
}

export function getProjectBySlug(studentId, slug) {
  return projectDetails.find(p => p.studentId === studentId && p.slug === slug);
}

export function getRandomProject() {
  const index = Math.floor(Math.random() * projectDetails.length);
  return projectDetails[index];
}

// Booking storage helpers
const BOOKINGS_FILE = path.resolve(__dirname, 'bookings.json');

export async function getBookings() {
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('bookings')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (!error && data) {
        return data.map(b => ({
          code: b.code,
          name: b.name,
          studentId: b.student_id,
          phone: b.phone,
          tickets: b.tickets,
          createdAt: b.created_at
        }));
      } else {
        console.error('Supabase getBookings error:', error);
      }
    } catch (e) {
      console.error('Supabase getBookings failed, falling back to local storage:', e);
    }
  }

  // Fallback to local JSON
  if (!fs.existsSync(BOOKINGS_FILE)) {
    fs.writeFileSync(BOOKINGS_FILE, JSON.stringify([], null, 2), 'utf8');
  }
  try {
    return JSON.parse(fs.readFileSync(BOOKINGS_FILE, 'utf8'));
  } catch (e) {
    return [];
  }
}

export async function saveBooking(booking) {
  // Create a unique confirmation code: MTR-YYYYMMDD-XXXX
  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const randomSuffix = Math.floor(1000 + Math.random() * 9000);
  const bookingCode = `MTR-${dateStr}-${randomSuffix}`;
  const ticketsCount = parseInt(booking.tickets, 10) || 1;

  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('bookings')
        .insert([{
          code: bookingCode,
          name: booking.name,
          student_id: booking.studentId,
          phone: booking.phone,
          tickets: ticketsCount
        }])
        .select();
      
      if (!error && data && data.length > 0) {
        const b = data[0];
        return {
          code: b.code,
          name: b.name,
          studentId: b.student_id,
          phone: b.phone,
          tickets: b.tickets,
          createdAt: b.created_at
        };
      } else {
        console.error('Supabase saveBooking error:', error);
      }
    } catch (e) {
      console.error('Supabase saveBooking failed, falling back to local storage:', e);
    }
  }

  // Fallback to local JSON
  const bookings = await getBookings();
  const newBooking = {
    code: bookingCode,
    name: booking.name,
    studentId: booking.studentId,
    phone: booking.phone,
    tickets: ticketsCount,
    createdAt: new Date().toISOString()
  };
  
  bookings.push(newBooking);
  fs.writeFileSync(BOOKINGS_FILE, JSON.stringify(bookings, null, 2), 'utf8');
  return newBooking;
}

export async function deleteBooking(code) {
  if (supabase) {
    try {
      const { error } = await supabase
        .from('bookings')
        .delete()
        .eq('code', code);
      
      if (!error) {
        return true;
      } else {
        console.error('Supabase deleteBooking error:', error);
      }
    } catch (e) {
      console.error('Supabase deleteBooking failed, falling back to local storage:', e);
    }
  }

  // Fallback to local JSON
  const bookings = await getBookings();
  const updatedBookings = bookings.filter(b => b.code !== code);
  fs.writeFileSync(BOOKINGS_FILE, JSON.stringify(updatedBookings, null, 2), 'utf8');
  return bookings.length !== updatedBookings.length;
}


