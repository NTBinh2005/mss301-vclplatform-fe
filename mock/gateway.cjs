// Fake MSS api-gateway with sample data, for trying the UI without the backend.
// Run: npm run mock   (log in with any email/password; an email starting with "admin" gives the admin app,
// password "wrong" shows the login error). Port: MOCK_PORT, default 8080.
const http = require('http');
const ok = (data, message = 'OK') => ({ success: true, code: 'SUCCESS', message, data, timestamp: new Date().toISOString() });
const page = (content) => ({ content, page: 0, size: content.length, totalElements: content.length, totalPages: 1, last: true });
const ago = d => new Date(Date.now() - d * 864e5).toISOString();

const cats = [
  { id: 1, name: 'Greetings', description: 'The signs that open every conversation.', imageUrl: null },
  { id: 2, name: 'Family', description: 'Talk about the people who matter.', imageUrl: null },
  { id: 3, name: 'Numbers', description: 'From one to ten, one hand at a time.', imageUrl: null },
  { id: 4, name: 'Feelings', description: 'Your face is grammar here.', imageUrl: null },
];
const words = [
  [1, 'Xin chào', 'Flat hand at the chest, palm out, tip the fingers forward twice.'], [1, 'Cảm ơn', 'Fingertips at the chin, move forward with a small nod.'],
  [1, 'Tạm biệt', 'Open hand, wave side to side three times.'], [1, 'Xin lỗi', 'Gentle fist over the heart, two small circles.'],
  [2, 'Mẹ', 'Open hand, thumb taps the cheek twice.'], [2, 'Bố', 'Open hand, thumb taps near the brow.'], [2, 'Bạn', 'Two index fingers hook together.'],
  [3, 'Một', 'Index finger up, lift once.'], [3, 'Hai', 'Index and middle finger rise together.'], [3, 'Ba', 'Three fingers rise together.'],
  [4, 'Vui', 'Open hand brushes upward on the chest.'], [4, 'Buồn', 'Open hand slides down the face.'],
];
const vocab = words.map(([c, w, d], i) => ({ id: i + 1, categoryId: c, categoryName: cats[c - 1].name, word: w, description: d, videoTutorialUrl: null, imageUrl: null, expectedId: i === 11 ? null : i * 3 }));
const progress = [
  { vocabularyId: 1, word: 'Xin chào', categoryName: 'Greetings', learningStatus: 'LEARNED', lastAttemptedAt: ago(1) },
  { vocabularyId: 2, word: 'Cảm ơn', categoryName: 'Greetings', learningStatus: 'LEARNED', lastAttemptedAt: ago(2) },
  { vocabularyId: 3, word: 'Tạm biệt', categoryName: 'Greetings', learningStatus: 'LEARNED', lastAttemptedAt: ago(2) },
  { vocabularyId: 5, word: 'Mẹ', categoryName: 'Family', learningStatus: 'LEARNING', lastAttemptedAt: ago(3) },
  { vocabularyId: 8, word: 'Một', categoryName: 'Numbers', learningStatus: 'LEARNING', lastAttemptedAt: ago(0) },
];
const attempts = [
  [8, 'Một', 61, false, 0], [1, 'Xin chào', 88, true, 1], [2, 'Cảm ơn', 79, true, 2], [5, 'Mẹ', 42, false, 3], [3, 'Tạm biệt', 91, true, 2],
].map(([v, w, c, ok, d], i) => ({ attemptId: 100 - i, vocabularyId: v, word: w, categoryId: 1, categoryName: 'x', expectedId: v, isCorrect: ok, aiPredictedCode: v, confidence: c, attemptedAt: ago(d) }));
const stats = { totalAttempts: 23, correctAttempts: 15, learnedCount: 3, totalVocabs: 12, accuracyRate: 65.2, proficiency: 25, currentStreak: 12, longestStreak: 14, weekActivity: [true, true, false, true, true, true, true] };
const achievements = [
  { id: 1, key: 'FIRST_STEP', name: 'First steps', description: 'Make your first attempt', iconKey: 'star', unlocked: true, unlockedAt: ago(20) },
  { id: 2, key: 'CORRECT_10', name: 'Ten right', description: 'Sign correctly 10 times', iconKey: 'check', unlocked: true, unlockedAt: ago(4) },
  { id: 3, key: 'LEARNED_5', name: 'Five in hand', description: 'Learn 5 signs', iconKey: 'book', unlocked: false, unlockedAt: null },
  { id: 4, key: 'PROFICIENCY_50', name: 'Halfway', description: 'Reach 50% proficiency', iconKey: 'chart', unlocked: false, unlockedAt: null },
];
const blogs = [
  { id: 1, title: 'How I learned 100 signs in six weeks — without memorising a single list', content: 'Flashcards almost made me quit. What finally worked was treating every sign like a tiny story about the body.\n\nRecording myself doing “Cảm ơn” ten times taught me more than a week of reading.', authorId: 7, authorName: 'Linh Trần', likeCount: 86, commentCount: 2, likedByMe: false },
  { id: 2, title: 'Your webcam is the best teacher you already own', content: 'Two minutes of watching your own recordings beats twenty minutes of watching tutorials.', authorId: 8, authorName: 'Đức Nguyễn', likeCount: 41, commentCount: 0, likedByMe: true },
  { id: 3, title: 'What my Deaf cousin taught me about getting attention politely', content: 'Waving in someone’s field of view, tapping a shoulder twice, flicking a light — attention has etiquette.', authorId: 9, authorName: 'Mai Phạm', likeCount: 73, commentCount: 5, likedByMe: false },
].map((b, i) => ({ thumbnailUrl: null, status: 'PUBLISHED', createdAt: ago(i * 3 + 1), updatedAt: ago(i), followedAuthor: false, friendWithAuthor: false, deletionReason: null, ...b }));
const comments = [{ id: 1, blogId: 1, userId: 9, userName: 'Mai Phạm', userAvatar: null, mentionedUserId: null, mentionedUserName: null, content: 'This is exactly what worked for me too!', createdAt: ago(1), replyCount: 1, likeCount: 3, likedByMe: false, replies: [] }];
const user = (admin) => ({ userId: admin ? 1 : 42, username: admin ? 'admin' : 'minhanh', email: admin ? 'admin@vsl.com' : 'minh@vsl.com', fullName: admin ? 'Quản Trị' : 'Nguyễn Minh Anh', avatarUrl: null, role: admin ? 'ADMIN' : 'USER', status: 'ACTIVE', createdAt: ago(120), emailNotificationsEnabled: true });

let isAdmin = false;
const routes = [
  ['POST', /^\/api\/auth\/login$/, (b) => { isAdmin = (b.email || '').startsWith('admin'); if (b.password === 'wrong') return [401, { success: false, message: 'Bad credentials' }]; return ok({ accessToken: isAdmin ? 'A' : 'U', refreshToken: 'r', tokenType: 'Bearer', expiresIn: 3600, user: user(isAdmin) }); }],
  ['GET', /^\/api\/auth\/me$/, (b, h) => ok(user(h.authorization === 'Bearer A'))],
  ['POST', /^\/api\/auth\/(send-register-otp|register|forgot-password|verify-otp|reset-password|logout)$/, () => ok(null)],
  ['GET', /^\/api\/users\/me$/, (b, h) => ok(user(h.authorization === 'Bearer A'))],
  ['GET', /^\/api\/categories/, () => ok(page(cats))],
  ['GET', /^\/api\/vocabularies\/exists/, (b, h, url) => { const w = new URL(url, 'http://x').searchParams.get('word'); const hit = vocab.find(v => v.word.toLowerCase() === (w || '').toLowerCase()); return ok({ exists: !!hit, word: hit?.word ?? null, categoryId: hit?.categoryId ?? null, categoryName: hit?.categoryName ?? null }); }],
  ['GET', /^\/api\/vocabularies/, () => ok(page(vocab))],
  ['GET', /^\/api\/practice\/progress$/, () => ok(progress)],
  ['GET', /^\/api\/practice\/stats$/, () => ok(stats)],
  ['GET', /^\/api\/practice\/achievements$/, () => ok(achievements)],
  ['POST', /^\/api\/practice\/evaluate$/, () => ok({ status: 'ALMOST_CORRECT', message: 'Close! Your handshape is right, but finish the movement fully.', confidence: 72.4, predictedId: 3, rank: 2 })],
  ['GET', /^\/api\/attempts\/recent/, () => ok(attempts.slice(0, 5))],
  ['GET', /^\/api\/attempts/, () => ok(page(attempts))],
  ['GET', /^\/api\/blogs\/notifications\/unread-count$/, () => ok(1)],
  ['GET', /^\/api\/blogs\/notifications/, () => ok(page([{ id: 1, type: 'MENTION', read: false, message: 'mentioned you in a comment', actorId: 9, actorName: 'Mai Phạm', actorAvatar: null, blogId: 1, blogTitle: blogs[0].title, createdAt: ago(0.1) }]))],
  ['GET', /^\/api\/blogs\/\d+\/comments$/, () => ok(comments)],
  ['GET', /^\/api\/blogs\/(\d+)$/, (b, h, url) => ok(blogs.find(x => x.id === Number(url.split('/')[3].split('?')[0])))],
  ['GET', /^\/api\/blogs/, () => ok(page(blogs))],
  ['GET', /^\/api\/user\/blogs/, () => ok(page([{ ...blogs[1], id: 9, authorId: 42, status: 'DRAFT', title: 'My first week of signing' }, { ...blogs[0], id: 10, authorId: 42, status: 'REMOVED', deletionReason: 'Contains a personal phone number.' }]))],
  ['GET', /^\/api\/vocabulary-suggestions\/mine$/, () => ok([{ id: 1, word: 'Bác sĩ', description: null, status: 'PENDING', createdAt: ago(2), reviewedAt: null, categoryId: 2, categoryName: 'Family', requesterId: 42, requesterName: 'Minh' }])],
  ['GET', /^\/api\/public\/stats$/, () => ok({ totalUsers: 1280, totalVocabs: 12, satisfactionRate: 96 })],
  ['POST', /^\/api\/visits\/track$/, () => ok(null)],
  ['GET', /^\/api\/admin\/analytics\/summary$/, () => ok({ totalStudents: 1280, totalVisits: 9421, totalVocabularies: 12, totalBlogs: 3 })],
  ['GET', /^\/api\/admin\/analytics\/visits/, () => ok(Array.from({ length: 14 }, (_, i) => ({ label: ago(13 - i).slice(0, 10), count: 20 + ((i * 37) % 60) })))],
  ['GET', /^\/api\/admin\/users/, () => ok(page([user(true), user(false), { ...user(false), userId: 43, fullName: 'Trần Linh', username: 'linh', email: 'linh@vsl.com', status: 'INACTIVE', lastLogin: ago(9) }]))],
  // /api/admin/blogs, /reports, /vocabulary-suggestions deliberately 404 to exercise the "not available yet" state.
];

http.createServer((req, res) => {
  let body = '';
  req.on('data', c => (body += c));
  req.on('end', () => {
    const path = req.url.split('?')[0];
    const r = routes.find(([m, re]) => m === req.method && re.test(path));
    let status = 200, out;
    if (!r) { status = 404; out = { success: false, message: `No route ${req.method} ${path}` }; }
    else {
      let parsed = {}; try { parsed = JSON.parse(body || '{}'); } catch { /* multipart */ }
      const v = r[2](parsed, req.headers, req.url);
      if (Array.isArray(v)) [status, out] = v; else out = v;
    }
    res.writeHead(status, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(out));
  });
}).listen(process.env.MOCK_PORT || 8090, () => console.log(`mock gateway on ${process.env.MOCK_PORT || 8090}`));
