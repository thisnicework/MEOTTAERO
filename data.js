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
    if (sem.id === '다놀다농') {
      return {
        ...sem,
        description: `
          <div class="project-text" style="max-width: 480px; margin-bottom: 2rem;">
            <p class="bold" style="font-size: 1.25rem; margin-bottom: 0.5rem; color: var(--color-high);">&lt;다놀다농&gt; 댄스워크숍</p>
            <p style="margin-bottom: 1.5rem; font-size: 0.95rem;">멋대로 X 다농마트 다같이 놀자 다농 한바퀴~ 💃🏿🪩🕺🏿</p>
            <p style="margin-bottom: 1.5rem; font-size: 0.95rem; line-height: 1.6;">
              춤과 음악을 중심으로 자유롭게 감각을 경험하고 머물 수 있는 로컬 기반 문화 프로젝트 &lt;다놀다농&gt;에서 음악·움직임·휴식·파티 문화를 보다 가볍고 열린 방식으로 즐길 분들을 모집합니다!
            </p>
            
            <p class="bold" style="color: var(--color-high);">✪ 모집 대상</p>
            <p style="margin-bottom: 1rem;">10대 - 60대 지역주민</p>
            
            <p class="bold" style="color: var(--color-high);">✪ 모집 기간</p>
            <p style="margin-bottom: 1rem;">2026. 07. 20 ~ 08. 06</p>
            
            <p class="bold" style="color: var(--color-high);">✪ 프로그램</p>
            <p style="margin-bottom: 1rem; line-height: 1.6;">
              <strong>1. 하우스댄스 워크숍</strong> (7.24 ~ 7.25 / 19시~21시)<br>
              &nbsp;&nbsp;- 하우스 댄스 기본기 익히기, 간단한 안무 배우기, 영상 촬영<br>
              <strong>2. 파티댄스 워크숍</strong> (7.31 ~ 8.01 / 19시~21시)<br>
              &nbsp;&nbsp;- 파티 댄스 기본기 익히기, 간단한 안무 배우기, 몸풀기, 영상 촬영<br>
              <strong>3. 댄스파티</strong> (8.07 / 19시~21시) *필수 참여<br>
              &nbsp;&nbsp;- DJ의 음악을 들으며 다함께 즐기기, 쇼케이스 공연
            </p>
            
            <p class="bold" style="color: var(--color-high);">✪ 문의</p>
            <p style="margin-bottom: 1.5rem;">📞 010-2692-8501</p>
            

          </div>
        `
      };
    }
    if (sem.id === 'the-sia-vol-2') {
      return {
        ...sem,
        description: `
          <div class="project-text" style="max-width: 480px; margin-bottom: 2rem;">
            <p class="bold" style="font-size: 1.25rem; margin-bottom: 0.5rem; color: var(--color-high);">THE SIA Vol.2</p>
            <p style="margin-bottom: 1.5rem; font-size: 0.95rem;">⊛ OPENSTYLE LIVE BAND 1on1 BATTLE</p>
            
            <p class="bold" style="margin-top: 1rem; color: var(--color-high);">✪ DATE</p>
            <p style="margin-bottom: 1rem;">🕟 2026.08.29 (SAT) 2PM</p>
            
            <p class="bold" style="color: var(--color-high);">✪ LOCATION</p>
            <p style="margin-bottom: 1rem;">📍 서울예술대학교 (경기도 안산시 단원구 예술대학로 171)</p>
            
            <p class="bold" style="color: var(--color-high);">✪ JUDGE</p>
            <p style="margin-bottom: 1rem; line-height: 1.6;">
              MARIO <a href="https://instagram.com/supa_soul_m" target="_blank" rel="noopener noreferrer">@supa_soul_m</a><br>
              LOCKER HWA <a href="https://instagram.com/lockerhwa" target="_blank" rel="noopener noreferrer">@lockerhwa</a><br>
              JEEM <a href="https://instagram.com/masterpiece_jeem" target="_blank" rel="noopener noreferrer">@masterpiece_jeem</a>
            </p>
            
            <p class="bold" style="color: var(--color-high);">✪ BATTLE GUEST</p>
            <p style="margin-bottom: 1rem;">REXKANG <a href="https://instagram.com/rexkang_" target="_blank" rel="noopener noreferrer">@rexkang_</a></p>
            
            <p class="bold" style="color: var(--color-high);">✪ DJ</p>
            <p style="margin-bottom: 1rem;">DAEUN <a href="https://instagram.com/t0r1nsight" target="_blank" rel="noopener noreferrer">@t0r1nsight</a></p>
            
            <p class="bold" style="color: var(--color-high);">✪ MC</p>
            <p style="margin-bottom: 1rem;">JINYOUNG <a href="https://instagram.com/yddeenn" target="_blank" rel="noopener noreferrer">@yddeenn</a></p>
            
            <p class="bold" style="color: var(--color-high);">✪ BAND</p>
            <p style="margin-bottom: 1rem; line-height: 1.6;">
              WOO YECHAN <a href="https://instagram.com/723wixx" target="_blank" rel="noopener noreferrer">@723wixx</a><br>
              NAM JEONGHYO <a href="https://instagram.com/namechloeee" target="_blank" rel="noopener noreferrer">@namechloeee</a><br>
              AN BOEUN <a href="https://instagram.com/bonninnop" target="_blank" rel="noopener noreferrer">@bonninnop</a><br>
              YU JIHOON <a href="https://instagram.com/uzhhuzh" target="_blank" rel="noopener noreferrer">@uzhhuzh</a>
            </p>
            
            <p class="bold" style="color: var(--color-high);">✪ VOCAL</p>
            <p style="margin-bottom: 1.5rem; line-height: 1.6;">
              WZN <a href="https://instagram.com/wznszn" target="_blank" rel="noopener noreferrer">@wznszn</a><br>
              SOYOUNG <a href="https://instagram.com/ssoyoungkwak" target="_blank" rel="noopener noreferrer">@ssoyoungkwak</a><br>
              AHN HYUNGJIN <a href="https://instagram.com/98.0811" target="_blank" rel="noopener noreferrer">@98.0811</a>
            </p>
            
            <p class="bold" style="color: var(--color-high);">⚑ ENTRY FEE</p>
            <p style="margin-bottom: 1rem; line-height: 1.5;">
              • 얼리버드예매 (07.19 ~ 07.28)<br>
              &nbsp;&nbsp;참가비 30,000₩ / 관람비 25,000₩<br>
              • 일반예매 (07.28 ~ 08.26)<br>
              &nbsp;&nbsp;참가비 35,000₩ / 관람비 30,000₩
            </p>
            <p class="small" style="font-size: 0.85em; opacity: 0.85; line-height: 1.4; margin-bottom: 1.5rem;">
              ⋆ 비수도권에서 오시는 참가자 및 관람자 분들께는 5,000원 할인이 진행됩니다.<br>
              ⋆ 환불 및 양도는 행사 7일 전까지만 가능합니다.
            </p>
          </div>
        `
      };
    }
    if (sem.id === '춤출자유vol-2') {
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
    if (sem.id === '춤출자유vol-1') {
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
            <p><strong>LOCATION:</strong> 서울예술대학교 라동 106호</p>
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
        return data.map(b => {
          let paymentConfirmed = b.payment_confirmed || false;
          let smsSent = b.sms_sent || false;
          let studentId = b.student_id || '';
          
          // Parse metadata appended to student_id if present
          if (studentId.includes(' || [PAID:')) {
            const parts = studentId.split(' || [PAID:');
            studentId = parts[0];
            const metaStr = parts[1]; // e.g. "true,SMS:false]" or "false,SMS:true]"
            const paidMatch = metaStr.match(/^([^,]+)/);
            const smsMatch = metaStr.match(/SMS:([^\]]+)/);
            paymentConfirmed = paidMatch ? paidMatch[1] === 'true' : false;
            smsSent = smsMatch ? smsMatch[1] === 'true' : false;
          }
          
          return {
            code: b.code,
            name: b.name,
            studentId: studentId,
            phone: b.phone,
            tickets: b.tickets,
            createdAt: b.created_at,
            paymentConfirmed: paymentConfirmed,
            smsSent: smsSent
          };
        });
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
          createdAt: b.created_at,
          paymentConfirmed: b.payment_confirmed || false,
          smsSent: b.sms_sent || false
        };
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
    createdAt: new Date().toISOString(),
    paymentConfirmed: false,
    smsSent: false
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

export async function updateBookingStatus(code, updates) {
  const { paymentConfirmed, smsSent } = updates;
  
  // Find current booking first to get its current clean studentId
  const bookings = await getBookings();
  const booking = bookings.find(b => b.code === code);
  if (!booking) return false;
  
  const cleanStudentId = booking.studentId;
  const newStudentIdWithMeta = `${cleanStudentId} || [PAID:${paymentConfirmed},SMS:${smsSent}]`;
  
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('bookings')
        .update({
          student_id: newStudentIdWithMeta
        })
        .eq('code', code)
        .select();

      if (!error && data && data.length > 0) {
        // Also update local JSON cache safely
        const bookingIndex = bookings.findIndex(b => b.code === code);
        if (bookingIndex !== -1) {
          bookings[bookingIndex].paymentConfirmed = paymentConfirmed;
          bookings[bookingIndex].smsSent = smsSent;
          try {
            fs.writeFileSync(BOOKINGS_FILE, JSON.stringify(bookings, null, 2), 'utf8');
          } catch (writeErr) {
            console.warn('Failed to write local bookings.json cache (expected in serverless/Vercel):', writeErr);
          }
        }
        return true;
      }
    } catch (e) {
      console.error('Supabase updateBookingStatus failed:', e);
    }
  }

  // Fallback to local JSON
  const bookingIndex = bookings.findIndex(b => b.code === code);
  if (bookingIndex !== -1) {
    bookings[bookingIndex].paymentConfirmed = paymentConfirmed;
    bookings[bookingIndex].smsSent = smsSent;
    try {
      fs.writeFileSync(BOOKINGS_FILE, JSON.stringify(bookings, null, 2), 'utf8');
    } catch (writeErr) {
      console.warn('Failed to write local bookings.json fallback:', writeErr);
    }
    return true;
  }
  return false;
}

export function getCapacities() {
  const filePath = path.resolve(__dirname, 'capacity_config.json');
  if (!fs.existsSync(filePath)) {
    const defaults = {
      "the-sia-vol-2": 150,
      "다놀다농": 50
    };
    try {
      fs.writeFileSync(filePath, JSON.stringify(defaults, null, 2), 'utf8');
    } catch (e) {
      // Ignore
    }
    return defaults;
  }
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (e) {
    console.error('Error reading capacity_config.json:', e);
    return {
      "the-sia-vol-2": 150,
      "다놀다농": 50
    };
  }
}

export function saveCapacities(capacities) {
  const filePath = path.resolve(__dirname, 'capacity_config.json');
  try {
    fs.writeFileSync(filePath, JSON.stringify(capacities, null, 2), 'utf8');
  } catch (e) {
    console.warn('Failed to write local capacity_config.json (expected in serverless/Vercel):', e);
  }
  return true;
}
