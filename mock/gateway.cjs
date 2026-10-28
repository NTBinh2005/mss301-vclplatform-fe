// Fake MSS api-gateway with sample data, for trying the UI without the backend.
// Run: npm run mock   (log in with any username/password; a username starting with "admin" gives the admin app,
// password "wrong" shows the login error). Port: MOCK_PORT, default 8090 — point VITE_GATEWAY_URL at it.
// Routes and shapes follow the real MSS backend (see src/services).
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
const user = (admin) => ({ userId: admin ? 1 : 42, username: admin ? 'admin' : 'minhanh', email: admin ? 'admin@vsl.com' : 'minh@vsl.com', fullName: admin ? 'Quản Trị' : 'Nguyễn Minh Anh', avatarUrl: null, role: admin ? 'ADMIN' : 'USER', bio: null, active: true, createdAt: ago(120), updatedAt: ago(3), emailNotificationsEnabled: true });

const brief = (id, fullName, username) => ({ userId: id, username, fullName, avatarUrl: null, displayName: fullName });
const AUTHORS = { 7: brief(7, 'Linh Trần', 'linh'), 8: brief(8, 'Đức Nguyễn', 'duc'), 9: brief(9, 'Mai Phạm', 'mai'), 42: brief(42, 'Nguyễn Minh Anh', 'minhanh') };
// Backend shapes: lists carry `excerpt` + `author`, the detail view `content`.
const asList = b => { const { content, authorId, authorName, ...rest } = b; return { ...rest, author: AUTHORS[authorId], excerpt: content.length > 200 ? `${content.slice(0, 200)}...` : content, shareCount: 2 }; };
const asDetail = b => { const { authorId, authorName, ...rest } = b; return { ...rest, author: AUTHORS[authorId], shareCount: 2 }; };
const mine = [{ ...blogs[1], id: 9, authorId: 42, status: 'DRAFT', title: 'My first week of signing' }, { ...blogs[0], id: 10, authorId: 42, status: 'HIDDEN', deletionReason: 'Contains a personal phone number.' }];
const apiComments = comments.map(c => ({ id: c.id, blogId: c.blogId, user: AUTHORS[9], mentionedUser: null, content: c.content, replyCount: 1, likeCount: 3, likedByMe: false, createdAt: c.createdAt, updatedAt: c.createdAt }));
const social = (u, extra = {}) => ({ ...u, followerCount: 12, followingCount: 8, friendCount: 3, followedByMe: false, followsMe: false, friend: false, ...extra });
const follow = (id, on) => ({ targetUserId: id, followedByMe: on, followsMe: true, friend: on, followerCount: on ? 13 : 12, followingCount: 8, friendCount: on ? 4 : 3 });
const idOf = url => Number(url.split('?')[0].split('/').filter(Boolean).find(x => /^\d+$/.test(x)));

let isAdmin = false;
const routes = [
  // identity
  ['POST', /^\/api\/auth\/login$/, (b) => { isAdmin = (b.username || '').startsWith('admin'); if (b.password === 'wrong') return [401, { success: false, code: 'AUTH_1003', message: 'Tên đăng nhập/email hoặc mật khẩu không chính xác' }]; const u = user(isAdmin); return ok({ accessToken: isAdmin ? 'A' : 'U', refreshToken: 'r', tokenType: 'Bearer', expiresIn: 1800, userId: u.userId, username: u.username, email: u.email, role: u.role }); }],
  ['POST', /^\/api\/auth\/(send-register-otp|register|forgot-password|verify-otp|reset-password|logout|refresh)$/, () => ok(null)],
  ['GET', /^\/api\/users\/me$/, (b, h) => ok(user(h.authorization === 'Bearer A'))],
  ['PUT', /^\/api\/users\/me$/, (b, h) => ok({ ...user(h.authorization === 'Bearer A'), ...b })],
  ['PUT', /^\/api\/users\/me\/password$/, () => ok(null)],
  ['PATCH', /^\/api\/users\/me\/notifications$/, (b, h, url) => ok({ ...user(false), emailNotificationsEnabled: url.includes('=true') })],
  ['POST', /^\/api\/users\/me\/avatar$/, () => ok(user(false))],
  ['DELETE', /^\/api\/users\/me\/avatar$/, () => ok(user(false))],
  ['DELETE', /^\/api\/users\/me$/, () => ok(null)],
  ['GET', /^\/api\/users\/search/, () => ok(page(Object.values(AUTHORS).map(({ displayName, ...u }) => u)))],
  ['GET', /^\/api\/users\/summaries/, () => ok(Object.values(AUTHORS).map(({ displayName, ...u }) => u))],
  ['GET', /^\/api\/users\/admin\/statistics$/, () => ok({ totalUsers: 1280, activeUsers: 1270, bannedUsers: 4, pendingUsers: 6, adminUsers: 2, regularUsers: 1278 })],
  ['GET', /^\/api\/users\/admin/, () => ok(page([user(true), user(false), { ...user(false), userId: 43, fullName: 'Trần Linh', username: 'linh', email: 'linh@vsl.com' }].map(u => ({ id: u.userId, username: u.username, email: u.email, fullName: u.fullName, avatarUrl: null, role: u.role, status: u.userId === 43 ? 'BANNED' : 'ACTIVE', createdAt: u.createdAt, updatedAt: u.createdAt }))))],
  ['GET', /^\/api\/users\/\d+$/, (b, h, url) => { const a = AUTHORS[idOf(url)]; return a ? ok(a) : [404, { success: false, message: 'Không tìm thấy người dùng' }]; }],
  // learning
  ['GET', /^\/api\/categories/, () => ok(page(cats))],
  ['GET', /^\/api\/vocabularies\/exists/, (b, h, url) => { const w = new URL(url, 'http://x').searchParams.get('word'); const hit = vocab.find(v => v.word.toLowerCase() === (w || '').toLowerCase()); return ok({ exists: !!hit, word: hit?.word ?? null, categoryId: hit?.categoryId ?? null, categoryName: hit?.categoryName ?? null }); }],
  ['GET', /^\/api\/vocabularies\/ai-synonyms/, () => ok({ aiChecked: true, aiError: false, synonyms: [] })],
  ['GET', /^\/api\/vocabularies/, () => ok(page(vocab))],
  ['GET', /^\/api\/practice\/progress$/, () => ok(progress)],
  ['GET', /^\/api\/practice\/stats$/, () => ok(stats)],
  ['GET', /^\/api\/practice\/achievements$/, () => ok(achievements)],
  ['POST', /^\/api\/practice\/evaluate$/, () => ok({ status: 'ALMOST_CORRECT', message: 'Close! Your handshape is right, but finish the movement fully.', confidence: 72.4, predictedId: 3, rank: 2 })],
  ['GET', /^\/api\/attempts\/recent/, () => ok(attempts.slice(0, 5))],
  ['GET', /^\/api\/attempts/, () => ok(page(attempts))],
  ['GET', /^\/api\/vocabulary-suggestions\/mine$/, () => ok([{ id: 1, word: 'Bác sĩ', description: null, status: 'PENDING', createdAt: ago(2), reviewedAt: null, categoryId: 2, categoryName: 'Family', requesterId: 42 }])],
  ['GET', /^\/api\/vocabulary-suggestions\/admin\/pending-count$/, () => ok(1)],
  ['GET', /^\/api\/vocabulary-suggestions\/admin/, () => ok(page([{ id: 1, word: 'Bác sĩ', description: 'For doctor visits', status: 'PENDING', createdAt: ago(2), reviewedAt: null, categoryId: 2, categoryName: 'Family', requesterId: 42 }]))],
  ['DELETE', /^\/api\/vocabulary-suggestions\/\d+$/, () => ok(null)],
  ['GET', /^\/api\/public\/stats$/, () => ok({ totalUsers: 1280, totalVocabs: 12, satisfactionRate: 96 })],
  ['POST', /^\/api\/visits\/track$/, () => ok(null)],
  ['GET', /^\/api\/visits\/admin\/summary$/, () => ok({ totalStudents: 1280, totalVisits: 9421, totalVocabularies: 12, totalBlogs: 3 })],
  ['GET', /^\/api\/visits\/admin\/timeseries/, () => ok(Array.from({ length: 14 }, (_, i) => ({ label: ago(13 - i).slice(0, 10), count: 20 + ((i * 37) % 60) })))],
  ['GET', /^\/api\/visits\/admin\/logs/, () => ok(page([{ id: 1, visitorType: 'USER', userId: 42, deviceInfo: 'Chrome on Windows', ipAddress: '10.0.0.4', location: 'Hồ Chí Minh', visitedAt: ago(0.01) }, { id: 2, visitorType: 'GUEST', userId: null, deviceInfo: 'Safari on iPhone', ipAddress: '10.0.0.9', location: null, visitedAt: ago(0.2) }]))],
  // social
  ['GET', /^\/api\/notifications\/unread-count$/, () => ok(1)],
  ['GET', /^\/api\/notifications/, () => ok(page([{ id: 1, type: 'MENTION', actor: AUTHORS[9], blogId: 1, blogTitle: blogs[0].title, commentId: 1, replyId: null, read: false, createdAt: ago(0.1) }, { id: 2, type: 'FOLLOW', actor: AUTHORS[7], blogId: null, blogTitle: null, commentId: null, replyId: null, read: true, createdAt: ago(1) }]))],
  ['PATCH', /^\/api\/notifications\//, () => ok(1)],
  ['GET', /^\/api\/blogs\/admin\/reports\/pending-count$/, () => ok(1)],
  ['GET', /^\/api\/blogs\/admin\/reports/, () => ok(page([{ id: 1, blogId: 3, blogTitle: blogs[2].title, blogStatus: 'PUBLISHED', reporter: AUTHORS[8], reason: 'Off-topic advertising', status: 'PENDING', createdAt: ago(0.5), updatedAt: ago(0.5) }]))],
  ['GET', /^\/api\/blogs\/admin\/analytics\/overview$/, () => ok({ totalBlogs: 5, publishedBlogs: 3, hiddenBlogs: 1, draftBlogs: 1, totalLikes: 200, totalComments: 7, totalShares: 6, pendingReports: 1, resolvedReports: 2, rejectedReports: 1 })],
  ['GET', /^\/api\/blogs\/admin/, () => ok(page([...blogs, ...mine].map(asList)))],
  ['GET', /^\/api\/blogs\/\d+\/comments$/, () => ok(page(apiComments))],
  ['GET', /^\/api\/blogs\/\d+\/likes$/, () => ok(page([{ user: AUTHORS[8], likedAt: ago(1) }]))],
  ['POST', /^\/api\/blogs\/\d+\/likes$/, (b, h, url) => ok({ blogId: idOf(url), liked: true, likeCount: 87 })],
  ['DELETE', /^\/api\/blogs\/\d+\/likes$/, (b, h, url) => ok({ blogId: idOf(url), liked: false, likeCount: 86 })],
  ['POST', /^\/api\/blogs\/\d+\/shares$/, (b, h, url) => ok({ shareCount: 3, blogUrl: `http://localhost:3000/blogs/${idOf(url)}`, shareType: b.shareType || 'COPY_URL', recipient: null })],
  ['POST', /^\/api\/blogs\/\d+\/reports$/, () => ok(null)],
  ['GET', /^\/api\/blogs\/user\/\d+\/shared/, () => ok(page([]))],
  ['GET', /^\/api\/blogs\/user\/\d+/, (b, h, url) => ok(page(idOf(url) === 42 ? mine.map(asList) : blogs.filter(x => x.authorId === idOf(url)).map(asList)))],
  ['GET', /^\/api\/blogs\/search/, () => ok({ blogs: page(blogs.map(asList)), users: page([social(AUTHORS[9])]) })],
  ['GET', /^\/api\/blogs\/(\d+)$/, (b, h, url) => { const x = [...blogs, ...mine].find(p => p.id === idOf(url)); return x ? ok(asDetail(x)) : [404, { success: false, message: 'Không tìm thấy bài viết' }]; }],
  ['GET', /^\/api\/blogs/, () => ok(page(blogs.map(asList)))],
  ['GET', /^\/api\/comments\/\d+\/replies$/, () => ok(page([{ id: 11, commentId: 1, user: AUTHORS[7], mentionedUser: AUTHORS[9], content: '@mai same here!', likeCount: 0, likedByMe: false, createdAt: ago(0.5), updatedAt: ago(0.5) }]))],
  ['GET', /^\/api\/follows\/\d+\/stats$/, (b, h, url) => ok(follow(idOf(url), false))],
  ['GET', /^\/api\/follows\/\d+\/(followers|following|friends)/, () => ok(page([social(AUTHORS[7], { friend: true, followedByMe: true, followsMe: true })]))],
  ['POST', /^\/api\/follows\/\d+$/, (b, h, url) => ok(follow(idOf(url), true))],
  ['DELETE', /^\/api\/follows\/\d+$/, (b, h, url) => ok(follow(idOf(url), false))],
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
