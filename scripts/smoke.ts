/* Drives the FE's real service layer (src/services) against a running MSS backend.
   Run: npm run smoke   (backend stack up; JWT_SECRET read from ../mss301-vslplatform-project/.env)
   Everything the run creates is removed at the end; KEEP_DATA=1 keeps it for debugging. */
import { adminCall, deletePost, mintAdminToken, purgeUsers } from './devtools';

const mem = () => { const m = new Map<string, string>(); return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => { m.set(k, String(v)); }, removeItem: (k: string) => { m.delete(k); }, clear: () => m.clear() }; };
(globalThis as any).localStorage = mem();
(globalThis as any).sessionStorage = mem();

const { tokens } = await import('../src/api/client');
const S = await import('../src/services');
const { apiErrorMessage } = await import('../src/api/errors');
const { authApi, userApi, namesFor, categoryApi, vocabularyApi, practiceApi, attemptApi, suggestionApi, publicApi, blogApi, followApi, notificationApi, adminApi } = S;

const created = { users: [] as number[], posts: [] as number[], vocabs: [] as number[], categories: [] as number[] };
async function cleanup() {
  if (process.env.KEEP_DATA === '1') return;
  for (const id of created.posts) await deletePost(id);
  for (const id of created.vocabs) await adminCall('DELETE', `/api/vocabularies/${id}`).catch(() => {});
  for (const id of created.categories) await adminCall('DELETE', `/api/categories/${id}`).catch(() => {});
  for (const id of created.users) await adminCall('DELETE', `/api/users/admin/${id}`).catch(() => {});
  purgeUsers(created.users);
  console.log('cleaned up test data');
}

let pass = 0, fail = 0;
const failures: string[] = [];
async function step<T>(name: string, fn: () => Promise<T>, check?: (r: T) => boolean | string): Promise<T | undefined> {
  try {
    const r = await fn();
    const c = check ? check(r) : true;
    if (c === true) { pass++; console.log(`  ok   ${name}`); }
    else { fail++; failures.push(name); console.log(`  FAIL ${name} — ${typeof c === 'string' ? c : JSON.stringify(r).slice(0, 300)}`); }
    return r;
  } catch (e: any) {
    fail++; failures.push(name);
    console.log(`  FAIL ${name} — ${e?.response?.status ?? ''} ${apiErrorMessage(e, String(e?.message))}`);
    return undefined;
  }
}
async function expectError(name: string, fn: () => Promise<unknown>, status: number) {
  try { await fn(); fail++; failures.push(name); console.log(`  FAIL ${name} — expected ${status}, got success`); }
  catch (e: any) {
    const s = e?.response?.status;
    if (s === status) { pass++; console.log(`  ok   ${name} (${s}: ${apiErrorMessage(e, '')})`); }
    else { fail++; failures.push(name); console.log(`  FAIL ${name} — expected ${status}, got ${s} ${apiErrorMessage(e, '')}`); }
  }
}

const asAdmin = () => tokens.set(ADMIN, 'none');
const as = (t: { a: string; r: string }) => tokens.set(t.a, t.r);

// 1x1 PNG
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
const png = (name = 'x.png') => new File([PNG], name, { type: 'image/png' });

const ADMIN = mintAdminToken();
try {
const sfx = Date.now().toString(36).slice(-5);
const PW = 'secret12';

console.log('— admin creates two learners');
asAdmin();
const alice = await step('adminApi.createUser alice', () => adminApi.createUser({ username: `fe_alice_${sfx}`, email: `fe_alice_${sfx}@test.local`, password: PW, fullName: 'Alice FE', role: 'USER' }), r => !!r.id);
const bob = await step('adminApi.createUser bob', () => adminApi.createUser({ username: `fe_bob_${sfx}`, email: `fe_bob_${sfx}@test.local`, password: PW, fullName: 'Bob FE', role: 'USER' }), r => !!r.id);
if (alice) created.users.push(alice.id);
if (bob) created.users.push(bob.id);
if (!alice || !bob) throw new Error('cannot continue without the two test accounts');

console.log('— identity (learner)');
tokens.clear();
const la = await step('authApi.login by username', () => authApi.login(alice.username, PW), r => !!r.accessToken && !!r.refreshToken);
const A = { a: la!.accessToken, r: la!.refreshToken };
tokens.clear();
const lb = await step('authApi.login by email', () => authApi.login(bob.email, PW), r => !!r.accessToken);
const B = { a: lb!.accessToken, r: lb!.refreshToken };
await expectError('authApi.login wrong password → 401', () => authApi.login(alice.username, 'nope'), 401);
as(A);
await step('userApi.me', () => userApi.me(), r => r.userId === alice.id && r.fullName === 'Alice FE');
await step('userApi.updateProfile', () => userApi.updateProfile({ fullName: 'Alice Updated', bio: 'I sign.' }), r => r.fullName === 'Alice Updated' && r.bio === 'I sign.');
await step('userApi.setEmailNotifications(false)', () => userApi.setEmailNotifications(false), r => r.emailNotificationsEnabled === false);
await step('userApi.uploadAvatar', () => userApi.uploadAvatar(png()), r => !!r.avatarUrl);
await step('userApi.setAvatarUrl', () => userApi.setAvatarUrl('https://example.com/me.png'), r => r.avatarUrl === 'https://example.com/me.png');
await expectError('userApi.setAvatarUrl rejects non-http → 400', () => userApi.setAvatarUrl('ftp://x/y.png'), 400);
await step('userApi.removeAvatar', () => userApi.removeAvatar(), r => !r.avatarUrl);
await step('userApi.get (public)', () => userApi.get(bob.id), r => r.username === bob.username);
await step('userApi.search', () => userApi.search(`fe_bob_${sfx}`), r => r.content.some(u => u.userId === bob.id));
await step('namesFor', () => namesFor([alice.id, bob.id, null]), r => r.size === 2);
// refresh path: break the access token, the interceptor must refresh and retry.
tokens.set('broken.token.value', A.r);
await step('client refreshes an expired access token', () => userApi.me(), r => r.userId === alice.id);
A.a = tokens.access!; A.r = tokens.refresh!;

console.log('— learning');
await step('publicApi.stats', () => publicApi.stats(), r => typeof r.totalVocabs === 'number');
await step('publicApi.trackVisit', () => publicApi.trackVisit());
const cats = await step('categoryApi.list', () => categoryApi.list(0, 100), r => r.content.length > 0);
const vocab = await step('vocabularyApi.list', () => vocabularyApi.list(0, 500), r => r.content.length > 0);
await step('vocabularyApi.search', () => vocabularyApi.search(vocab!.content[0].word), r => r.content.length > 0);
await step('vocabularyApi.byCategory', () => vocabularyApi.byCategory(cats!.content[0].id), r => Array.isArray(r.content));
const scorable = vocab!.content.find(v => v.expectedId != null && v.videoTutorialUrl);
if (scorable) {
  const buf = Buffer.from(await (await fetch(scorable.videoTutorialUrl!)).arrayBuffer());
  await step(`practiceApi.evaluate by vocabularyId (“${scorable.word}” tutorial video)`,
    () => practiceApi.evaluate(new File([buf], 'clip.mp4', { type: 'video/mp4' }), scorable.id, 0, 1),
    r => (r.status === 'CORRECT' ? true : `status ${r.status} ${r.confidence}`));
}
await step('practiceApi.progress', () => practiceApi.progress(), r => !scorable || r.some(p => p.vocabularyId === scorable.id));
await step('practiceApi.stats', () => practiceApi.stats(), r => r.totalAttempts >= (scorable ? 1 : 0) && r.weekActivity.length === 7);
await step('practiceApi.achievements', () => practiceApi.achievements(), r => Array.isArray(r));
await step('attemptApi.mine', () => attemptApi.mine(0, 10), r => !scorable || r.content[0]?.vocabularyId === scorable.id);
await step('attemptApi.recent', () => attemptApi.recent(5), r => Array.isArray(r));
await step('suggestionApi.exists (existing word)', () => suggestionApi.exists(vocab!.content[0].word), r => r.exists);
const sug = await step('suggestionApi.submit', () => suggestionApi.submit({ categoryId: cats!.content[0].id, word: `Từ thử ${sfx}`, description: 'smoke' }), r => r.status === 'PENDING');
await step('suggestionApi.mine', () => suggestionApi.mine(), r => r.some(s => s.id === sug?.id));
const sug2 = await step('suggestionApi.submit (2nd)', () => suggestionApi.submit({ categoryId: cats!.content[0].id, word: `Từ rút ${sfx}` }));
await step('suggestionApi.withdraw', () => suggestionApi.withdraw(sug2!.id));

console.log('— social');
// Publishing as a learner runs AI moderation + duplicate detection, which (rightly) rejects a re-run's
// near-identical text. So alice writes a draft and the admin publishes it (admins skip moderation).
await expectError('blogApi.create PUBLISHED blocked as duplicate of an earlier run (or ok on first run)',
  async () => { const p = await blogApi.create({ title: `Học ký hiệu mỗi ngày`, content: 'Mình luyện ký hiệu “Xin chào” năm phút mỗi sáng và thấy tiến bộ rõ rệt. Mẹo: quay video lại để tự sửa.', status: 'PUBLISHED' }); await blogApi.remove(p.id); throw { response: { status: 409 } }; }, 409);
const pd = await step('blogApi.create DRAFT for publishing', () => blogApi.create({ title: `Ghi chú luyện tập ${sfx}`, content: `Nhật ký luyện tập số ${sfx}.`, status: 'DRAFT' }));
if (pd) created.posts.push(pd.id);
asAdmin();
await step('admin publishes the draft', () => blogApi.update(pd!.id, { title: pd!.title, content: `Nhật ký luyện tập số ${sfx}.`, status: 'PUBLISHED' }), r => r.status === 'PUBLISHED');
as(A);
const post = await step('blogApi.get own post', () => blogApi.get(pd!.id), r => r.status === 'PUBLISHED' && r.author?.userId === alice.id);
const draft = await step('blogApi.create DRAFT', () => blogApi.create({ title: `Nháp ${sfx}`, content: 'Bản nháp riêng tư.', status: 'DRAFT' }), r => r.status === 'DRAFT');
await step('blogApi.uploadThumbnail', () => blogApi.uploadThumbnail(post!.id, png('cover.png')), r => !!r.thumbnailUrl);
await step('blogApi.removeThumbnail', () => blogApi.removeThumbnail(post!.id), r => !r.thumbnailUrl);
await step('blogApi.update', () => blogApi.update(draft!.id, { title: `Nháp sửa ${sfx}`, content: 'Vẫn là nháp.', status: 'DRAFT' }), r => r.title.startsWith('Nháp sửa'));
await step('blogApi.byAuthor (own: includes drafts)', () => blogApi.byAuthor(alice.id), r => r.content.some(p => p.id === draft!.id));
await step('blogApi.get (detail has content)', () => blogApi.get(post!.id), r => !!r.content && r.content.includes(sfx));
await step('blogApi.remove (draft)', () => blogApi.remove(draft!.id));
as(B);
await step('blogApi.byAuthor (other: no drafts)', () => blogApi.byAuthor(alice.id), r => r.content.every(p => p.status === 'PUBLISHED'));
await step('blogApi.published (feed has excerpt)', () => blogApi.published(0, 10), r => r.content.length > 0 && r.content[0].excerpt !== undefined);
await step('followApi.follow alice', () => followApi.follow(alice.id), r => r.followedByMe && !r.friend);
as(A);
await step('followApi.follow bob back → friends', () => followApi.follow(bob.id), r => r.friend);
as(B);
await step('followApi.stats', () => followApi.stats(alice.id), r => r.friend && r.followerCount >= 1);
await step('followApi.followers', () => followApi.followers(alice.id), r => r.content.some(u => u.userId === bob.id));
await step('followApi.following', () => followApi.following(bob.id), r => r.content.some(u => u.userId === alice.id));
await step('followApi.friends', () => followApi.friends(bob.id), r => r.content.some(u => u.userId === alice.id));
await step('blogApi.like', () => blogApi.like(post!.id), r => r.liked && r.likeCount === 1);
await step('blogApi.unlike', () => blogApi.unlike(post!.id), r => !r.liked && r.likeCount === 0);
await step('blogApi.like again', () => blogApi.like(post!.id), r => r.liked);
await step('blogApi.likers', () => blogApi.likers(post!.id), r => r.content.some(l => l.user?.userId === bob.id));
const cm = await step('blogApi.addComment with @mention', () => blogApi.addComment(post!.id, `@${alice.username} cảm ơn mẹo hay!`, alice.id), r => r.mentionedUser?.userId === alice.id);
await step('blogApi.comments (page)', () => blogApi.comments(post!.id), r => r.content.some(c => c.id === cm?.id));
await step('blogApi.likeComment', () => blogApi.likeComment(cm!.id), r => r.liked && r.likeCount === 1);
await step('blogApi.unlikeComment', () => blogApi.unlikeComment(cm!.id), r => !r.liked);
await step('blogApi.updateComment', () => blogApi.updateComment(cm!.id, `@${alice.username} cảm ơn bạn nhiều!`, alice.id), r => r.content.includes('nhiều'));
as(A);
const rp = await step('blogApi.addReply with @mention', () => blogApi.addReply(cm!.id, `@${bob.username} không có gì nhé`, bob.id), r => r.mentionedUser?.userId === bob.id);
await step('blogApi.replies', () => blogApi.replies(cm!.id), r => r.content.some(x => x.id === rp?.id));
as(B);
await step('blogApi.likeReply', () => blogApi.likeReply(rp!.id), r => r.liked);
await step('blogApi.unlikeReply', () => blogApi.unlikeReply(rp!.id), r => !r.liked);
as(A);
await step('blogApi.updateReply', () => blogApi.updateReply(rp!.id, `@${bob.username} không có gì đâu`, bob.id), r => r.content.endsWith('đâu'));
as(B);
await step('blogApi.share COPY_URL', () => blogApi.share(post!.id, 'COPY_URL'), r => r.shareCount >= 1 && r.blogUrl.includes(`/blogs/${post!.id}`));
await step('blogApi.share PROFILE to friend', () => blogApi.share(post!.id, 'PROFILE', alice.id), r => r.recipient?.userId === alice.id);
await step('blogApi.share PROFILE own page', () => blogApi.share(post!.id, 'PROFILE'), r => r.shareType === 'PROFILE');
await step('blogApi.sharedOnProfile (alice)', () => blogApi.sharedOnProfile(alice.id), r => r.content.some(s => s.blog.id === post!.id));
await step('blogApi.search', () => blogApi.search(sfx), r => r.blogs.content.some(b => b.id === post!.id));
as(A);
const notes = await step('notificationApi.list (alice)', () => notificationApi.list(0, 20), r => ['FOLLOW', 'LIKE', 'MENTION', 'SHARE'].every(t => r.content.some(n => n.type === t)) || `types: ${[...new Set(r.content.map(n => n.type))]}`);
await step('notificationApi.unreadCount', () => notificationApi.unreadCount(), r => r > 0);
await step('notificationApi.markRead', () => notificationApi.markRead(notes!.content[0].id), r => r.read);
await step('notificationApi.markAllRead', () => notificationApi.markAllRead());
await step('notificationApi.unreadCount → 0', () => notificationApi.unreadCount(), r => r === 0);
as(A);
await step('blogApi.deleteReply', () => blogApi.deleteReply(rp!.id));
const cm2 = await step('blogApi.addComment (author)', () => blogApi.addComment(post!.id, 'Bình luận sẽ xóa'));
await step('blogApi.deleteComment', () => blogApi.deleteComment(cm2!.id));
as(B);
await step('blogApi.report', () => blogApi.report(post!.id, 'Kiểm thử tố cáo'));
await expectError('blogApi.report twice → 409', () => blogApi.report(post!.id, 'Lần hai'), 409);

console.log('— admin');
asAdmin();
await step('adminApi.users (keyword)', () => adminApi.users({ keyword: `fe_alice_${sfx}` }), r => r.content.length === 1);
await step('adminApi.users (role filter)', () => adminApi.users({ role: 'ADMIN' }), r => r.content.every(u => u.role === 'ADMIN'));
await step('adminApi.userStats', () => adminApi.userStats(), r => r.totalUsers > 0);
await step('adminApi.setUserStatus BANNED', () => adminApi.setUserStatus(bob.id, 'BANNED', 'smoke'), r => r.status === 'BANNED');
tokens.clear();
await expectError('locked account cannot log in → 403', () => authApi.login(bob.username, PW), 403);
asAdmin();
await step('adminApi.setUserStatus ACTIVE', () => adminApi.setUserStatus(bob.id, 'ACTIVE'), r => r.status === 'ACTIVE');
await step('adminApi.setUserRole ADMIN', () => adminApi.setUserRole(bob.id, 'ADMIN'), r => r.role === 'ADMIN');
await step('adminApi.setUserRole USER', () => adminApi.setUserRole(bob.id, 'USER'), r => r.role === 'USER');
await step('adminApi.blogs (status)', () => adminApi.blogs({ status: 'PUBLISHED', size: 5 }), r => r.content.every(b => b.status === 'PUBLISHED'));
await step('adminApi.pendingReports', () => adminApi.pendingReports(), r => r >= 1);
const reps = await step('adminApi.reports (PENDING)', () => adminApi.reports({ status: 'PENDING' }), r => r.content.some(x => x.blogId === post!.id));
const rep = reps?.content.find(x => x.blogId === post!.id);
await step('adminApi.report detail', () => adminApi.report(rep!.id), r => r.blogContent?.includes(sfx) ?? false);
await step('adminApi.rejectReport', () => adminApi.rejectReport(rep!.id), r => r.status === 'REJECTED');
await step('adminApi.hideBlog', () => adminApi.hideBlog(post!.id, 'Ẩn thử'), r => r.status === 'HIDDEN' && r.deletionReason === 'Ẩn thử');
await step('adminApi.restoreBlog', () => adminApi.restoreBlog(post!.id), r => r.status === 'PUBLISHED');
as(B);
await step('blogApi.report again', () => blogApi.report(post!.id, 'Tố cáo lần 2'));
asAdmin();
const rep2 = (await adminApi.reports({ status: 'PENDING' })).content.find(x => x.blogId === post!.id);
await step('adminApi.resolveReport (removes post)', () => adminApi.resolveReport(rep2!.id, 'Vi phạm thử'), r => r.status === 'RESOLVED');
as(A);
await step('author sees removed post + reason', () => blogApi.get(post!.id), r => r.status === 'HIDDEN' && r.deletionReason === 'Vi phạm thử');
await expectError('author cannot delete a removed post → 409', () => blogApi.remove(post!.id), 409);
asAdmin();
await step('adminApi.socialOverview', () => adminApi.socialOverview(), r => r.totalBlogs > 0);
await step('adminApi.pendingSuggestions', () => adminApi.pendingSuggestions(), r => r >= 1);
await step('adminApi.suggestions', () => adminApi.suggestions(), r => r.content.some(s => s.id === sug?.id));
await step('adminApi.markSuggestionReviewed', () => adminApi.markSuggestionReviewed(sug!.id));
await step('adminApi.summary', () => adminApi.summary(), r => r.totalVocabularies > 0);
const today = new Date().toISOString().slice(0, 10), weekAgo = new Date(Date.now() - 6 * 864e5).toISOString().slice(0, 10);
await step('adminApi.visits DAY', () => adminApi.visits(weekAgo, today, 'DAY'), r => Array.isArray(r) && r.length > 0);
await step('adminApi.visits MONTH', () => adminApi.visits('2026-01-01', today, 'MONTH'), r => Array.isArray(r));
await step('adminApi.visitLogs', () => adminApi.visitLogs(0, 5), r => r.content.length > 0);
const cat = await step('categoryApi.create', () => categoryApi.create({ name: `Chủ đề thử ${sfx}`, description: 'smoke' }), r => !!r.id);
await step('categoryApi.update', () => categoryApi.update(cat!.id, { name: `Chủ đề sửa ${sfx}` }), r => r.name.startsWith('Chủ đề sửa'));
await step('categoryApi.uploadImage', () => categoryApi.uploadImage(cat!.id, png()), r => !!r.imageUrl);
if (cat) created.categories.push(cat.id);
const voc = await step('vocabularyApi.create', () => vocabularyApi.create({ categoryId: cat!.id, word: `Từ thử ${sfx}`, description: 'smoke' }), r => r.expectedId == null);
if (voc) created.vocabs.push(voc.id);
await step('vocabularyApi.update (shared expectedId allowed)', () => vocabularyApi.update(voc!.id, { categoryId: cat!.id, word: `Từ thử ${sfx}`, expectedId: scorable?.expectedId ?? 1 }), r => r.expectedId === (scorable?.expectedId ?? 1));
await step('vocabularyApi.uploadImage', () => vocabularyApi.uploadImage(voc!.id, png()), r => !!r.imageUrl);
if (scorable) {
  const buf = Buffer.from(await (await fetch(scorable.videoTutorialUrl!)).arrayBuffer());
  await step('vocabularyApi.uploadVideo (transcoded)', () => vocabularyApi.uploadVideo(voc!.id, new File([buf], 'tut.mp4', { type: 'video/mp4' })), r => !!r.videoTutorialUrl);
}
await step('vocabularyApi.remove', () => vocabularyApi.remove(voc!.id));
created.vocabs.length = 0;
await step('categoryApi.remove', () => categoryApi.remove(cat!.id));
created.categories.length = 0;

console.log('— account lifecycle');
as(A);
await expectError('changePassword wrong current → 401', () => userApi.changePassword('wrong', 'newpass1'), 401);
await step('userApi.changePassword', () => userApi.changePassword(PW, 'newpass1'));
tokens.clear();
const la2 = await step('login with new password', () => authApi.login(alice.username, 'newpass1'), r => !!r.accessToken);
tokens.set(la2!.accessToken, la2!.refreshToken);
await step('authApi.logout', () => authApi.logout(la2!.refreshToken));
const la3 = await authApi.login(alice.username, 'newpass1');
tokens.set(la3.accessToken, la3.refreshToken);
await expectError('deleteAccount wrong password → 401', () => userApi.deleteAccount('nope'), 401);
await step('userApi.deleteAccount', () => userApi.deleteAccount('newpass1'));
tokens.clear();
await expectError('deleted account cannot log in', () => authApi.login(alice.username, 'newpass1'), 401);
asAdmin();
await step('adminApi.deleteUser bob', () => adminApi.deleteUser(bob.id));

} catch (e) {
  fail++; failures.push(`crashed: ${(e as Error).message}`);
} finally {
  await cleanup();
}

console.log(`\n${pass} passed, ${fail} failed`);
if (fail) { console.log('Failed:', failures.join(' | ')); process.exit(1); }
